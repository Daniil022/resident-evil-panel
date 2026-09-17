// js/modules/music.js
import { db } from "../firebase-init.js";
import {
  collection, addDoc, getDocs, doc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { openModal, closeModal, toast } from "../core/utils.js";
import { canEdit, requireEdit, escapeHtml } from "./gestion.js";

const DEMO_KEY = "re_demo_music";
let tracks = [];

// Платформы
const PLATFORMS = {
  youtube:   { label: "YouTube",     icon: "▶️",  color: "#ff0000" },
  yandex:    { label: "Yandex Music", icon: "🎵",  color: "#ffcc00" },
  vk:        { label: "VK Audio",    icon: "🎧",  color: "#0077ff" },
  soundcloud:{ label: "SoundCloud",  icon: "☁️",  color: "#ff5500" },
  other:     { label: "Ссылка",      icon: "🔗",  color: "#888888" }
};

export async function initMusic() {
  const grid = document.getElementById("musicGrid");
  const player = document.getElementById("musicPlayer");
  if (!grid) return;

  const toolbar = document.getElementById("musicToolbar");
  if (toolbar && !toolbar.__bound) {
    toolbar.__bound = true;
    if (canEdit()) {
      toolbar.innerHTML = `<button class="btn" id="addTrackBtn">+ Добавить трек</button>`;
      document.getElementById("addTrackBtn").onclick = () => openTrackModal();
    } else {
      toolbar.innerHTML = "";
    }
  }

  try {
    const snap = await getDocs(collection(db, "music"));
    tracks = snap.docs.map(d => ({ id: d.id, ...d.data(), source: "firebase" }));
  } catch (e) {
    tracks = getDemoTracks();
  }
  if (tracks.length === 0) tracks = getDemoTracks();

  renderGrid();
  if (player && tracks.length > 0) renderPlayer(tracks[0]);
}

function getDemoTracks() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); }
  catch { return []; }
}
function saveDemoTracks() {
  localStorage.setItem(DEMO_KEY, JSON.stringify(tracks.filter(t => t.source !== "firebase")));
}

function detectPlatform(url) {
  if (!url) return "other";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("music.yandex")) return "yandex";
  if (url.includes("vk.com/audio") || url.includes("vk.com/music")) return "vk";
  if (url.includes("soundcloud.com")) return "soundcloud";
  return "other";
}

