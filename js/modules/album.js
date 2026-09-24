// js/modules/album.js
import { db } from "../firebase-init.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { openModal, closeModal, toast, escapeHtml, formatDate } from "../core/utils.js";
import { uploadMedia } from "./contracts/contracts-upload.js";
import { canEdit, requireEdit } from "./gestion.js";
import { getCurrentUser } from "../core/state.js";
import { openLightbox } from "./album-lightbox.js";
import { setupAlbumUpload, setupBulkUploadButton } from "./album-upload.js";
import { setupAlbumSort } from "./album-sort.js";
import { compressImage } from "../core/image-compress.js";

// ... остальной код без изменений

const DEMO_ALBUMS_KEY = "re_demo_albums_v2";
const DEMO_PHOTOS_KEY = "re_demo_album_photos_v2";

let albums = [];
let photos = [];
let currentAlbumId = null;

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
export async function initAlbum() {
  const grid = document.getElementById("albumGrid");
  if (!grid) return;

  await loadAll();
  renderAlbumsScreen();
  bindToolbar();

  setupAlbumUpload(async () => {
    await loadAll();
    if (currentAlbumId) renderAlbumScreen();
    else renderAlbumsScreen();
  });
}

async function loadAll() {
  try {
    const [albumsSnap, photosSnap] = await Promise.all([
      getDocs(query(collection(db, "albums"), orderBy("createdAt", "desc"))),
      getDocs(collection(db, "album_photos"))
    ]);
    albums = albumsSnap.docs.map(d => ({ id: d.id, ...d.data(), source: "firebase" }));
    photos = photosSnap.docs.map(d => ({ id: d.id, ...d.data(), source: "firebase" }));
  } catch (e) {
    albums = getDemoAlbums();
    photos = getDemoPhotos();
  }

  if (albums.length === 0 && photos.length === 0) {
    albums = getDemoAlbums();
    photos = getDemoPhotos();
  }
}

function getDemoAlbums() {
  try { return JSON.parse(localStorage.getItem(DEMO_ALBUMS_KEY) || "[]"); } catch { return []; }
}
function saveDemoAlbums() {
  localStorage.setItem(DEMO_ALBUMS_KEY, JSON.stringify(albums.filter(a => a.source !== "firebase")));
}
function getDemoPhotos() {
  try { return JSON.parse(localStorage.getItem(DEMO_PHOTOS_KEY) || "[]"); } catch { return []; }
}
function saveDemoPhotos() {
  localStorage.setItem(DEMO_PHOTOS_KEY, JSON.stringify(photos.filter(p => p.source !== "firebase")));
}

// ==================== TOOLBAR ====================
function bindToolbar() {
  const toolbar = document.getElementById("albumToolbar");
  if (!toolbar || toolbar.__bound) return;
  toolbar.__bound = true;
  renderToolbar();
}

function renderToolbar() {
  const toolbar = document.getElementById("albumToolbar");
  if (!toolbar) return;

  const editable = canEdit();

  if (currentAlbumId) {
    let html = '<button class="btn secondary" id="albumBackBtn">← К альбомам</button>';
    html += '<button class="btn" id="addPhotoBtn" style="margin-left:8px;">+ Добавить фото</button>';
    if (editable) {
      html += '<button class="btn secondary" id="editAlbumBtn" style="margin-left:8px;">✏️ Редактировать</button>';
    }
    toolbar.innerHTML = html;

    document.getElementById("albumBackBtn").onclick = () => {
      currentAlbumId = null;
      renderAlbumsScreen();
      renderToolbar();
    };
    document.getElementById("addPhotoBtn").onclick = () => openPhotoModal();
    const editBtn = document.getElementById("editAlbumBtn");
    if (editBtn) editBtn.onclick = () => openAlbumModal(currentAlbumId);

    if (editable) {
      setupBulkUploadButton(currentAlbumId, async () => {
        await loadAll();
        renderAlbumScreen();
      });
    }
  } else {
    let html = "";
    if (editable) {
      html += '<button class="btn" id="addAlbumBtn">+ Создать альбом</button>';
    }
    html += '<button class="btn secondary" id="addPhotoBtn2" style="margin-left:8px;">+ Фото (без альбома)</button>';
    toolbar.innerHTML = html;

    const addAlbumBtn = document.getElementById("addAlbumBtn");
    if (addAlbumBtn) addAlbumBtn.onclick = () => openAlbumModal();
    document.getElementById("addPhotoBtn2").onclick = () => openPhotoModal();
  }
}

