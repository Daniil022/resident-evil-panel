// js/modules/captas.js
import { db } from "../firebase-init.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { openModal, closeModal, toast, escapeHtml, formatDate } from "../core/utils.js";
import { canEdit, requireEdit } from "./gestion.js";
import { getCurrentUser } from "../core/state.js";
import { addDashEvent } from "../core/dashboard-events.js";

const DEMO_KEY = "re_demo_captas";
let captas = [];

const STATUSES = [
  { id: "open",       label: "Открыт",        cls: "green" },
  { id: "in_progress", label: "В работе",      cls: "gold" },
  { id: "closed",     label: "Закрыт",        cls: "red" },
  { id: "urgent",     label: "Срочно",        cls: "danger" }
];

export async function initCaptas() {
  const grid = document.getElementById("captasGrid");
  if (!grid) return;

  const toolbar = document.getElementById("captasToolbar");
  if (toolbar && !toolbar.__bound) {
    toolbar.__bound = true;
    if (canEdit()) {
      toolbar.innerHTML = `<button class="btn" id="addCaptaBtn">+ Добавить новость</button>`;
      document.getElementById("addCaptaBtn").onclick = () => openCaptaModal();
    } else {
      toolbar.innerHTML = "";
    }
  }

  try {
    const snap = await getDocs(collection(db, "captas"));
    captas = snap.docs.map(d => ({ id: d.id, ...d.data(), source: "firebase" }));
  } catch (e) {
    captas = getDemoCaptas();
  }
  if (captas.length === 0) captas = getDemoCaptas();

  captas.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  renderGrid();
}

function getDemoCaptas() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); }
  catch { return []; }
}
function saveDemoCaptas() {
  localStorage.setItem(DEMO_KEY, JSON.stringify(captas.filter(c => c.source !== "firebase")));
}

function renderGrid() {
  const grid = document.getElementById("captasGrid");
  if (!grid) return;

  if (captas.length === 0) {
    grid.innerHTML = `<div class="contracts-empty" style="grid-column:1/-1;">
      <div class="contracts-empty-icon">📢</div>
      <div class="contracts-empty-text">Новостей пока нет</div>
      <div class="contracts-empty-sub">Лидер или зам может добавить первую новость</div>
    </div>`;
    return;
  }

  const editable = canEdit();

  grid.innerHTML = captas.map(c => {
    const st = STATUSES.find(s => s.id === c.status) || STATUSES[0];
    return `
      <div class="card" style="border-left-color:${c.status === "urgent" ? "var(--red)" : c.status === "closed" ? "var(--muted)" : "var(--cyan)"};">
        <div class="contract-head">
          <div>
            <div class="name">${escapeHtml(c.title)}</div>
            ${c.target ? `<div class="role">🎯 ${escapeHtml(c.target)}</div>` : ""}
          </div>
          <span class="contract-status ${st.cls}">${st.label}</span>
        </div>
        <div class="stat">${escapeHtml(c.text)}</div>
        <div class="contract-meta">
          <span>👤 ${escapeHtml(c.authorLogin || "—")}</span>
          <span>📅 ${formatDate(c.createdAt, "short")}</span>
        </div>
        ${editable ? `
          <div style="display:flex;gap:6px;margin-top:12px;">
            <button class="btn small secondary" onclick="window.__captaEdit('${c.id}')">✏️ Изменить</button>
            <button class="btn small danger" onclick="window.__captaDelete('${c.id}')">🗑 Удалить</button>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

function openCaptaModal(capta = null) {
  if (!requireEdit()) return;

  openModal({
    title: capta ? "РЕДАКТИРОВАТЬ НОВОСТЬ" : "НОВАЯ НОВОСТЬ",
    html: `
      <div class="form-grid">
        <div class="form-field" style="grid-column:1/-1;">
          <label>Заголовок</label>
          <input type="text" id="cpTitle" value="${capta ? escapeHtml(capta.title) : ""}" placeholder="Например: Сбор на ивент в 20:00" autocomplete="off">
        </div>
        <div class="form-field">
          <label>Цель / кому (опционально)</label>
          <input type="text" id="cpTarget" value="${capta ? escapeHtml(capta.target || "") : ""}" placeholder="Всем бойцам" autocomplete="off">
        </div>
        <div class="form-field">
          <label>Статус</label>
          <select id="cpStatus" class="role-select">
            ${STATUSES.map(s => `<option value="${s.id}" ${capta?.status === s.id ? "selected" : ""}>${s.label}</option>`).join("")}
          </select>
        </div>
        <div class="form-field" style="grid-column:1/-1;">
          <label>Текст новости</label>
          <textarea id="cpText" placeholder="Что произошло / что планируется...">${capta ? escapeHtml(capta.text) : ""}</textarea>
        </div>
      </div>
      <div id="cpError" style="color:var(--red);font-size:12px;display:none;"></div>
    `,
    confirmText: capta ? "СОХРАНИТЬ" : "СОЗДАТЬ",
    onConfirm: () => saveCapta(capta)
  });
  setTimeout(() => document.getElementById("cpTitle")?.focus(), 80);
}

async function saveCapta(existing) {
  if (!requireEdit()) return;

  const title = document.getElementById("cpTitle").value.trim();
  const target = document.getElementById("cpTarget").value.trim();
  const status = document.getElementById("cpStatus").value;
  const text = document.getElementById("cpText").value.trim();
  const err = document.getElementById("cpError");

  err.style.display = "none";
  if (!title) { err.textContent = "Введите заголовок"; err.style.display = "block"; return; }
  if (!text) { err.textContent = "Введите текст новости"; err.style.display = "block"; return; }

  const me = getCurrentUser();
  const data = {
    title, target, status, text,
    authorLogin: existing?.authorLogin || me?.login || "—",
    createdAt: existing?.createdAt || Date.now(),
    editedAt: Date.now()
  };

  try {
    if (existing?.source === "firebase") {
      await updateDoc(doc(db, "captas", existing.id), data);
      Object.assign(existing, data);
      addDashEvent("✏️", me.login + " отредактировал новость: " + title, { type: "news" }).catch(() => {});
    } else {
      const ref = await addDoc(collection(db, "captas"), data);
      captas.unshift({ id: ref.id, ...data, source: "firebase" });
      addDashEvent("📢", me.login + " добавил новость: " + title, { type: "news" }).catch(() => {});
    }
    toast(existing ? "Новость обновлена" : "Новость создана", "ok");
  } catch (e) {
    if (existing) Object.assign(existing, data);
    else captas.unshift({ id: "demo-cp-" + Date.now(), ...data, source: "demo" });
    saveDemoCaptas();
    addDashEvent(existing ? "✏️" : "📢", (me?.login || "—") + " " + (existing ? "обновил" : "добавил") + " новость: " + title, { type: "news" }).catch(() => {});
    toast("Готово (демо)", "ok");
  }
  renderGrid();
  closeModal();
}

window.__captaEdit = function(id) {
  const c = captas.find(x => x.id === id);
  if (c) openCaptaModal(c);
};

window.__captaDelete = async function(id) {
  if (!requireEdit()) return;
  if (!confirm("Удалить новость?")) return;

  const c = captas.find(x => x.id === id);
  if (!c) return;

  try {
    if (c.source === "firebase") await deleteDoc(doc(db, "captas", id));
  } catch (e) {}

  captas = captas.filter(x => x.id !== id);
  saveDemoCaptas();
  renderGrid();

  const me = getCurrentUser();
  addDashEvent("🗑", (me?.login || "—") + " удалил новость: " + c.title, { type: "news" }).catch(() => {});
  toast("Новость удалена", "ok");
};
