// js/modules/music.js
import { db } from "../firebase-init.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { openModal, closeModal, toast } from "../core/utils.js";
import { canEdit, requireEdit, escapeHtml } from "./gestion.js";
import { getCurrentUser } from "../core/state.js";

const DEMO_ALBUMS_KEY = "re_demo_music_albums";
const DEMO_TRACKS_KEY = "re_demo_music_tracks";

let albums = [];
let tracks = [];
let currentAlbumId = "all"; // "all" или id альбома
let currentTrack = null;

// ==================== ПЛАТФОРМЫ ====================
const PLATFORMS = {
  youtube:    { label: "YouTube",      icon: "▶️",  color: "#ff0000" },
  yandex:     { label: "Yandex Music", icon: "🎵",  color: "#ffcc00" },
  vk:         { label: "VK Audio",     icon: "🎧",  color: "#0077ff" },
  soundcloud: { label: "SoundCloud",   icon: "☁️",  color: "#ff5500" },
  apple:      { label: "Apple Music",  icon: "🍎",  color: "#fa243c" },
  muzofond:   { label: "Muzofond.fm",  icon: "🎼",  color: "#6f42c1" },
  other:      { label: "Ссылка",       icon: "🔗",  color: "#888888" }
};

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
export async function initMusic() {
  const grid = document.getElementById("musicGrid");
  if (!grid) return;

  const toolbar = document.getElementById("musicToolbar");
  if (toolbar && !toolbar.__bound) {
    toolbar.__bound = true;
    if (canEdit()) {
      toolbar.innerHTML = `
        <button class="btn" id="addTrackBtn">+ Добавить трек</button>
        <button class="btn secondary" id="addAlbumBtn" style="margin-left:8px;">+ Создать альбом</button>
      `;
      document.getElementById("addTrackBtn").onclick = () => openTrackModal();
      document.getElementById("addAlbumBtn").onclick = () => openAlbumModal();
    } else {
      toolbar.innerHTML = "";
    }
  }

  // Загрузка данных
  try {
    const albumsSnap = await getDocs(collection(db, "music_albums"));
    albums = albumsSnap.docs.map(d => ({ id: d.id, ...d.data(), source: "firebase" }));

    const tracksSnap = await getDocs(collection(db, "music"));
    tracks = tracksSnap.docs.map(d => ({ id: d.id, ...d.data(), source: "firebase" }));
  } catch (e) {
    albums = getDemoAlbums();
    tracks = getDemoTracks();
  }

  if (albums.length === 0 && tracks.length === 0) {
    albums = getDemoAlbums();
    tracks = getDemoTracks();
  }

  renderTabs();
  renderTracks();
}

function getDemoAlbums() {
  try { return JSON.parse(localStorage.getItem(DEMO_ALBUMS_KEY) || "[]"); }
  catch { return []; }
}
function saveDemoAlbums() {
  localStorage.setItem(DEMO_ALBUMS_KEY, JSON.stringify(albums.filter(a => a.source !== "firebase")));
}
function getDemoTracks() {
  try { return JSON.parse(localStorage.getItem(DEMO_TRACKS_KEY) || "[]"); }
  catch { return []; }
}
function saveDemoTracks() {
  localStorage.setItem(DEMO_TRACKS_KEY, JSON.stringify(tracks.filter(t => t.source !== "firebase")));
}

// ==================== ВКЛАДКИ (Все + Альбомы) ====================
function renderTabs() {
  const tabsEl = document.getElementById("musicTabs");
  if (!tabsEl) return;

  const editable = canEdit();

  let html = `<button class="music-tab ${currentAlbumId === "all" ? "active" : ""}" onclick="window.__musicTab('all')">
    🎼 Все треки (${tracks.length})
  </button>`;

  albums.forEach(a => {
    const count = tracks.filter(t => t.albumId === a.id).length;
    html += `<button class="music-tab ${currentAlbumId === a.id ? "active" : ""}" onclick="window.__musicTab('${a.id}')">
      📁 ${escapeHtml(a.name)} (${count})
      ${editable ? `<span class="tab-del" onclick="event.stopPropagation();window.__albumDelete('${a.id}')">✕</span>` : ""}
    </button>`;
  });

  tabsEl.innerHTML = html;
}

