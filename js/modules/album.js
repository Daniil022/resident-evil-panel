// js/modules/album.js
import { db } from "../firebase-init.js";
import {
  collection, addDoc, getDocs, doc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { openModal, closeModal, toast } from "../core/utils.js";
import { uploadMedia } from "./contracts/contracts-upload.js";
import { canEdit, requireEdit, escapeHtml, formatDate } from "./gestion.js";
import { getCurrentUser } from "../core/state.js";

const DEMO_KEY = "re_demo_album";
let photos = [];

export async function initAlbum() {
  const grid = document.getElementById("albumGrid");
  if (!grid) return;

  const toolbar = document.getElementById("albumToolbar");
  if (toolbar && !toolbar.__bound) {
    toolbar.__bound = true;
    let html = "";
    if (canEdit()) html += `<button class="btn" id="addPhotoBtn">+ Добавить фото</button>`;
    html += `<button class="btn secondary" id="addLinkBtn" style="margin-left:8px;">🔗 По ссылке</button>`;
    toolbar.innerHTML = html;

    if (canEdit()) document.getElementById("addPhotoBtn").onclick = () => openPhotoModal();
    document.getElementById("addLinkBtn").onclick = () => openLinkModal();
  }

  try {
    const snap = await getDocs(collection(db, "album"));
    photos = snap.docs.map(d => ({ id: d.id, ...d.data(), source: "firebase" }));
  } catch (e) {
    photos = getDemoPhotos();
  }
  if (photos.length === 0) photos = getDemoPhotos();

  renderGrid();
}

function getDemoPhotos() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); }
  catch { return []; }
}
function saveDemoPhotos() {
  localStorage.setItem(DEMO_KEY, JSON.stringify(photos.filter(p => p.source !== "firebase")));
}

function renderGrid() {
  const grid = document.getElementById("albumGrid");
  if (!grid) return;

  if (photos.length === 0) {
    grid.innerHTML = `<div class="contracts-empty" style="grid-column:1/-1;">
      <div class="contracts-empty-icon">📸</div>
      <div class="contracts-empty-text">Фотоальбом пуст</div>
      <div class="contracts-empty-sub">Добавьте первое фото через ВК или по ссылке</div>
    </div>`;
    return;
  }

  const editable = canEdit();

  grid.innerHTML = photos.map(p => `
    <div class="photo-card">
      <img src="${p.url}" alt="${escapeHtml(p.title || "Фото")}" onclick="window.__openMedia('${p.url}','image')">
      <div class="photo-meta">
        ${p.title ? `<div class="photo-title">${escapeHtml(p.title)}</div>` : ""}
        <div class="photo-author">👤 ${escapeHtml(p.addedBy || "—")} · ${formatDate(p.createdAt)}</div>
        ${editable ? `<button class="btn small danger photo-del" onclick="window.__albumDelete('${p.id}')">🗑</button>` : ""}
      </div>
    </div>
  `).join("");
}

function openPhotoModal() {
  if (!requireEdit()) return;

  openModal({
    title: "ДОБАВИТЬ ФОТО (файл)",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Название (опционально)</label>
          <input type="text" id="phTitle" placeholder="Мероприятие 18.09" autocomplete="off">
        </div>
        <div class="form-field" style="grid-column:1/-1;">
          <label>Файл</label>
          <input type="file" id="phFile" accept="image/*">
          <div class="form-hint">Фото уйдёт в ВК-беседу, ссылка сохранится в альбоме</div>
        </div>
      </div>
      <div id="phError" style="color:var(--red);font-size:12px;display:none;"></div>
    `,
    confirmText: "ЗАГРУЗИТЬ",
    onConfirm: () => savePhotoFile()
  });
  setTimeout(() => document.getElementById("phTitle")?.focus(), 80);
}

async function savePhotoFile() {
  if (!requireEdit()) return;

  const title = document.getElementById("phTitle").value.trim();
  const file = document.getElementById("phFile").files[0];
  const err = document.getElementById("phError");

  err.style.display = "none";
  if (!file) { err.textContent = "Выберите файл"; err.style.display = "block"; return; }

  err.textContent = "Загрузка...";
  err.style.color = "var(--cyan)";
  err.style.display = "block";

  try {
    const me = getCurrentUser();
    const media = await uploadMedia(file, "album", me?.login || "album", `📸 Альбом: ${title || file.name}`);

    const data = {
      url: media.url,
      title,
      addedBy: me?.login || "—",
      createdAt: Date.now()
    };

    try {
      const ref = await addDoc(collection(db, "album"), data);
      photos.unshift({ id: ref.id, ...data, source: "firebase" });
    } catch (e) {
      photos.unshift({ id: "demo-ph-" + Date.now(), ...data, source: "demo" });
      saveDemoPhotos();
    }

    toast("Фото добавлено", "ok");
    renderGrid();
    closeModal();
  } catch (e) {
    err.textContent = e.message;
    err.style.color = "var(--red)";
  }
}

function openLinkModal() {
  openModal({
    title: "ДОБАВИТЬ ПО ССЫЛКЕ",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Название (опционально)</label>
          <input type="text" id="lkTitle" placeholder="Мероприятие" autocomplete="off">
        </div>
        <div class="form-field" style="grid-column:1/-1;">
          <label>Ссылка на изображение</label>
          <input type="text" id="lkUrl" placeholder="https://..." autocomplete="off">
        </div>
      </div>
      <div id="lkError" style="color:var(--red);font-size:12px;display:none;"></div>
    `,
    confirmText: "ДОБАВИТЬ",
    onConfirm: () => savePhotoLink()
  });
}

async function savePhotoLink() {
  const title = document.getElementById("lkTitle").value.trim();
  const url = document.getElementById("lkUrl").value.trim();
  const err = document.getElementById("lkError");

  err.style.display = "none";
  if (!url) { err.textContent = "Введите ссылку"; err.style.display = "block"; return; }
  if (!/^https?:\/\//.test(url)) { err.textContent = "Ссылка должна начинаться с http"; err.style.display = "block"; return; }

  const me = getCurrentUser();
  const data = { url, title, addedBy: me?.login || "—", createdAt: Date.now() };

  try {
    const ref = await addDoc(collection(db, "album"), data);
    photos.unshift({ id: ref.id, ...data, source: "firebase" });
  } catch (e) {
    photos.unshift({ id: "demo-ph-" + Date.now(), ...data, source: "demo" });
    saveDemoPhotos();
  }

  toast("Фото добавлено по ссылке", "ok");
  renderGrid();
  closeModal();
}

window.__albumDelete = async function(id) {
  if (!requireEdit()) return;
  if (!confirm("Удалить фото из альбома?")) return;

  const p = photos.find(x => x.id === id);
  if (!p) return;

  try {
    if (p.source === "firebase") await deleteDoc(doc(db, "album", id));
  } catch (e) {}

  photos = photos.filter(x => x.id !== id);
  saveDemoPhotos();
  renderGrid();
  toast("Фото удалено", "ok");
};
