// js/modules/contracts/contracts-upload.js
const API_URL = "https://resident-evil-panel.vercel.app/api/upload";

export async function uploadMedia(file, contextId, userLogin, message = "", mediaType = "contract") {
  if (!file) throw new Error("Файл не выбран");

  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) throw new Error("Файл больше 50 МБ");

  const fd = new FormData();
  fd.append("file", file, file.name);
  fd.append("filename", file.name);
  fd.append("message", message);
  fd.append("mediaType", mediaType);

  const res = await fetch(API_URL, {
    method: "POST",
    body: fd,
    headers: {
      "X-Original-Content-Type": "multipart/form-data"
    }
  });

  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error("Сервер вернул не JSON: " + text.slice(0, 200));
  }

  if (!data.ok) throw new Error(data.error || "Ошибка загрузки");

  return {
    url: data.url || data.vk_link,
    vk_link: data.vk_link,
    attachment: data.attachment,
    message_id: data.message_id,
    peer_id: data.peer_id,
    mediaType: data.mediaType,
    type: file.type.startsWith("video") ? "video"
        : file.type.startsWith("audio") ? "audio"
        : "image",
    name: file.name
  };
}