// ==================== ЭКРАН АЛЬБОМОВ ====================
function renderAlbumsScreen() {
  const grid = document.getElementById("albumGrid");
  if (!grid) return;

  const counts = {};
  photos.forEach(p => {
    if (p.albumId) counts[p.albumId] = (counts[p.albumId] || 0) + 1;
  });

  const withoutAlbum = photos.filter(p => !p.albumId);

  if (albums.length === 0 && withoutAlbum.length === 0) {
    grid.innerHTML = '<div class="contracts-empty" style="grid-column:1/-1;">' +
      '<div class="contracts-empty-icon">📸</div>' +
      '<div class="contracts-empty-text">Фотоальбом пуст</div>' +
      '<div class="contracts-empty-sub">Создай первый альбом или перетащи фото</div>' +
      '</div>';
    return;
  }

  let html = "";

  html += albums.map(a => renderAlbumCard(a, counts[a.id] || 0)).join("");

  if (withoutAlbum.length > 0) {
    html += renderAlbumCard({
      id: "__no_album__",
      name: "Без альбома",
      cover: withoutAlbum[0].url,
      createdBy: "—",
      createdAt: withoutAlbum[0].createdAt
    }, withoutAlbum.length, true);
  }

  grid.innerHTML = html;

  grid.querySelectorAll(".album-card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.albumId;
      openAlbum(id === "__no_album__" ? null : id);
    });
  });
}

function renderAlbumCard(album, photoCount, isVirtual = false) {
  const cover = album.cover || "";
  const coverHtml = cover
    ? '<img src="' + cover + '" alt="' + escapeHtml(album.name) + '" loading="lazy">'
    : '<div class="album-cover-empty">📷</div>';

  const editable = canEdit() && !isVirtual;

  return '<div class="album-card" data-album-id="' + album.id + '">' +
    '<div class="album-cover">' +
      coverHtml +
      '<div class="album-count">' + photoCount + ' фото</div>' +
      (editable ? '<button class="album-del" onclick="event.stopPropagation();window.__albumDelete(\'' + album.id + '\')" title="Удалить альбом">✕</button>' : '') +
    '</div>' +
    '<div class="album-meta">' +
      '<div class="album-name">' + escapeHtml(album.name) + '</div>' +
      '<div class="album-sub">' + escapeHtml(album.createdBy || "—") + ' · ' + formatDate(album.createdAt || Date.now()) + '</div>' +
    '</div>' +
  '</div>';
}

// ==================== ВНУТРИ АЛЬБОМА ====================
function openAlbum(albumId) {
  currentAlbumId = albumId;
  renderAlbumScreen();
  renderToolbar();
}