window.__musicTab = function(id) {
  currentAlbumId = id;
  renderTabs();
  renderTracks();
};

// ==================== РЕНДЕР ТРЕКОВ ====================
function renderTracks() {
  const grid = document.getElementById("musicGrid");
  if (!grid) return;

  const filtered = currentAlbumId === "all"
    ? tracks
    : tracks.filter(t => t.albumId === currentAlbumId);

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="contracts-empty" style="grid-column:1/-1;">
      <div class="contracts-empty-icon">🎵</div>
      <div class="contracts-empty-text">Треков пока нет</div>
      <div class="contracts-empty-sub">Лидер или зам может добавить первый трек</div>
    </div>`;
    return;
  }

  const editable = canEdit();

  grid.innerHTML = filtered.map(t => {
    const platform = PLATFORMS[t.platform] || PLATFORMS.other;
    const isCurrent = currentTrack && currentTrack.id === t.id;

    return `
      <div class="card track-card ${isCurrent ? "track-current" : ""}">
        <div class="track-head">
          <span class="track-icon" style="background:${platform.color}22;color:${platform.color};">${platform.icon}</span>
          <div style="flex:1;min-width:0;">
            <div class="name">${escapeHtml(t.title)}</div>
            <div class="role" style="color:${platform.color};">${platform.label}</div>
          </div>
        </div>
        ${t.artist ? `<div class="stat">Исполнитель: <b>${escapeHtml(t.artist)}</b></div>` : ""}
        ${t.albumName ? `<div class="stat">Альбом: <b>${escapeHtml(t.albumName)}</b></div>` : ""}
        <div class="stat">Добавил: <b>${escapeHtml(t.addedBy || "—")}</b></div>
        <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;">
          <button class="btn small" onclick="window.__musicPlay('${t.id}')">▶ Слушать</button>
          ${editable ? `<button class="btn small secondary" onclick="window.__musicEdit('${t.id}')">✏️</button>` : ""}
          ${editable ? `<button class="btn small danger" onclick="window.__musicDelete('${t.id}')">🗑</button>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

// ==================== ПЛЕЕР ====================
function renderPlayer(track) {
  const player = document.getElementById("musicPlayer");
  if (!player || !track) return;
  currentTrack = track;

  const platform = PLATFORMS[track.platform] || PLATFORMS.other;
  let embed = "";

  if (track.platform === "youtube") {
    const vid = extractYouTubeId(track.url);
    const embedUrl = vid ? `https://www.youtube.com/embed/${vid}` : track.url;
    embed = `<iframe width="100%" height="400" src="${embedUrl}" frameborder="0" allowfullscreen style="border-radius:12px;"></iframe>`;
  } else if (track.platform === "soundcloud") {
    embed = `<iframe width="100%" height="166" scrolling="no" frameborder="no" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(track.url)}&color=%2300c8d4&auto_play=true" style="border-radius:12px;"></iframe>`;
  } else {
    // Yandex / VK / Apple / Muzofond / other — открываем во внешнем сервисе
    const platformEmojis = { yandex: "🎵", vk: "🎧", apple: "🍎", muzofond: "🎼", other: "🔗" };
    embed = `
      <div class="music-external">
        <div class="music-external-icon" style="color:${platform.color};font-size:48px;">${platformEmojis[track.platform] || "🔗"}</div>
        <div class="music-external-text">Трек на <b>${platform.label}</b></div>
        <a href="${track.url}" target="_blank" class="btn" style="background:${platform.color};margin-top:16px;">Открыть в ${platform.label}</a>
      </div>`;
  }

  player.innerHTML = `
    <div class="now-playing-bar">
      <div class="now-playing">🎧 Сейчас играет</div>
      <button class="close-player" onclick="window.__musicClosePlayer()">✕</button>
    </div>
    ${embed}
    <div class="track-info">
      <div class="track-title">${escapeHtml(track.title)}</div>
      ${track.artist ? `<div class="track-artist">${escapeHtml(track.artist)}</div>` : ""}
    </div>
  `;

  renderTracks();
  player.scrollIntoView({ behavior: "smooth", block: "start" });
}