function renderGrid() {
  const grid = document.getElementById("musicGrid");
  if (!grid) return;

  if (tracks.length === 0) {
    grid.innerHTML = `<div class="contracts-empty" style="grid-column:1/-1;">
      <div class="contracts-empty-icon">🎵</div>
      <div class="contracts-empty-text">Треков пока нет</div>
      <div class="contracts-empty-sub">Лидер или зам может добавить первый трек</div>
    </div>`;
    return;
  }

  const editable = canEdit();

  grid.innerHTML = tracks.map(t => {
    const platform = PLATFORMS[t.platform] || PLATFORMS.other;
    return `
      <div class="card track-card">
        <div class="track-head">
          <span class="track-icon" style="background:${platform.color}22;color:${platform.color};">${platform.icon}</span>
          <div style="flex:1;min-width:0;">
            <div class="name">${escapeHtml(t.title)}</div>
            <div class="role" style="color:${platform.color};">${platform.label}</div>
          </div>
        </div>
        ${t.artist ? `<div class="stat">Исполнитель: <b>${escapeHtml(t.artist)}</b></div>` : ""}
        <div class="stat">Добавил: <b>${escapeHtml(t.addedBy || "—")}</b></div>
        <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;">
          <button class="btn small" onclick="window.__musicPlay('${t.id}')">▶ Слушать</button>
          <a href="${t.url}" target="_blank" class="btn small secondary">Открыть</a>
          ${editable ? `<button class="btn small danger" onclick="window.__musicDelete('${t.id}')">🗑</button>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function renderPlayer(track) {
  const player = document.getElementById("musicPlayer");
  if (!player || !track) return;

  const platform = PLATFORMS[track.platform] || PLATFORMS.other;
  let embed = "";
  let embedUrl = track.url;

  // YouTube embed
  if (track.platform === "youtube") {
    const vid = extractYouTubeId(track.url);
    if (vid) embedUrl = `https://www.youtube.com/embed/${vid}`;
    embed = `<iframe width="100%" height="360" src="${embedUrl}" frameborder="0" allowfullscreen style="border-radius:12px;"></iframe>`;
  }
  // SoundCloud embed
  else if (track.platform === "soundcloud") {
    embed = `<iframe width="100%" height="166" scrolling="no" frameborder="no" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(track.url)}&color=%2300c8d4&auto_play=false" style="border-radius:12px;"></iframe>`;
  }
  // Yandex
  else if (track.platform === "yandex") {
    embed = `<div class="music-external">
      <div class="music-external-icon" style="color:${platform.color};">${platform.icon}</div>
      <div class="music-external-text">Трек на <b>Яндекс.Музыке</b></div>
      <a href="${track.url}" target="_blank" class="btn">Открыть в Yandex Music</a>
    </div>`;
  }
  // VK
  else if (track.platform === "vk") {
    embed = `<div class="music-external">
      <div class="music-external-icon" style="color:${platform.color};">${platform.icon}</div>
      <div class="music-external-text">Трек в <b>VK Audio</b></div>
      <a href="${track.url}" target="_blank" class="btn">Открыть в VK</a>
    </div>`;
  }
  // Other
  else {
    embed = `<div class="music-external">
      <div class="music-external-text">Внешняя ссылка</div>
      <a href="${track.url}" target="_blank" class="btn">Открыть</a>
    </div>`;
  }

  player.innerHTML = `
    <div class="now-playing-bar">
      <div class="now-playing">🎧 Сейчас играет</div>
    </div>
    ${embed}
    <div class="track-info">
      <div class="track-title">${escapeHtml(track.title)}</div>
      ${track.artist ? `<div class="track-artist">${escapeHtml(track.artist)}</div>` : ""}
    </div>
  `;

  // Скролл к плееру
  player.scrollIntoView({ behavior: "smooth", block: "start" });
}

function extractYouTubeId(url) {
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return match ? match[1] : null;
}

function openTrackModal() {
  if (!requireEdit()) return;
  const me = require("../core/state.js");

  openModal({
    title: "ДОБАВИТЬ ТРЕК",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Название</label>
          <input type="text" id="trTitle" placeholder="Umbrella Theme" autocomplete="off">
        </div>
        <div class="form-field">
          <label>Исполнитель (опционально)</label>
          <input type="text" id="trArtist" placeholder="Resident Evil OST" autocomplete="off">
        </div>
        <div class="form-field" style="grid-column:1/-1;">
          <label>Ссылка на трек</label>
          <input type="text" id="trUrl" placeholder="https://www.youtube.com/watch?v=..." autocomplete="off">
          <div class="form-hint">Поддерживается: YouTube, Yandex Music, VK Audio, SoundCloud, любая ссылка</div>
        </div>
        <div class="form-field" style="grid-column:1/-1;">
          <label>Платформа</label>
          <select id="trPlatform" class="role-select">
            <option value="auto">Определить автоматически</option>
            <option value="youtube">YouTube</option>
            <option value="yandex">Yandex Music</option>
            <option value="vk">VK Audio</option>
            <option value="soundcloud">SoundCloud</option>
            <option value="other">Другое</option>
          </select>
        </div>
      </div>
      <div id="trError" style="color:var(--red);font-size:12px;display:none;"></div>
    `,
    confirmText: "ДОБАВИТЬ",
    onConfirm: () => saveTrack()
  });
  setTimeout(() => document.getElementById("trTitle")?.focus(), 80);
}

async function saveTrack() {
  if (!requireEdit()) return;

  const title = document.getElementById("trTitle").value.trim();
  const artist = document.getElementById("trArtist").value.trim();
  const url = document.getElementById("trUrl").value.trim();
  const platformSel = document.getElementById("trPlatform").value;
  const err = document.getElementById("trError");

  err.style.display = "none";
  if (!title) { err.textContent = "Введите название"; err.style.display = "block"; return; }
  if (!url) { err.textContent = "Введите ссылку"; err.style.display = "block"; return; }

  const platform = platformSel === "auto" ? detectPlatform(url) : platformSel;

  let addedBy = "—";
  try {
    const { getCurrentUser } = await import("../core/state.js");
    addedBy = getCurrentUser()?.login || "—";
  } catch (e) {}

  const data = { title, artist, url, platform, addedBy, createdAt: Date.now() };

  try {
    const ref = await addDoc(collection(db, "music"), data);
    tracks.unshift({ id: ref.id, ...data, source: "firebase" });
  } catch (e) {
    tracks.unshift({ id: "demo-mu-" + Date.now(), ...data, source: "demo" });
    saveDemoTracks();
  }

  toast("Трек добавлен", "ok");
  renderGrid();
  closeModal();
}

window.__musicPlay = function(id) {
  const t = tracks.find(x => x.id === id);
  if (t) renderPlayer(t);
};

window.__musicDelete = async function(id) {
  if (!requireEdit()) return;
  if (!confirm("Удалить трек?")) return;

  const t = tracks.find(x => x.id === id);
  if (!t) return;

  try {
    if (t.source === "firebase") await deleteDoc(doc(db, "music", id));
  } catch (e) {}

  tracks = tracks.filter(x => x.id !== id);
  saveDemoTracks();
  renderGrid();
  toast("Трек удалён", "ok");
};
