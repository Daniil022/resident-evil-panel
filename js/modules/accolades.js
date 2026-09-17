// js/modules/accolades.js
import { db } from "../firebase-init.js";
import {
  collection, addDoc, getDocs, doc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { openModal, closeModal, toast } from "../core/utils.js";
import { canEdit, requireEdit, escapeHtml } from "./gestion.js";
import { getCurrentUser } from "../core/state.js";

const DEMO_KEY = "re_demo_accolades";
let accolades = [];

export async function initAccolades() {
  const grid = document.getElementById("accoladeGrid");
  if (!grid) return;

  // Toolbar с двумя кнопками: создать + подать заявку
  const toolbar = document.getElementById("accoladeToolbar");
  if (toolbar && !toolbar.__bound) {
    toolbar.__bound = true;
    let html = "";
    if (canEdit()) html += `<button class="btn" id="addAccBtn">+ Создать награду</button>`;
    html += `<button class="btn secondary" id="applyAccBtn" style="margin-left:8px;">📝 Подать заявку на аттестацию</button>`;
    toolbar.innerHTML = html;

    if (canEdit()) {
      document.getElementById("addAccBtn").onclick = () => openAccModal();
    }
    document.getElementById("applyAccBtn").onclick = () => openApplicationModal();
  }

  try {
    const snap = await getDocs(collection(db, "accolades"));
    accolades = snap.docs.map(d => ({ id: d.id, ...d.data(), source: "firebase" }));
  } catch (e) {
    accolades = getDemoAccolades();
  }

  if (accolades.length === 0) accolades = getDemoAccolades();
  renderGrid();
}

function getDemoAccolades() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); }
  catch { return []; }
}
function saveDemoAccolades() {
  localStorage.setItem(DEMO_KEY, JSON.stringify(accolades.filter(a => a.source !== "firebase")));
}

function renderGrid() {
  const grid = document.getElementById("accoladeGrid");
  if (!grid) return;

  if (accolades.length === 0) {
    grid.innerHTML = `<div class="contracts-empty" style="grid-column:1/-1;">
      <div class="contracts-empty-icon">🏅</div>
      <div class="contracts-empty-text">Наград пока нет</div>
      <div class="contracts-empty-sub">Лидер или зам может создать первую награду</div>
    </div>`;
    return;
  }

  const editable = canEdit();

  grid.innerHTML = accolades.map(a => `
    <div class="card">
      <div class="name">🏅 ${escapeHtml(a.title)}</div>
      <div class="role gold">${escapeHtml(a.level || "Награда")}</div>
      <div class="stat">${escapeHtml(a.text || "Без описания")}</div>
      <div class="stat">Получили: <span class="val">${a.holdersCount || 0}</span></div>
      ${editable ? `
        <div style="display:flex;gap:6px;margin-top:12px;">
          <button class="btn small danger" onclick="window.__accDelete('${a.id}')">🗑 Удалить</button>
        </div>
      ` : ""}
    </div>
  `).join("");
}