window.__musicPlay = function(id) {
  const t = tracks.find(x => x.id === id);
  if (t) renderPlayer(t);
};

window.__musicClosePlayer = function() {
  const player = document.getElementById("musicPlayer");
  if (player) player.innerHTML = "";
  currentTrack = null;
  renderTracks();
};

// ==================== ДОБАВИТЬ ТРЕК ====================
function openTrackModal(track = null) {
  if (!requireEdit()) return;
  const me = getCurrentUser();

  openModal({
    title: track ? "РЕДАКТИРОВАТЬ ТРЕК" : "ДОБАВИТЬ ТРЕК",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Название</label>
          <input type="text" id="trTitle" value="${track ? escapeHtml(track.title) : ""}" placeholder="Umbrella Theme" autocomplete="off">
        </div>
        <div class="form-field">
          <label>Исполнитель (опционально)</label>
          <input type="text" id="trArtist" value="${track ? escapeHtml(track.artist || "") : ""}" placeholder="Resident Evil OST" autocomplete="off">
        </div>
        <div class="form-field" style="grid-column:1/-1;">
          <label>Ссылка на трек</label>
          <input type="text" id="trUrl" value="${track ? escapeHtml(track.url) : ""}" placeholder="https://..." autocomplete="off">
          <div class="form-hint">YouTube, Yandex Music, VK, SoundCloud, Apple Music, Muzofond, любая ссылка</div>
        </div>
        <div class="form-field">
          <label>Платформа</label>
          <select id="trPlatform" class="role-select">
            <option value="auto">Определить автоматически</option>
            ${Object.entries(PLATFORMS).map(([k, v]) =>
              `<option value="${k}" ${track?.platform === k ? "selected" : ""}>${v.label}</option>`
            ).join("")}
          </select>
        </div>
        <div class="form-field">
          <label>Альбом</label>
          <select id="trAlbum" class="role-select">
            <option value="">— без альбома —</option>
            ${albums.map(a => `<option value="${a.id}" ${track?.albumId === a.id ? "selected" : ""}>${escapeHtml(a.name)}</option>`).join("")}
          </select>
        </div>
      </div>
      <div id="trError" style="color:var(--red);font-size:12px;display:none;"></div>
    `,
    confirmText: track ? "СОХРАНИТЬ" : "ДОБАВИТЬ",
    onConfirm: () => saveTrack(track)
  });
  setTimeout(() => document.getElementById("trTitle")?.focus(), 80);
}

async function saveTrack(existing) {
  if (!requireEdit()) return;

  const title = document.getElementById("trTitle").value.trim();
  const artist = document.getElementById("trArtist").value.trim();
  const url = document.getElementById("trUrl").value.trim();
  const platformSel = document.getElementById("trPlatform").value;
  const albumId = document.getElementById("trAlbum").value || null;
  const err = document.getElementById("trError");

  err.style.display = "none";
  if (!title) { err.textContent = "Введите название"; err.style.display = "block"; return; }
  if (!url) { err.textContent = "Введите ссылку"; err.style.display = "block"; return; }

  const platform = platformSel === "auto" ? detectPlatform(url) : platformSel;
  const album = albums.find(a => a.id === albumId);

  let addedBy = existing?.addedBy || "—";
  if (!existing) {
    try { addedBy = getCurrentUser()?.login || "—"; } catch (e) {}
  }

  const data = {
    title, artist, url, platform,
    albumId,
    albumName: album ? album.name : "",
    addedBy,
    createdAt: existing?.createdAt || Date.now(),
    editedAt: Date.now()
  };

  try {
    if (existing?.source === "firebase") {
      await updateDoc(doc(db, "music", existing.id), data);
      Object.assign(existing, data);
    } else {
      const ref = await addDoc(collection(db, "music"), data);
      tracks.unshift({ id: ref.id, ...data, source: "firebase" });
    }
  } catch (e) {
    if (existing) Object.assign(existing, data);
    else tracks.unshift({ id: "demo-mu-" + Date.now(), ...data, source: "demo" });
    saveDemoTracks();
  }

  toast(existing ? "Трек обновлён" : "Трек добавлен", "ok");
  renderTabs();
  renderTracks();
  closeModal();
}

window.__musicEdit = function(id) {
  const t = tracks.find(x => x.id === id);
  if (t) openTrackModal(t);
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
  if (currentTrack?.id === id) currentTrack = null;
  renderTabs();
  renderTracks();
  toast("Трек удалён", "ok");
};

// ==================== АЛЬБОМЫ ====================
function openAlbumModal() {
  if (!requireEdit()) return;

  openModal({
    title: "СОЗДАТЬ АЛЬБОМ",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Название альбома</label>
          <input type="text" id="alName" placeholder="Umbrella OST" autocomplete="off">
        </div>
        <div class="form-field" style="grid-column:1/-1;">
          <label>Описание (опционально)</label>
          <input type="text" id="alDesc" placeholder="Сборник треков" autocomplete="off">
        </div>
      </div>
      <div id="alError" style="color:var(--red);font-size:12px;display:none;"></div>
    `,
    confirmText: "СОЗДАТЬ",
    onConfirm: () => saveAlbum()
  });
  setTimeout(() => document.getElementById("alName")?.focus(), 80);
}

