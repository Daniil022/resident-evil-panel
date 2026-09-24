// js/modules/allies.js
import { db } from "../firebase-init.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { openModal, closeModal, toast, escapeHtml } from "../core/utils.js";
import { canEdit, requireEdit } from "./gestion.js";
import { getCurrentUser } from "../core/state.js";
import { addDashEvent } from "../core/dashboard-events.js";

const DEMO_KEY = "re_demo_allies";
let allies = [];

const STATUSES = [
  { id: "ally",    label: "Союз",        cls: "ally" },
  { id: "war",     label: "Война",       cls: "danger" },
  { id: "neutral", label: "Нейтралитет", cls: "" }
];

export async function initAllies() {
  const grid = document.getElementById("alliesGrid");
  if (!grid) return;

  const toolbar = document.getElementById("alliesToolbar");
  if (toolbar && !toolbar.__bound) {
    toolbar.__bound = true;
    if (canEdit()) {
      toolbar.innerHTML = `<button class="btn" id="addAllyBtn">+ Добавить фам</button>`;
      document.getElementById("addAllyBtn").onclick = () => openAllyModal();
    } else {
      toolbar.innerHTML = "";
    }
  }

  try {
    const snap = await getDocs(collection(db, "allies"));
    allies = snap.docs.map(d => ({ id: d.id, ...d.data(), source: "firebase" }));
  } catch (e) {
    allies = getDemoAllies();
  }

  if (allies.length === 0) allies = getDemoAllies();
  renderGrid();
}

function getDemoAllies() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); }
  catch { return []; }
}
function saveDemoAllies() {
  localStorage.setItem(DEMO_KEY, JSON.stringify(allies.filter(i => i.source !== "firebase")));
}

function renderGrid() {
  const grid = document.getElementById("alliesGrid");
  if (!grid) return;

  if (allies.length === 0) {
    grid.innerHTML = `<div class="contracts-empty" style="grid-column:1/-1;">
      <div class="contracts-empty-icon">🤝</div>
      <div class="contracts-empty-text">Нет записей</div>
      <div class="contracts-empty-sub">Добавьте союзников, врагов или нейтралов</div>
    </div>`;
    return;
  }

  const editable = canEdit();

  grid.innerHTML = allies.map(a => {
    const st = STATUSES.find(s => s.id === a.status) || STATUSES[2];
    return `
      <div class="card" data-id="${a.id}">
        <div class="name">${escapeHtml(a.name)}</div>
        <div class="role ${st.cls}">${st.label}</div>
        <div class="stat">${escapeHtml(a.note || "Без примечания")}</div>
        ${editable ? `
          <div style="display:flex;gap:6px;margin-top:12px;">
            <button class="btn small secondary" onclick="window.__allyEdit('${a.id}')">✏️</button>
            <button class="btn small danger" onclick="window.__allyDelete('${a.id}')">🗑</button>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

function openAllyModal(ally = null) {
  if (!requireEdit()) return;

  openModal({
    title: ally ? "РЕДАКТИРОВАТЬ" : "ДОБАВИТЬ ФАМ",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Название фамы</label>
          <input type="text" id="alName" value="${ally ? escapeHtml(ally.name) : ""}" placeholder="[ФАМА_Х]" autocomplete="off">
        </div>
        <div class="form-field">
          <label>Статус</label>
          <select id="alStatus" class="role-select">
            ${STATUSES.map(s => `<option value="${s.id}" ${ally?.status === s.id ? "selected" : ""}>${s.label}</option>`).join("")}
          </select>
        </div>
        <div class="form-field" style="grid-column:1/-1;">
          <label>Примечание (опционально)</label>
          <input type="text" id="alNote" value="${ally ? escapeHtml(ally.note || "") : ""}" placeholder="Комментарий" autocomplete="off">
        </div>
      </div>
      <div id="alError" style="color:var(--red);font-size:12px;display:none;"></div>
    `,
    confirmText: ally ? "СОХРАНИТЬ" : "СОЗДАТЬ",
    onConfirm: () => saveAlly(ally)
  });
  setTimeout(() => document.getElementById("alName")?.focus(), 80);
}

async function saveAlly(existing) {
  if (!requireEdit()) return;

  const name = document.getElementById("alName").value.trim();
  const status = document.getElementById("alStatus").value;
  const note = document.getElementById("alNote").value.trim();
  const err = document.getElementById("alError");

  err.style.display = "none";
  if (!name) { err.textContent = "Введите название"; err.style.display = "block"; return; }

  const me = getCurrentUser();
  const data = { name, status, note };
  const statusLabel = STATUSES.find(s => s.id === status)?.label || status;

  try {
    if (existing?.source === "firebase") {
      await updateDoc(doc(db, "allies", existing.id), data);
      Object.assign(existing, data);
      addDashEvent("✏️", (me?.login || "—") + " изменил статус фамы " + name + " → " + statusLabel, { type: "allies" }).catch(() => {});
    } else {
      const ref = await addDoc(collection(db, "allies"), data);
      allies.push({ id: ref.id, ...data, source: "firebase" });
      addDashEvent("🤝", (me?.login || "—") + " добавил фаму " + name + " (" + statusLabel + ")", { type: "allies" }).catch(() => {});
    }
    toast(existing ? "Обновлено" : "Добавлено", "ok");
  } catch (e) {
    if (existing) Object.assign(existing, data);
    else allies.push({ id: "demo-al-" + Date.now(), ...data, source: "demo" });
    saveDemoAllies();
    toast("Готово (демо)", "ok");
  }
  renderGrid();
  closeModal();
}

window.__allyEdit = function(id) {
  const a = allies.find(x => x.id === id);
  if (a) openAllyModal(a);
};

window.__allyDelete = async function(id) {
  if (!requireEdit()) return;
  if (!confirm("Удалить?")) return;
  const a = allies.find(x => x.id === id);
  if (!a) return;
  try { if (a.source === "firebase") await deleteDoc(doc(db, "allies", id)); } catch (e) {}
  allies = allies.filter(x => x.id !== id);
  saveDemoAllies();
  renderGrid();

  const me = getCurrentUser();
  addDashEvent("🗑", (me?.login || "—") + " удалил фаму " + a.name, { type: "allies" }).catch(() => {});
  toast("Удалено", "ok");
};
