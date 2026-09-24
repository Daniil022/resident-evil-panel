// api/upload.js
export const config = {
  runtime: "nodejs",
  api: { bodyParser: false },
  maxDuration: 60  // ✅ нужно для Pro-плана; на Hobby — бесполезно
};

const PEER_MAP = {
  avatar:   "VK_PEER_AVATARS",
  album:    "VK_PEER_ALBUM",
  music:    "VK_PEER_MUSIC",
  contract: "VK_PEER_ID",
  voice:    "VK_PEER_ID",
  chat:     "VK_PEER_ID",
  default:  "VK_PEER_ID"
};

// ==================== ЧТЕНИЕ BODY ====================
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    // ✅ Универсально: работаем и с IncomingMessage, и со stream
    if (typeof req.on === "function") {
      req.on("data", (chunk) => {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      });
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
      return;
    }

    // ✅ Fallback для async iterable
    (async () => {
      try {
        for await (const chunk of req) {
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        }
        resolve(Buffer.concat(chunks));
      } catch (e) {
        reject(e);
      }
    })();
  });
}

// ==================== HANDLER ====================
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Original-Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const t0 = Date.now();
  console.log("[upload] START", req.method, "content-length:", req.headers["content-length"] || "unknown");

  try {
    const VK_TOKEN = process.env.VK_TOKEN;
    const VK_PEER_ID = process.env.VK_PEER_ID;
    const VK_VERSION = "5.199";

    if (!VK_TOKEN) {
      console.error("[upload] VK_TOKEN missing");
      return res.status(500).json({ ok: false, error: "VK_TOKEN not configured" });
    }
    if (!VK_PEER_ID) {
      console.error("[upload] VK_PEER_ID missing");
      return res.status(500).json({ ok: false, error: "VK_PEER_ID not configured" });
    }

    // === ЧИТАЕМ BODY (безопасно) ===
    const buffer = await readBody(req);
    console.log("[upload] buffer size:", buffer.length, "in", Date.now() - t0, "ms");

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ ok: false, error: "No body" });
    }

    // === CONTENT-TYPE ===
    let contentType = req.headers["content-type"] || req.headers["Content-Type"] || "";
    console.log("[upload] content-type:", contentType);

    // === BOUNDARY ===
    let boundary = null;
    const m = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
    if (m) {
      boundary = (m[1] || m[2]).trim();
    }

    // Fallback: из тела
    if (!boundary) {
      const head = buffer.slice(0, 500).toString("binary");
      const lineEnd = head.indexOf("\r\n");
      const firstLine = lineEnd >= 0 ? head.slice(0, lineEnd) : head;
      const bm = firstLine.match(/^-{2,}(.+)$/);
      if (bm) {
        boundary = bm[1].trim();
        console.log("[upload] boundary from body:", boundary);
      }
    }

    if (!boundary) {
      return res.status(400).json({ ok: false, error: "No boundary" });
    }

    // === MULTIPART PARSER ===
    const boundaryLine = "--" + boundary;
    const boundaryBuf = Buffer.from(boundaryLine);
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
      if (start > 0) {
        let end = idx;
        if (end >= 2 && buffer[end - 2] === 0x0D && buffer[end - 1] === 0x0A) end -= 2;
        parts.push(buffer.slice(start, end));
      }
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

    console.log("[upload] parsed:", { filename, fileType, mediaType, size: fileData ? fileData.length : 0 });

    if (!fileData) return res.status(400).json({ ok: false, error: "No file" });

    const peerKey = PEER_MAP[mediaType] || PEER_MAP.default;
    const peerId = process.env[peerKey] || process.env.VK_PEER_ID;

    const isPhoto = fileType.startsWith("image/");
    const isVideo = fileType.startsWith("video/");
    const isAudio = fileType.startsWith("audio/");

    let attachmentId = null;
    let directUrl = null;

    // ==================== ФОТО ====================
    if (isPhoto) {
      const serverUrl = "https://api.vk.com/method/photos.getMessagesUploadServer?peer_id=" + peerId + "&access_token=" + VK_TOKEN + "&v=" + VK_VERSION;
      console.log("[upload] VK getMessagesUploadServer...");
      const serverResp = await fetch(serverUrl);
      const serverData = await serverResp.json();

      if (serverData.error) {
        console.error("[upload] VK error:", serverData.error);
        throw new Error("getMessagesUploadServer: " + serverData.error.error_msg + " (code " + serverData.error.error_code + ")");
      }

      const fd = new FormData();
      fd.append("file", new Blob([fileData], { type: fileType }), filename);
      console.log("[upload] uploading to VK:", serverData.response.upload_url);
      const uploadResp = await fetch(serverData.response.upload_url, { method: "POST", body: fd });
      const uploadData = await uploadResp.json();
      console.log("[upload] VK upload response:", uploadData);

      if (!uploadData.photo) {
        throw new Error("VK upload failed: " + JSON.stringify(uploadData));
      }

      const saveUrl = "https://api.vk.com/method/photos.saveMessagesPhoto?photo=" + uploadData.photo + "&server=" + uploadData.server + "&hash=" + uploadData.hash + "&access_token=" + VK_TOKEN + "&v=" + VK_VERSION;
      const saveResp = await fetch(saveUrl);
      const saveData = await saveResp.json();

      if (saveData.error) {
        console.error("[upload] VK save error:", saveData.error);
        throw new Error("saveMessagesPhoto: " + saveData.error.error_msg + " (code " + saveData.error.error_code + ")");
      }

      const photo = saveData.response[0];
      attachmentId = "photo" + photo.owner_id + "_" + photo.id;

      if (photo.sizes && photo.sizes.length) {
        const biggest = photo.sizes.reduce((a, b) =>
          (a.width * a.height > b.width * b.height) ? a : b
        );
        directUrl = biggest.url;
      }
    }
    // ==================== ВИДЕО/АУДИО ====================
    else if (isVideo || isAudio) {
      const docType = isVideo ? "video_message" : "audio_message";
      const serverUrl = "https://api.vk.com/method/docs.getMessagesUploadServer?type=" + docType + "&peer_id=" + peerId + "&access_token=" + VK_TOKEN + "&v=" + VK_VERSION;
      const serverResp = await fetch(serverUrl);
      const serverData = await serverResp.json();

      if (serverData.error) {
        throw new Error("docs.getMessagesUploadServer: " + serverData.error.error_msg + " (code " + serverData.error.error_code + ")");
      }

      const fd = new FormData();
      fd.append("file", new Blob([fileData], { type: fileType }), filename);
      const uploadResp = await fetch(serverData.response.upload_url, { method: "POST", body: fd });
      const uploadData = await uploadResp.json();

      const saveUrl = "https://api.vk.com/method/docs.save?file=" + encodeURIComponent(uploadData.file) + "&access_token=" + VK_TOKEN + "&v=" + VK_VERSION;
      const saveResp = await fetch(saveUrl);
      const saveData = await saveResp.json();

      if (saveData.error) {
        throw new Error("docs.save: " + saveData.error.error_msg + " (code " + saveData.error.error_code + ")");
      }

      const doc = saveData.response.doc || saveData.response[0];
      attachmentId = "doc" + doc.owner_id + "_" + doc.id;
      directUrl = doc.url || null;
    }
    else {
      return res.status(400).json({ ok: false, error: "Unsupported type: " + fileType });
    }

    // ==================== ОТПРАВКА В БЕСЕДУ ====================
    const randomId = Math.floor(Math.random() * 1e15);
    const sendUrl = "https://api.vk.com/method/messages.send?peer_id=" + peerId + "&attachment=" + attachmentId + "&message=" + encodeURIComponent(message) + "&random_id=" + randomId + "&access_token=" + VK_TOKEN + "&v=" + VK_VERSION;
    const sendResp = await fetch(sendUrl);
    const sendData = await sendResp.json();

    if (sendData.error) {
      console.error("[upload] VK send error:", sendData.error);
      throw new Error("messages.send: " + sendData.error.error_msg + " (code " + sendData.error.error_code + ")");
    }

    console.log("[upload] OK in", Date.now() - t0, "ms");

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
    console.error("[upload] ERROR:", e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