async function saveAlbum() {
  if (!requireEdit()) return;

  const name = document.getElementById("alName").value.trim();
  const desc = document.getElementById("alDesc").value.trim();
  const err = document.getElementById("alError");

  err.style.display = "none";
  if (!name) { err.textContent = "Введите название"; err.style.display = "block"; return; }

  const data = { name, desc, createdAt: Date.now() };

  try {
    const ref = await addDoc(collection(db, "music_albums"), data);
    albums.push({ id: ref.id, ...data, source: "firebase" });
  } catch (e) {
    albums.push({ id: "demo-al-" + Date.now(), ...data, source: "demo" });
    saveDemoAlbums();
  }

  toast("Альбом создан", "ok");
  renderTabs();
  closeModal();
}

window.__albumDelete = async function(id) {
  if (!requireEdit()) return;
  if (!confirm("Удалить альбом? Треки останутся, но без альбома.")) return;

  try {
    const a = albums.find(x => x.id === id);
    if (a?.source === "firebase") await deleteDoc(doc(db, "music_albums", id));
  } catch (e) {}

  albums = albums.filter(x => x.id !== id);

  // Отвязываем треки от удалённого альбома
  tracks.forEach(t => {
    if (t.albumId === id) {
      t.albumId = null;
      t.albumName = "";
    }
  });

  saveDemoAlbums();
  saveDemoTracks();
  if (currentAlbumId === id) currentAlbumId = "all";
  renderTabs();
  renderTracks();
  toast("Альбом удалён", "ok");
};

// ==================== ХЕЛПЕРЫ ====================
function detectPlatform(url) {
  if (!url) return "other";
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("music.yandex")) return "yandex";
  if (u.includes("vk.com/audio") || u.includes("vk.com/music")) return "vk";
  if (u.includes("soundcloud.com")) return "soundcloud";
  if (u.includes("music.apple.com")) return "apple";
  if (u.includes("muzofond.fm")) return "muzofond";
  return "other";
}

function extractYouTubeId(url) {
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return match ? match[1] : null;
}
