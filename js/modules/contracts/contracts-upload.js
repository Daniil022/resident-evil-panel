// js/modules/contracts/contracts-upload.js
import { storage } from "../../firebase-init.js";
import { ref, uploadBytes, getDownloadURL }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const DEMO_MEDIA_KEY = "re_demo_contract_media";

// Загрузка файла (фото или видео)
export async function uploadMedia(file, contractId, userLogin) {
  if (!file) throw new Error("Файл не выбран");

  // Ограничения
  const maxSize = 50 * 1024 * 1024; // 50 МБ
  if (file.size > maxSize) throw new Error("Файл больше 50 МБ");

  const allowedImages = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const allowedVideos = ["video/mp4", "video/webm", "video/quicktime"];
  if (!allowedImages.includes(file.type) && !allowedVideos.includes(file.type)) {
    throw new Error("Разрешены только JPG/PNG/WEBP/GIF и MP4/WEBM/MOV");
  }

  const ext = file.name.split(".").pop();
  const path = `contracts/${contractId}/${userLogin}_${Date.now()}.${ext}`;

  // Firebase Storage
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    return { url, type: file.type.startsWith("video") ? "video" : "image", name: file.name };
  } catch (e) {
    console.warn("Firebase Storage недоступен, сохраняю в демо-режиме");
  }

  // Демо — конвертируем в base64 (только для картинок до 2МБ)
  if (file.type.startsWith("image") && file.size < 2 * 1024 * 1024) {
    const base64 = await fileToBase64(file);
    const media = getDemoMedia();
    media.push({ id: "demo-" + Date.now(), contractId, url: base64, type: "image", name: file.name });
    localStorage.setItem(DEMO_MEDIA_KEY, JSON.stringify(media));
    return { url: base64, type: "image", name: file.name };
  }

  // Для больших файлов — просто сохраняем имя
  return {
    url: "",
    type: file.type.startsWith("video") ? "video" : "image",
    name: file.name,
    demoOnly: true
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getDemoMedia() {
  try { return JSON.parse(localStorage.getItem(DEMO_MEDIA_KEY) || "[]"); }
  catch { return []; }
}
