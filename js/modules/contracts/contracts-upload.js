// js/modules/contracts/contracts-upload.js

// ==== URL API Vercel ====
const API_URL = "https://resident-evil-panel.vercel.app/api/upload";

/**
 * Загружает файл в ВК через Vercel API
 * @param {File} file
 * @param {string} contractId
 * @param {string} userLogin
 * @param {string} message
 */
export async function uploadMedia(file, contractId, userLogin, message = "") {
  if (!file) throw new Error("Файл не выбран");

  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) throw new Error("Файл больше 50 МБ");

  const fd = new FormData();
  fd.append("file", file, file.name);
  fd.append("filename", file.name);
  fd.append("message", `📦 ${userLogin} | Контракт #${contractId}\n${message}`);

  const res = await fetch(API_URL, {
    method: "POST",
    body: fd
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Ошибка загрузки");

  return {
    url: data.vk_link,
    attachment: data.attachment,
    message_id: data.message_id,
    type: file.type.startsWith("video") ? "video" : "image",
    name: file.name
  };
}
