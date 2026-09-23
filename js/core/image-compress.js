// js/core/image-compress.js
// Сжатие фото перед загрузкой в VK.
// Конвертирует в JPEG, уменьшает размер, чинит проблему с HEIC.

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const QUALITY = 0.85;

/**
 * Сжимает изображение через canvas.
 * @param {File} file — исходный файл
 * @returns {Promise<File>} — сжатый JPEG
 */
export async function compressImage(file) {
  if (!file) return file;

  // Только изображения
  if (!file.type.startsWith("image/")) return file;

  // GIF не трогаем (анимация потеряется)
  if (file.type === "image/gif") return file;

  // SVG не трогаем
  if (file.type === "image/svg+xml") return file;

  try {
    const dataUrl = await readAsDataURL(file);
    const img = await loadImage(dataUrl);

    let { width, height } = img;

    // Уменьшаем, если больше MAX
    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
      const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";           // фон (для прозрачных PNG)
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, "image/jpeg", QUALITY);
    if (!blob) return file;              // fallback — вернём оригинал

    // Новое имя файла
    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch (e) {
    console.warn("[compress] failed:", e);
    return file;                          // fallback — вернём оригинал
  }
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}
