// api/upload.js
export const config = {
  api: {
    bodyParser: false,
    sizeLimit: "50mb"
  }
};

const PEER_MAP = {
  avatar:   "VK_PEER_AVATARS",
  album:    "VK_PEER_ALBUM",
  music:    "VK_PEER_MUSIC",
  contract: "VK_PEER_ID",
  voice:    "VK_PEER_ID",
  default:  "VK_PEER_ID"
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const VK_TOKEN = process.env.VK_TOKEN;
    const VK_PEER_ID = process.env.VK_PEER_ID;
    const VK_VERSION = "5.199";

    if (!VK_TOKEN) return res.status(500).json({ ok: false, error: "VK_TOKEN not configured" });
    if (!VK_PEER_ID) return res.status(500).json({ ok: false, error: "VK_PEER_ID not configured" });

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const contentType = req.headers["content-type"] || "";
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) return res.status(400).json({ ok: false, error: "No boundary" });

    const boundary = "--" + boundaryMatch[1];
    const boundaryBuf = Buffer.from(boundary);
    const crlf = Buffer.from("\r\n\r\n");

    let fileData = null;
    let filename = "file";
    let message = "";
    let fileType = "";
    let mediaType = "contract";

    const parts = [];
    let start = 0;
    while (true) {
      const idx = buffer.indexOf(boundaryBuf, start);
      if (idx === -1) break;
      if (start > 0) parts.push(buffer.slice(start, idx - 2));
      start = idx + boundaryBuf.length;
    }

    for (const part of parts) {
      const headerEnd = part.indexOf(crlf);
      if (headerEnd === -1) continue;

      const headers = part.slice(0, headerEnd).toString("utf-8");
      let bodyBuf = part.slice(headerEnd + crlf.length);
      if (bodyBuf.length >= 2 && bodyBuf[bodyBuf.length - 2] === 0x0D && bodyBuf[bodyBuf.length - 1] === 0x0A) {
        bodyBuf = bodyBuf.slice(0, bodyBuf.length - 2);
      }

      const nameMatch = headers.match(/name="([^"]+)"/);
      const fileMatch = headers.match(/filename="([^"]+)"/);
      const typeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/);

      if (!nameMatch) continue;

      if (fileMatch) {
        filename = fileMatch[1];
        fileType = typeMatch ? typeMatch[1].trim() : "application/octet-stream";
        fileData = bodyBuf;
      } else if (nameMatch[1] === "message") {
        message = bodyBuf.toString("utf-8");
      } else if (nameMatch[1] === "mediaType") {
        mediaType = bodyBuf.toString("utf-8").trim();
      }
    }

    if (!fileData) return res.status(400).json({ ok: false, error: "No file" });

    const peerKey = PEER_MAP[mediaType] || PEER_MAP.default;
    const peerId = process.env[peerKey] || process.env.VK_PEER_ID;

    console.log("Upload:", { mediaType, peerKey, peerId, filename, fileType, size: fileData.length });

    const isPhoto = fileType.startsWith("image/");
    const isVideo = fileType.startsWith("video/");
    const isAudio = fileType.startsWith("audio/");

    let attachmentId = null;
    let directUrl = null;

    if (isPhoto) {
      const serverResp = await fetch(
        "https://api.vk.com/method/photos.getMessagesUploadServer?peer_id=" + peerId + "&access_token=" + VK_TOKEN + "&v=" + VK_VERSION
      );
      const serverData = await serverResp.json();
      if (serverData.error) throw new Error("getMessagesUploadServer: " + serverData.error.error_msg);

      const fd = new FormData();
      fd.append("file", new Blob([fileData], { type: fileType }), filename);
      const uploadResp = await fetch(serverData.response.upload_url, { method: "POST", body: fd });
      const uploadData = await uploadResp.json();

      const saveResp = await fetch(
        "https://api.vk.com/method/photos.saveMessagesPhoto?photo=" + uploadData.photo + "&server=" + uploadData.server + "&hash=" + uploadData.hash + "&access_token=" + VK_TOKEN + "&v=" + VK_VERSION
      );
      const saveData = await saveResp.json();
      if (saveData.error) throw new Error("saveMessagesPhoto: " + saveData.error.error_msg);

      const photo = saveData.response[0];
      attachmentId = "photo" + photo.owner_id + "_" + photo.id;

      if (photo.sizes && photo.sizes.length) {
        const biggest = photo.sizes[photo.sizes.length - 1];
        directUrl = biggest.url;
      }
    } else if (isVideo || isAudio) {
      const docType = isVideo ? "video_message" : "audio_message";
      const serverResp = await fetch(
        "https://api.vk.com/method/docs.getMessagesUploadServer?type=" + docType + "&peer_id=" + peerId + "&access_token=" + VK_TOKEN + "&v=" + VK_VERSION
      );
      const serverData = await serverResp.json();
      if (serverData.error) throw new Error("docs.getMessagesUploadServer: " + serverData.error.error_msg);

      const fd = new FormData();
      fd.append("file", new Blob([fileData], { type: fileType }), filename);
      const uploadResp = await fetch(serverData.response.upload_url, { method: "POST", body: fd });
      const uploadData = await uploadResp.json();

      const saveResp = await fetch(
        "https://api.vk.com/method/docs.save?file=" + encodeURIComponent(uploadData.file) + "&access_token=" + VK_TOKEN + "&v=" + VK_VERSION
      );
      const saveData = await saveResp.json();
      if (saveData.error) throw new Error("docs.save: " + saveData.error.error_msg);

      const doc = saveData.response.doc || saveData.response[0];
      attachmentId = "doc" + doc.owner_id + "_" + doc.id;
      directUrl = doc.url || null;
    } else {
      return res.status(400).json({ ok: false, error: "Unsupported type: " + fileType });
    }

    const randomId = Math.floor(Math.random() * 1e15);
    const sendResp = await fetch(
      "https://api.vk.com/method/messages.send?peer_id=" + peerId + "&attachment=" + attachmentId + "&message=" + encodeURIComponent(message) + "&random_id=" + randomId + "&access_token=" + VK_TOKEN + "&v=" + VK_VERSION
    );
    const sendData = await sendResp.json();
    if (sendData.error) throw new Error("messages.send: " + sendData.error.error_msg);

    return res.status(200).json({
      ok: true,
      attachment: attachmentId,
      message_id: sendData.response,
      peer_id: peerId,
      mediaType: mediaType,
      url: directUrl,
      vk_link: "https://vk.com/im?sel=" + peerId + "&msgid=" + sendData.response
    });

  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
