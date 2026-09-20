// js/modules/album-upload.js
// Массовая загрузка фото: drag-n-drop + прогресс-бар.

import { db } from "../firebase-init.js";
import { collection, addDoc, doc, updateDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { uploadMedia } from "./contracts/contracts-upload.js";
import { getCurrentUser } from "../core/state.js";
import { toast } from "../core/utils.js";

const MAX_FILES = 20;
const MAX_SIZE = 50 * 1024 * 1024;

/**
 * Настраивает dropzone в альбоме.
 * @param {Function} onComplete — колбэк после завершения загрузки (обновить UI)
 */
export function setupAlbumUpload(onComplete) {
  const grid = document.getElementById("albumGrid");
  if (!grid) return;
  if (grid.__dropBound) return;
  grid.__dropBound = true;

  // Создаём overlay для drop
  let overlay = document.getElementById("albumDropOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "albumDropOverlay";
    overlay.className = "album-drop-overlay";
    overlay.innerHTML =
      '<div class="album-drop-inner">' +
        '<div class="album-drop-icon">📥</div>' +
        '<div class="album-drop-text">Отпусти файлы для загрузки</div>' +
        '<div class="album-drop-hint">До 20 файлов, до 50 МБ каждый</div>' +
      '</div>';
    grid.appendChild(overlay);
  }

  let dragCounter = 0;

  grid.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragCounter++;
    overlay.classList.add("active");
  });

  grid.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });

  grid.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      overlay.classList.remove("active");
    }
  });

  grid.addEventListener("drop", async (e) => {
    e.preventDefault();
    dragCounter = 0;
    overlay.classList.remove("active");

    const files = Array.from(e.dataTransfer.files || [])
      .filter(f => f.type.startsWith("image/"));

    if (files.length === 0) {
      toast("Только изображения", "warn");
      return;
    }

    await uploadBatch(files, onComplete);
  });
}

/**
 * Кнопка «Загрузить много».
 */
export function setupBulkUploadButton(albumId, onComplete) {
  const toolbar = document.getElementById("albumToolbar");
  if (!toolbar) return;
  if (document.getElementById("albumBulkBtn")) return;

  const btn = document.createElement("button");
  btn.id = "albumBulkBtn";
  btn.className = "btn";
  btn.style.marginLeft = "8px";
  btn.textContent = "📥 Загрузить много";

  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = "image/*";
  input.style.display = "none";
  input.id = "albumBulkInput";

  toolbar.appendChild(btn);
  toolbar.appendChild(input);

  btn.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const files = Array.from(input.files || []);
    input.value = "";
    if (files.length === 0) return;
    await uploadBatch(files, onComplete, albumId);
  });
}

/**
 * Массовая загрузка файлов с прогрессом.
 */
async function uploadBatch(files, onComplete, albumId = null) {
  const me = getCurrentUser();
  if (!me) return;

  if (files.length > MAX_FILES) {
    toast("Максимум " + MAX_FILES + " файлов", "warn");
    return;
  }

  for (const f of files) {
    if (f.size > MAX_SIZE) {
      toast("Файл «" + f.name + "» больше 50 МБ", "warn");
      return;
    }
  }

  showProgress(0, files.length);

  let ok = 0, failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    updateProgress(i, files.length, file.name);

    try {
      const media = await uploadMedia(
        file,
        albumId || "album",
        me.login,
        "Альбом: " + file.name,
        "album"
      );

      const data = {
        url: media.url,
        title: file.name.replace(/\.[^.]+$/, ""),
        albumId: albumId,
        addedBy: me.login,
        createdAt: Date.now(),
        order: Date.now() + i
      };

      const ref = await addDoc(collection(db, "album_photos"), data);

      // Если у альбома нет обложки — ставим первое фото
      if (albumId && i === 0) {
        try {
          await updateDoc(doc(db, "albums", albumId), { cover: media.url });
        } catch (e) {}
      }

      ok++;
    } catch (e) {
      console.warn("Upload failed:", file.name, e);
      failed++;
    }
  }

  hideProgress();

  let msg = "Загружено: " + ok;
  if (failed) msg += ", ошибок: " + failed;
  toast(msg, failed ? "warn" : "ok");

  if (onComplete) onComplete();
}

// ==================== ПРОГРЕСС ====================
function showProgress(done, total) {
  let bar = document.getElementById("albumUploadProgress");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "albumUploadProgress";
    bar.className = "album-upload-progress";
    bar.innerHTML =
      '<div class="aup-bar"><span></span></div>' +
      '<div class="aup-text" id="aupText">Загрузка...</div>';
    document.body.appendChild(bar);
  }
  bar.classList.add("active");
  updateProgress(done, total, "");
}

function updateProgress(done, total, filename) {
  const bar = document.getElementById("albumUploadProgress");
  const text = document.getElementById("aupText");
  if (!bar || !text) return;

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const span = bar.querySelector(".aup-bar > span");
  if (span) span.style.width = percent + "%";

  text.textContent = "Загрузка " + (done + 1) + " из " + total + (filename ? ": " + filename : "");
}

function hideProgress() {
  const bar = document.getElementById("albumUploadProgress");
  if (bar) {
    bar.classList.remove("active");
    setTimeout(() => bar.remove(), 400);
  }
}