function renderAlbumScreen() {
  const grid = document.getElementById("albumGrid");
  if (!grid) return;

  const albumPhotos = photos
    .filter(p => p.albumId === currentAlbumId)
    .sort((a, b) => {
      if (a.order != null && b.order != null) return a.order - b.order;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

  const album = currentAlbumId
    ? albums.find(a => a.id === currentAlbumId)
    : null;

  const title = album ? album.name : "Без альбома";

  if (albumPhotos.length === 0) {
    grid.innerHTML = '<div class="contracts-empty" style="grid-column:1/-1;">' +
      '<div class="contracts-empty-icon">📷</div>' +
      '<div class="contracts-empty-text">В альбоме «' + escapeHtml(title) + '» пока пусто</div>' +
      '<div class="contracts-empty-sub">Нажми «+ Добавить фото» или перетащи файлы</div>' +
      '</div>';
    return;
  }

  const editable = canEdit();

  grid.innerHTML = albumPhotos.map((p) => {
    const canMove = editable && albums.length > 0;
    return '<div class="photo-card" data-photo-id="' + p.id + '">' +
      '<div class="photo-img-wrap">' +
        '<img src="' + p.url + '" alt="' + escapeHtml(p.title || "Фото") + '" loading="lazy">' +
        (editable ? '<button class="photo-del" onclick="event.stopPropagation();window.__albumPhotoDelete(\'' + p.id + '\')" title="Удалить">✕</button>' : '') +
        (canMove ? '<button class="photo-move" onclick="event.stopPropagation();window.__albumPhotoMove(\'' + p.id + '\')" title="Переместить">↔</button>' : '') +
      '</div>' +
      '<div class="photo-meta">' +
        (p.title ? '<div class="photo-title">' + escapeHtml(p.title) + '</div>' : '') +
        '<div class="photo-author">' +
          '<span>' + escapeHtml(p.addedBy || "—") + '</span>' +
          '<span>' + formatDate(p.createdAt) + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join("");

  grid.querySelectorAll(".photo-card").forEach(card => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      const photoId = card.dataset.photoId;
      const idx = albumPhotos.findIndex(p => p.id === photoId);
      openLightbox(albumPhotos, idx);
    });
  });

  setupAlbumSort(albumPhotos, () => {
    albumPhotos.sort((a, b) => (a.order || 0) - (b.order || 0));
  });
}

// ==================== СОЗДАНИЕ / РЕДАКТИРОВАНИЕ АЛЬБОМА ====================
function openAlbumModal(albumId = null) {
  if (!requireEdit()) return;

  const existing = albumId ? albums.find(a => a.id === albumId) : null;

  openModal({
    title: existing ? "РЕДАКТИРОВАТЬ АЛЬБОМ" : "СОЗДАТЬ АЛЬБОМ",
    html:
      '<div class="form-grid">' +
        '<div class="form-field" style="grid-column:1/-1;">' +
          '<label>Название альбома</label>' +
          '<input type="text" id="albName" value="' + escapeHtml(existing?.name || "") + '" placeholder="Мероприятия 2025" autocomplete="off">' +
        '</div>' +
        '<div class="form-field" style="grid-column:1/-1;">' +
          '<label>Обложка (ссылка, опционально)</label>' +
          '<input type="text" id="albCover" value="' + escapeHtml(existing?.cover || "") + '" placeholder="https://..." autocomplete="off">' +
          '<div class="form-hint">Если пусто — возьмётся первое фото альбома</div>' +
        '</div>' +
      '</div>' +
      '<div id="albError" style="color:var(--red);font-size:12px;display:none;"></div>',
    confirmText: existing ? "СОХРАНИТЬ" : "СОЗДАТЬ",
    onConfirm: () => saveAlbum(existing)
  });

  setTimeout(() => document.getElementById("albName")?.focus(), 80);
}

async function saveAlbum(existing) {
  if (!requireEdit()) return;

  const name = document.getElementById("albName").value.trim();
  const cover = document.getElementById("albCover").value.trim();
  const err = document.getElementById("albError");

  err.style.display = "none";
  if (!name) { err.textContent = "Введите название"; err.style.display = "block"; return; }

  const me = getCurrentUser();
  const data = {
    name,
    cover: cover || "",
    createdBy: existing?.createdBy || me?.login || "—",
    createdAt: existing?.createdAt || Date.now(),
    editedAt: Date.now()
  };

  try {
    if (existing?.source === "firebase") {
      await updateDoc(doc(db, "albums", existing.id), data);
      Object.assign(existing, data);
    } else {
      const ref = await addDoc(collection(db, "albums"), data);
      albums.unshift({ id: ref.id, ...data, source: "firebase" });
    }
    toast(existing ? "Альбом обновлён" : "Альбом создан", "ok");
  } catch (e) {
    if (existing) Object.assign(existing, data);
    else albums.unshift({ id: "demo-alb-" + Date.now(), ...data, source: "demo" });
    saveDemoAlbums();
    toast("Готово (демо)", "ok");
  }

  renderAlbumsScreen();
  renderToolbar();
  closeModal();
}

window.__albumDelete = async function(albumId) {
  if (!requireEdit()) return;
  const album = albums.find(a => a.id === albumId);
  if (!album) return;

  const photoCount = photos.filter(p => p.albumId === albumId).length;
  const msg = photoCount > 0
    ? 'Удалить альбом «' + album.name + '»? В нём ' + photoCount + ' фото. Фото останутся, но без альбома.'
    : 'Удалить альбом «' + album.name + '»?';
  if (!confirm(msg)) return;

  try {
    if (album.source === "firebase") {
      await deleteDoc(doc(db, "albums", albumId));
    }
  } catch (e) {}

  albums = albums.filter(a => a.id !== albumId);
  photos.forEach(p => { if (p.albumId === albumId) p.albumId = null; });
  saveDemoAlbums();
  saveDemoPhotos();

  for (const p of photos.filter(x => x.albumId === null && x.source === "firebase")) {
    try { await updateDoc(doc(db, "album_photos", p.id), { albumId: null }); } catch (e) {}
  }

  toast("Альбом удалён", "ok");
  renderAlbumsScreen();
};

// ==================== ДОБАВЛЕНИЕ ФОТО ====================
function openPhotoModal() {
  const albumOptions = albums.map(a =>
    '<option value="' + a.id + '"' + (currentAlbumId === a.id ? " selected" : "") + '>' + escapeHtml(a.name) + '</option>'
  ).join("");

  openModal({
    title: "ДОБАВИТЬ ФОТО",
    html:
      '<div class="form-grid">' +
        '<div class="form-field" style="grid-column:1/-1;">' +
          '<label>Название (опционально)</label>' +
          '<input type="text" id="phTitle" placeholder="Мероприятие" autocomplete="off">' +
        '</div>' +
        '<div class="form-field" style="grid-column:1/-1;">' +
          '<label>Альбом</label>' +
          '<select id="phAlbum" class="role-select">' +
            '<option value="">— без альбома —</option>' +
            albumOptions +
          '</select>' +
        '</div>' +
        '<div class="form-field" style="grid-column:1/-1;">' +
          '<label>Файл с устройства</label>' +
          '<input type="file" id="phFile" accept="image/*">' +
          '<div class="form-hint">Можно с камеры, из галереи или с ПК. Фото сожмётся автоматически.</div>' +
        '</div>' +
        '<div class="form-field" style="grid-column:1/-1;">' +
          '<label>Или ссылка на изображение</label>' +
          '<input type="text" id="phUrl" placeholder="https://..." autocomplete="off">' +
        '</div>' +
      '</div>' +
      '<div id="phError" style="color:var(--red);font-size:12px;display:none;"></div>',
    confirmText: "ДОБАВИТЬ",
    onConfirm: () => savePhoto()
  });

  setTimeout(() => document.getElementById("phTitle")?.focus(), 80);
}

async function savePhoto() {
  const title = document.getElementById("phTitle").value.trim();
  const albumId = document.getElementById("phAlbum").value || null;
  const file = document.getElementById("phFile").files[0];
  const urlInput = document.getElementById("phUrl").value.trim();
  const err = document.getElementById("phError");

  err.style.display = "none";

  if (!file && !urlInput) {
    err.textContent = "Выберите файл или вставьте ссылку";
    err.style.display = "block";
    return;
  }

  let url = urlInput;

  if (file) {
    err.textContent = "Обработка фото...";
    err.style.color = "var(--cyan)";
    err.style.display = "block";

    // Сжимаем
    let processedFile = file;
    if (file.type.startsWith("image/")) {
      try {
        processedFile = await compressImage(file);
      } catch (e) {
        console.warn("Compress failed:", e);
        processedFile = file;
      }
    }

    err.textContent = "Загрузка в ВК...";

    try {
      const me = getCurrentUser();
      const media = await uploadMedia(
        processedFile,
        albumId || "album",
        me?.login || "album",
        "Альбом: " + (title || file.name),
        "album"
      );
      url = media.url;
      if (!url) throw new Error("Пустая ссылка от VK");
    } catch (e) {
      err.textContent = "Ошибка загрузки: " + e.message;
      err.style.color = "var(--red)";
      return;
    }
  }

  if (!/^https?:\/\//.test(url)) {
    err.textContent = "Ссылка должна начинаться с http:// или https://";
    err.style.color = "var(--red)";
    err.style.display = "block";
    return;
  }

  const me = getCurrentUser();
  const data = {
    url,
    title,
    albumId,
    addedBy: me?.login || "—",
    createdAt: Date.now(),
    order: Date.now()
  };

  try {
    const ref = await addDoc(collection(db, "album_photos"), data);
    photos.unshift({ id: ref.id, ...data, source: "firebase" });

    if (albumId) {
      const album = albums.find(a => a.id === albumId);
      if (album && !album.cover) {
        album.cover = url;
        if (album.source === "firebase") {
          try { await updateDoc(doc(db, "albums", albumId), { cover: url }); } catch (e) {}
        } else {
          saveDemoAlbums();
        }
      }
    }
  } catch (e) {
    photos.unshift({ id: "demo-ph-" + Date.now(), ...data, source: "demo" });
    saveDemoPhotos();
  }

  toast("Фото добавлено", "ok");
  closeModal();

  if (currentAlbumId) renderAlbumScreen();
  else renderAlbumsScreen();
}

// ==================== УДАЛЕНИЕ ФОТО ====================
window.__albumPhotoDelete = async function(photoId) {
  if (!requireEdit()) return;
  if (!confirm("Удалить фото?")) return;

  const p = photos.find(x => x.id === photoId);
  if (!p) return;

  try {
    if (p.source === "firebase") await deleteDoc(doc(db, "album_photos", photoId));
  } catch (e) {}

  photos = photos.filter(x => x.id !== photoId);
  saveDemoPhotos();

  if (p.albumId) {
    const album = albums.find(a => a.id === p.albumId);
    if (album && album.cover === p.url) {
      const nextCover = photos.find(x => x.albumId === p.albumId);
      album.cover = nextCover ? nextCover.url : "";
      if (album.source === "firebase") {
        try { await updateDoc(doc(db, "albums", album.id), { cover: album.cover }); } catch (e) {}
      } else {
        saveDemoAlbums();
      }
    }
  }

  toast("Фото удалено", "ok");
  if (currentAlbumId) renderAlbumScreen();
  else renderAlbumsScreen();
};

// ==================== ПЕРЕМЕЩЕНИЕ ФОТО ====================
window.__albumPhotoMove = function(photoId) {
  if (!requireEdit()) return;

  const p = photos.find(x => x.id === photoId);
  if (!p) return;

  if (albums.length === 0) {
    toast("Нет альбомов для перемещения", "warn");
    return;
  }

  const options = albums.map((a, i) =>
    (i + 1) + '. ' + a.name
  ).join("\n");

  const choice = prompt(
    "Куда переместить фото?\n\n0. — без альбома —\n" + options + "\n\nВведи номер:",
    "1"
  );

  if (choice === null) return;
  const idx = parseInt(choice);

  if (isNaN(idx) || idx < 0 || idx > albums.length) {
    toast("Неверный номер", "warn");
    return;
  }

  const newAlbumId = idx === 0 ? null : albums[idx - 1].id;

  (async () => {
    p.albumId = newAlbumId;
    try {
      if (p.source === "firebase") {
        await updateDoc(doc(db, "album_photos", photoId), { albumId: newAlbumId });
      }
    } catch (e) {}
    saveDemoPhotos();
    toast("Фото перемещено", "ok");
    if (currentAlbumId) renderAlbumScreen();
    else renderAlbumsScreen();
  })();
};