function openAccModal() {
  if (!requireEdit()) return;

  openModal({
    title: "СОЗДАТЬ НАГРАДУ",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Название</label>
          <input type="text" id="accTitle" placeholder="Легенда T-Virus" autocomplete="off">
        </div>
        <div class="form-field">
          <label>Уровень / метка</label>
          <input type="text" id="accLevel" placeholder="Высшая награда" autocomplete="off">
        </div>
        <div class="form-field" style="grid-column:1/-1;">
          <label>Описание</label>
          <textarea id="accText" placeholder="За что выдаётся..."></textarea>
        </div>
      </div>
      <div id="accError" style="color:var(--red);font-size:12px;display:none;"></div>
    `,
    confirmText: "СОЗДАТЬ",
    onConfirm: () => saveAcc()
  });
  setTimeout(() => document.getElementById("accTitle")?.focus(), 80);
}

async function saveAcc() {
  if (!requireEdit()) return;

  const title = document.getElementById("accTitle").value.trim();
  const level = document.getElementById("accLevel").value.trim();
  const text = document.getElementById("accText").value.trim();
  const err = document.getElementById("accError");

  err.style.display = "none";
  if (!title) { err.textContent = "Введите название"; err.style.display = "block"; return; }

  const data = { title, level, text, holdersCount: 0 };

  try {
    const ref = await addDoc(collection(db, "accolades"), data);
    accolades.push({ id: ref.id, ...data, source: "firebase" });
    toast("Награда создана", "ok");
  } catch (e) {
    accolades.push({ id: "demo-acc-" + Date.now(), ...data, source: "demo" });
    saveDemoAccolades();
    toast("Награда создана (демо)", "ok");
  }
  renderGrid();
  closeModal();
}

window.__accDelete = async function(id) {
  if (!requireEdit()) return;
  if (!confirm("Удалить награду?")) return;
  const a = accolades.find(x => x.id === id);
  if (!a) return;
  try { if (a.source === "firebase") await deleteDoc(doc(db, "accolades", id)); } catch (e) {}
  accolades = accolades.filter(x => x.id !== id);
  saveDemoAccolades();
  renderGrid();
  toast("Удалено", "ok");
};

// ==================== ЗАЯВКА НА АТТЕСТАЦИЮ ====================
function openApplicationModal() {
  const me = getCurrentUser();
  if (!me) return;

  openModal({
    title: "ЗАЯВКА НА АТТЕСТАЦИЮ",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Ник</label>
          <input type="text" id="apNick" value="${escapeHtml(me.login)}" readonly>
        </div>
        <div class="form-field">
          <label>Возраст</label>
          <input type="number" id="apAge" placeholder="18" min="10" max="99">
        </div>
        <div class="form-field">
          <label>Работает голосовой чат (ГС)?</label>
          <select id="apVoice" class="role-select">
            <option value="yes">Да</option>
            <option value="no">Нет</option>
          </select>
        </div>
        <div class="form-field">
          <label>Сколько состоите в симье?</label>
          <input type="text" id="apPeriod" placeholder="Например: с 15 января 2025" autocomplete="off">
        </div>
        <div class="form-field" style="grid-column:1/-1;">
          <label>Готовы понести наказание за нарушение правил?</label>
          <select id="apReady" class="role-select">
            <option value="yes">Да, готов</option>
            <option value="no">Нет, не готов</option>
          </select>
        </div>
        <div class="form-field" style="grid-column:1/-1;">
          <label>Дополнительно (опционально)</label>
          <textarea id="apExtra" placeholder="Что хотите добавить..."></textarea>
        </div>
      </div>
      <div id="apError" style="color:var(--red);font-size:12px;display:none;"></div>
    `,
    confirmText: "ОТПРАВИТЬ",
    onConfirm: () => submitApplication()
  });
}

async function submitApplication() {
  const me = getCurrentUser();

  const nick = document.getElementById("apNick").value.trim();
  const age = parseInt(document.getElementById("apAge").value) || 0;
  const voice = document.getElementById("apVoice").value;
  const period = document.getElementById("apPeriod").value.trim();
  const ready = document.getElementById("apReady").value;
  const extra = document.getElementById("apExtra").value.trim();
  const err = document.getElementById("apError");

  err.style.display = "none";
  if (age < 10 || age > 99) { err.textContent = "Укажите корректный возраст"; err.style.display = "block"; return; }
  if (!period) { err.textContent = "Укажите период в симье"; err.style.display = "block"; return; }

  const data = {
    nick, age, voice, period, ready, extra,
    uid: me.uid,
    role: me.role,
    status: "pending",
    createdAt: Date.now()
  };

  try {
    await addDoc(collection(db, "applications"), data);
    toast("Заявка отправлена. Ожидайте рассмотрения.", "ok");
  } catch (e) {
    // демо
    const demo = JSON.parse(localStorage.getItem("re_demo_applications") || "[]");
    demo.push({ id: "demo-app-" + Date.now(), ...data });
    localStorage.setItem("re_demo_applications", JSON.stringify(demo));
    toast("Заявка отправлена (демо)", "ok");
  }
  closeModal();
}

// ==================== ОДОБРЕНИЕ (вызывается из ADMIN) ====================
export async function approveApplication(appId, note = "") {
  const apps = getApplicationsCache();
  const app = apps.find(a => a.id === appId);
  if (!app) throw new Error("Заявка не найдена");

  try {
    const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await updateDoc(doc(db, "applications", appId), {
      status: "approved",
      approvedAt: Date.now(),
      note
    });
  } catch (e) {
    // демо
    const demo = JSON.parse(localStorage.getItem("re_demo_applications") || "[]");
    const idx = demo.findIndex(a => a.id === appId);
    if (idx >= 0) {
      demo[idx].status = "approved";
      demo[idx].approvedAt = Date.now();
      demo[idx].note = note;
      localStorage.setItem("re_demo_applications", JSON.stringify(demo));
    }
  }
  return app;
}

export async function rejectApplication(appId, reason = "") {
  try {
    const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await updateDoc(doc(db, "applications", appId), {
      status: "rejected",
      rejectedAt: Date.now(),
      reason
    });
  } catch (e) {
    const demo = JSON.parse(localStorage.getItem("re_demo_applications") || "[]");
    const idx = demo.findIndex(a => a.id === appId);
    if (idx >= 0) {
      demo[idx].status = "rejected";
      demo[idx].rejectedAt = Date.now();
      demo[idx].reason = reason;
      localStorage.setItem("re_demo_applications", JSON.stringify(demo));
    }
  }
}

// Кэш заявок для ADMIN
let appsCache = [];
export function setApplicationsCache(list) { appsCache = list; }
export function getApplicationsCache() { return appsCache; }
