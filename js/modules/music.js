// js/modules/music.js
import { db } from "../firebase-init.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { openModal, closeModal, toast, escapeHtml } from "../core/utils.js";
import { canEdit, requireEdit } from "./gestion.js";
import { getCurrentUser } from "../core/state.js";
import { uploadMedia } from "./contracts/contracts-upload.js";

const DEMO_ALBUMS_KEY = "re_demo_music_albums";
const DEMO_TRACKS_KEY = "re_demo_music_tracks";

let albums = [];
let tracks = [];
let currentAlbumId = "all";
let currentTrack = null;

export async function initMusic() {
  const grid = document.getElementById("musicGrid");
  if (!grid) return;

  const toolbar = document.getElementById("musicToolbar");
  if (toolbar && !toolbar.__bound) {
    toolbar.__bound = true;
    if (canEdit()) {
      toolbar.innerHTML =
        '<button class="btn" id="addTrackBtn">+ Добавить трек</button>' +
        '<button class="btn secondary" id="addAlbumBtn" style="margin-left:8px;">+ Создать альбом</button>';
      document.getElementById("addTrackBtn").onclick = () => openTrackModal();
      document.getElementById("addAlbumBtn").onclick = () => openAlbumModal();
    } else {
      toolbar.innerHTML = "";
    }
  }

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
  try { return JSON.parse(localStorage.getItem(DEMO_ALBUMS_KEY) || "[]"); } catch { return []; }
}
function saveDemoAlbums() {
  localStorage.setItem(DEMO_ALBUMS_KEY, JSON.stringify(albums.filter(a => a.source !== "firebase")));
}
function getDemoTracks() {
  try { return JSON.parse(localStorage.getItem(DEMO_TRACKS_KEY) || "[]"); } catch { return []; }
}
function saveDemoTracks() {
  localStorage.setItem(DEMO_TRACKS_KEY, JSON.stringify(tracks.filter(t => t.source !== "firebase")));
}

function renderTabs() {
  const tabsEl = document.getElementById("musicTabs");
  if (!tabsEl) return;
  const editable = canEdit();

  let html = '<button class="music-tab ' + (currentAlbumId === "all" ? "active" : "") + '" onclick="window.__musicTab(\'all\')">' +
    'Все треки (' + tracks.length + ')</button>';

  albums.forEach(a => {
    const count = tracks.filter(t => t.albumId === a.id).length;
    html += '<button class="music-tab ' + (currentAlbumId === a.id ? "active" : "") + '" onclick="window.__musicTab(\'' + a.id + '\')">' +
      a.name + ' (' + count + ')' +
      (editable ? '<span class="tab-del" onclick="event.stopPropagation();window.__musicAlbumDelete(\'' + a.id + '\')">X</span>' : '') +
      '</button>';
  });

  tabsEl.innerHTML = html;
}

window.__musicTab = function(id) {
  currentAlbumId = id;
  renderTabs();
  renderTracks();
};

function renderTracks() {
  const grid = document.getElementById("musicGrid");
  if (!grid) return;

  const filtered = currentAlbumId === "all" ? tracks : tracks.filter(t => t.albumId === currentAlbumId);

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="contracts-empty" style="grid-column:1/-1;">' +
      '<div class="contracts-empty-icon">♪</div>' +
      '<div class="contracts-empty-text">Треков пока нет</div>' +
      '<div class="contracts-empty-sub">Лидер или зам может добавить первый трек</div>' +
      '</div>';
    return;
  }

  const editable = canEdit();

  grid.innerHTML = filtered.map(t => {
    const isCurrent = currentTrack && currentTrack.id === t.id;
    return '<div class="card track-card ' + (isCurrent ? "track-current" : "") + '">' +
      '<div class="track-head">' +
        '<span class="track-icon">♪</span>' +
        '<div style="flex:1;min-width:0;">' +
          '<div class="name">' + escapeHtml(t.title) + '</div>' +
          (t.artist ? '<div class="role">' + escapeHtml(t.artist) + '</div>' : '') +
        '</div>' +
      '</div>' +
      (t.albumName ? '<div class="stat">Альбом: <b>' + escapeHtml(t.albumName) + '</b></div>' : '') +
      '<div class="stat">Добавил: <b>' + escapeHtml(t.addedBy || "—") + '</b></div>' +
      '<div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;">' +
        '<button class="btn small" onclick="window.__musicPlay(\'' + t.id + '\')">Слушать</button>' +
        (editable ? '<button class="btn small secondary" onclick="window.__musicEdit(\'' + t.id + '\')">Ред.</button>' : '') +
        (editable ? '<button class="btn small danger" onclick="window.__musicDelete(\'' + t.id + '\')">Удл.</button>' : '') +
      '</div>' +
    '</div>';
  }).join("");
}

function renderPlayer(track) {
  const player = document.getElementById("musicPlayer");
  if (!player || !track) return;
  currentTrack = track;

  if (!track.url) {
    player.innerHTML = '<div class="contracts-empty" style="padding:20px;"><div class="contracts-empty-text">У трека нет аудиофайла</div></div>';
    return;
  }

  player.innerHTML = '<div class="now-playing-bar">' +
    '<div class="now-playing">Сейчас играет</div>' +
    '<button class="close-player" onclick="window.__musicClosePlayer()">X</button>' +
    '</div>' +
    '<div class="track-info" style="border-top:none;">' +
      '<div class="track-title">' + escapeHtml(track.title) + '</div>' +
      (track.artist ? '<div class="track-artist">' + escapeHtml(track.artist) + '</div>' : '') +
    '</div>' +
    '<audio controls autoplay id="globalAudio" style="width:100%;margin-top:12px;">' +
      '<source src="' + track.url + '">' +
      'Ваш браузер не поддерживает аудио.' +
    '</audio>';

  renderTracks();
  player.scrollIntoView({ behavior: "smooth", block: "start" });

  const audio = document.getElementById("globalAudio");
  if (audio) {
    audio.addEventListener("ended", () => {
      const filtered = currentAlbumId === "all" ? tracks : tracks.filter(t => t.albumId === currentAlbumId);
      const idx = filtered.findIndex(t => t.id === track.id);
      if (idx >= 0 && idx < filtered.length - 1) {
        renderPlayer(filtered[idx + 1]);
      }
    });
  }
}

