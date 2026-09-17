// Vercel API-функция: прокси для загрузки файлов в ВК
// URL: https://resident-evil-panel.vercel.app/api/upload

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: "50mb"
  }
};

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const VK_TOKEN = process.env.VK_TOKEN;
    const VK_PEER_ID = process.env.VK_PEER_ID;
    const VK_VERSION = "5.199";

    if (!VK_TOKEN || !VK_PEER_ID) {
      return res.status(500).json({ ok: false, error: "VK_TOKEN or VK_PEER_ID not configured" });
    }

    // Парсим multipart/form-data
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Извлекаем границу multipart
    const contentType = req.headers["content-type"] || "";
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) {
      return res.status(400).json({ ok: false, error: "No boundary in content-type" });
    }

    // Простой парсер multipart
    const boundary = "--" + boundaryMatch[1];
    const parts = buffer.toString("binary").split(boundary).filter(p => p && p !== "--\r\n");

    let fileData = null;
    let filename = "file";
    let message = "";
    let fileType = "";

    for (const part of parts) {
      const headerEnd = part.indexOf("\r\n\r\n");
      if (headerEnd === -1) continue;

      const headers = part.substring(0, headerEnd);
      const body = part.substring(headerEnd + 4, part.lastIndexOf("\r\n"));

      const nameMatch = headers.match(/name="([^"]+)"/);
      const fileMatch = headers.match(/filename="([^"]+)"/);
      const typeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/);

      if (!nameMatch) continue;

      if (fileMatch) {
        filename = fileMatch[1];
        fileType = typeMatch ? typeMatch[1].trim() : "application/octet-stream";
        fileData = Buffer.from(body, "binary");
      } else if (nameMatch[1] === "message") {
        message = body;
      }
    }

    if (!fileData) {
      return res.status(400).json({ ok: false, error: "No file" });
    }

    const isPhoto = fileType.startsWith("image/");
    const isVideo = fileType.startsWith("video/");

    let attachmentId = null;

    if (isPhoto) {
      // ФОТО
      const serverResp = await fetch(
        `https://api.vk.com/method/photos.getMessagesUploadServer?peer_id=${VK_PEER_ID}&access_token=${VK_TOKEN}&v=${VK_VERSION}`
      );
      const serverData = await serverResp.json();
      if (serverData.error) throw new Error("getMessagesUploadServer: " + serverData.error.error_msg);

      // Отправляем фото в VK
      const fd = new FormData();
      fd.append("file", new Blob([fileData], { type: fileType }), filename);

      const uploadResp = await fetch(serverData.response.upload_url, { method: "POST", body: fd });
      const uploadData = await uploadResp.json();

      const saveResp = await fetch(
        `https://api.vk.com/method/photos.saveMessagesPhoto?photo=${uploadData.photo}&server=${uploadData.server}&hash=${uploadData.hash}&access_token=${VK_TOKEN}&v=${VK_VERSION}`
      );
      const saveData = await saveResp.json();
      if (saveData.error) throw new Error("saveMessagesPhoto: " + saveData.error.error_msg);

      const photo = saveData.response[0];
      attachmentId = `photo${photo.owner_id}_${photo.id}`;
    } else if (isVideo) {
      // ВИДЕО через docs
      const serverResp = await fetch(
        `https://api.vk.com/method/docs.getMessagesUploadServer?type=video_message&peer_id=${VK_PEER_ID}&access_token=${VK_TOKEN}&v=${VK_VERSION}`
      );
      const serverData = await serverResp.json();
      if (serverData.error) throw new Error("docs.getMessagesUploadServer: " + serverData.error.error_msg);

      const fd = new FormData();
      fd.append("file", new Blob([fileData], { type: fileType }), filename);

      const uploadResp = await fetch(serverData.response.upload_url, { method: "POST", body: fd });
      const uploadData = await uploadResp.json();

      const saveResp = await fetch(
        `https://api.vk.com/method/docs.save?file=${encodeURIComponent(uploadData.file)}&access_token=${VK_TOKEN}&v=${VK_VERSION}`
      );
      const saveData = await saveResp.json();
      if (saveData.error) throw new Error("docs.save: " + saveData.error.error_msg);

      const doc = saveData.response.doc || saveData.response[0];
      attachmentId = `doc${doc.owner_id}_${doc.id}`;
    } else {
      return res.status(400).json({ ok: false, error: "Unsupported file type" });
    }

    // Отправляем в беседу
    const randomId = Math.floor(Math.random() * 1e15);
    const sendResp = await fetch(
      `https://api.vk.com/method/messages.send?peer_id=${VK_PEER_ID}&attachment=${attachmentId}&message=${encodeURIComponent(message)}&random_id=${randomId}&access_token=${VK_TOKEN}&v=${VK_VERSION}`
    );
    const sendData = await sendResp.json();
    if (sendData.error) throw new Error("messages.send: " + sendData.error.error_msg);

    return res.status(200).json({
      ok: true,
      attachment: attachmentId,
      message_id: sendData.response,
      vk_link: `https://vk.com/im?sel=${VK_PEER_ID}&msgid=${sendData.response}`
    });

  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