window.__musicPlay = function(id) {
  const t = tracks.find(x => x.id === id);
  if (t) renderPlayer(t);
};

window.__musicClosePlayer = function() {
  const player = document.getElementById("musicPlayer");
  if (player) player.innerHTML = "";
  const audio = document.getElementById("globalAudio");
  if (audio) audio.pause();
  currentTrack = null;
  renderTracks();
};

function openTrackModal(track) {
  if (!requireEdit()) return;
  const isEdit = !!track;

  openModal({
    title: isEdit ? "РЕДАКТИРОВАТЬ ТРЕК" : "ДОБАВИТЬ ТРЕК",
    html: '<div class="form-grid">' +
      '<div class="form-field"><label>Название</label><input type="text" id="trTitle" value="' + (track ? escapeHtml(track.title) : "") + '" placeholder="Umbrella Theme" autocomplete="off"></div>' +
      '<div class="form-field"><label>Исполнитель</label><input type="text" id="trArtist" value="' + (track ? escapeHtml(track.artist || "") : "") + '" placeholder="Resident Evil OST" autocomplete="off"></div>' +
      '<div class="form-field" style="grid-column:1/-1;"><label>Аудиофайл ' + (isEdit ? '(оставь пустым — не менять)' : '') + '</label><input type="file" id="trFile" accept="audio/*"><div class="form-hint">MP3, WAV, OGG. До 20 МБ. Файл уйдёт в ВК-беседу MUSIC.</div></div>' +
      '<div class="form-field"><label>Альбом</label><select id="trAlbum" class="role-select"><option value="">— без альбома —</option>' + albums.map(a => '<option value="' + a.id + '"' + (track && track.albumId === a.id ? " selected" : "") + '>' + escapeHtml(a.name) + '</option>').join("") + '</select></div>' +
      '</div>' +
      '<div id="trError" style="color:var(--red);font-size:12px;display:none;"></div>',
    confirmText: isEdit ? "СОХРАНИТЬ" : "ДОБАВИТЬ",
    onConfirm: () => saveTrack(track)
  });
  setTimeout(() => document.getElementById("trTitle")?.focus(), 80);
}

async function saveTrack(existing) {
  if (!requireEdit()) return;

  const title = document.getElementById("trTitle").value.trim();
  const artist = document.getElementById("trArtist").value.trim();
  const file = document.getElementById("trFile").files[0];
  const albumId = document.getElementById("trAlbum").value || null;
  const err = document.getElementById("trError");

  err.style.display = "none";
  if (!title) { err.textContent = "Введите название"; err.style.display = "block"; return; }
  if (!existing && !file) { err.textContent = "Выберите аудиофайл"; err.style.display = "block"; return; }

  let url = existing?.url || "";

  if (file) {
    if (file.size > 20 * 1024 * 1024) { err.textContent = "Файл больше 20 МБ"; err.style.display = "block"; return; }

    err.textContent = "Загрузка в ВК...";
    err.style.color = "var(--cyan)";
    err.style.display = "block";

    try {
      const media = await uploadMedia(file, "music", "music", "Трек: " + title, "music");
      url = media.url;
    } catch (e) {
      err.textContent = e.message;
      err.style.color = "var(--red)";
      return;
    }
  }

  const album = albums.find(a => a.id === albumId);
  const me = getCurrentUser();

  const data = {
    title: title,
    artist: artist,
    url: url,
    albumId: albumId,
    albumName: album ? album.name : "",
    addedBy: existing?.addedBy || me?.login || "—",
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
  if (currentTrack?.id === id) {
    currentTrack = null;
    const player = document.getElementById("musicPlayer");
    if (player) player.innerHTML = "";
  }
  renderTabs();
  renderTracks();
  toast("Трек удалён", "ok");
};

function openAlbumModal() {
  if (!requireEdit()) return;
  openModal({
    title: "СОЗДАТЬ АЛЬБОМ",
    html: '<div class="form-grid">' +
      '<div class="form-field"><label>Название альбома</label><input type="text" id="alName" placeholder="Umbrella OST" autocomplete="off"></div>' +
      '<div class="form-field" style="grid-column:1/-1;"><label>Описание</label><input type="text" id="alDesc" placeholder="Сборник треков" autocomplete="off"></div>' +
      '</div><div id="alError" style="color:var(--red);font-size:12px;display:none;"></div>',
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

  const data = { name: name, desc: desc, createdAt: Date.now() };

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

// ✅ Переименовано с __albumDelete, чтобы не конфликтовать с album.js
window.__musicAlbumDelete = async function(id) {
  if (!requireEdit()) return;
  if (!confirm("Удалить альбом? Треки останутся без альбома.")) return;

  try {
    const a = albums.find(x => x.id === id);
    if (a?.source === "firebase") await deleteDoc(doc(db, "music_albums", id));
  } catch (e) {}

  albums = albums.filter(x => x.id !== id);
  tracks.forEach(t => { if (t.albumId === id) { t.albumId = null; t.albumName = ""; } });
  saveDemoAlbums();
  saveDemoTracks();
  if (currentAlbumId === id) currentAlbumId = "all";
  renderTabs();
  renderTracks();
  toast("Альбом удалён", "ok");
};
