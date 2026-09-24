// js/modules/premiums.js
// Премии — выдача наград участникам (только Лидер и Зам).

import { db } from "../firebase-init.js";
import {
  collection, addDoc, getDocs, doc, deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { openModal, closeModal, toast, escapeHtml, formatDate } from "../core/utils.js";
import { getCurrentUser } from "../core/state.js";
import { listUsers } from "../core/auth.js";
import { playSound } from "../core/sounds.js";
import { addDashEvent } from "../core/dashboard-events.js";

const DEMO_KEY = "re_demo_premiums";
let premiums = [];

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
export async function initPremiums() {
  const grid = document.getElementById("premiumsGrid");
  if (!grid) return;

  bindToolbar();
  await loadAll();
  renderGrid();
}

async function loadAll() {
  try {
    const snap = await getDocs(query(collection(db, "premiums"), orderBy("createdAt", "desc")));
    premiums = snap.docs.map(d => ({ id: d.id, ...d.data(), source: "firebase" }));
  } catch (e) {
    premiums = getDemoPremiums();
  }
  if (premiums.length === 0) premiums = getDemoPremiums();
}

function getDemoPremiums() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); }
  catch { return []; }
}
function saveDemoPremiums() {
  localStorage.setItem(DEMO_KEY, JSON.stringify(premiums.filter(p => p.source !== "firebase")));
}

// ==================== ПРАВА ====================
function canGivePremium() {
  const me = getCurrentUser();
  if (!me) return false;
  return ["emperor", "lord"].includes(me.role);
}

// ==================== TOOLBAR ====================
function bindToolbar() {
  const toolbar = document.getElementById("premiumsToolbar");
  if (!toolbar || toolbar.__bound) return;
  toolbar.__bound = true;
  renderToolbar();
}

function renderToolbar() {
  const toolbar = document.getElementById("premiumsToolbar");
  if (!toolbar) return;

  if (canGivePremium()) {
    toolbar.innerHTML = '<button class="btn" id="addPremiumBtn">🏆 Выдать премию</button>';
    document.getElementById("addPremiumBtn").onclick = () => openPremiumModal();
  } else {
    toolbar.innerHTML = "";
  }
}

// ==================== РЕНДЕР ====================
function renderGrid() {
  const grid = document.getElementById("premiumsGrid");
  if (!grid) return;

  if (premiums.length === 0) {
    grid.innerHTML = '<div class="contracts-empty" style="grid-column:1/-1;">' +
      '<div class="contracts-empty-icon">🏆</div>' +
      '<div class="contracts-empty-text">Премий пока нет</div>' +
      '<div class="contracts-empty-sub">Лидер или зам может выдать первую премию</div>' +
      '</div>';
    return;
  }

  const canDelete = canGivePremium();

  grid.innerHTML = premiums.map(p => {
    return '<div class="card premium-card">' +
      '<div class="premium-head">' +
        '<div class="premium-icon">🏆</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div class="name">' + escapeHtml(p.title || "Премия") + '</div>' +
          '<div class="premium-amount">' + formatMoney(p.amount) + ' ₽</div>' +
        '</div>' +
        (canDelete ? '<button class="btn small danger" onclick="window.__premiumDelete(\'' + p.id + '\')" title="Удалить">✕</button>' : '') +
      '</div>' +
      (p.description ? '<div class="stat">' + escapeHtml(p.description) + '</div>' : '') +
      '<div class="premium-target">' +
        '<span class="premium-target-label">Получил:</span> ' +
        '<span class="premium-target-name">' + escapeHtml(p.targetLogin || "—") + '</span>' +
      '</div>' +
      '<div class="contract-meta">' +
        '<span>👤 Выдал: <b>' + escapeHtml(p.givenBy || "—") + '</b></span>' +
        '<span>📅 ' + formatDate(p.createdAt, "short") + '</span>' +
      '</div>' +
    '</div>';
  }).join("");
}

function formatMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("ru-RU");
}

// ==================== МОДАЛКА ====================
async function openPremiumModal() {
  if (!canGivePremium()) {
    toast("Только Император и Лорд Тьмы могут выдавать премии", "warn");
    return;
  }

  const users = await listUsers(true);
  if (users.length === 0) {
    toast("Нет участников для выдачи", "warn");
    return;
  }

  const userOptions = users
    .sort((a, b) => (a.login || "").localeCompare(b.login || "", "ru"))
    .map(u => '<option value="' + u.uid + '">' + escapeHtml(u.login) + '</option>')
    .join("");

  openModal({
    title: "🏆 ВЫДАТЬ ПРЕМИЮ",
    html:
      '<div class="form-grid">' +
        '<div class="form-field" style="grid-column:1/-1;">' +
          '<label>Название премии</label>' +
          '<input type="text" id="premTitle" placeholder="Например: Лучший боец месяца" autocomplete="off" maxlength="100">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>Сумма, ₽</label>' +
          '<input type="number" id="premAmount" placeholder="50000" min="0" max="10000000">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>Кому (ник из реестра)</label>' +
          '<select id="premTarget" class="role-select">' +
            '<option value="">— выбери участника —</option>' +
            userOptions +
          '</select>' +
        '</div>' +
        '<div class="form-field" style="grid-column:1/-1;">' +
          '<label>Описание премии</label>' +
          '<textarea id="premDesc" placeholder="За что выдаётся..." maxlength="500"></textarea>' +
        '</div>' +
      '</div>' +
      '<div id="premError" style="color:var(--red);font-size:12px;display:none;"></div>',
    confirmText: "ВЫДАТЬ",
    onConfirm: () => savePremium()
  });

  setTimeout(() => document.getElementById("premTitle")?.focus(), 80);
}

async function savePremium() {
  if (!canGivePremium()) return;

  const title = document.getElementById("premTitle").value.trim();
  const amount = parseInt(document.getElementById("premAmount").value) || 0;
  const targetUid = document.getElementById("premTarget").value;
  const description = document.getElementById("premDesc").value.trim();
  const err = document.getElementById("premError");

  err.style.display = "none";

  if (!title) { err.textContent = "Введи название премии"; err.style.display = "block"; return; }
  if (amount <= 0) { err.textContent = "Сумма должна быть больше 0"; err.style.display = "block"; return; }
  if (!targetUid) { err.textContent = "Выбери участника"; err.style.display = "block"; return; }
  if (!description) { err.textContent = "Заполни описание"; err.style.display = "block"; return; }

  const users = await listUsers();
  const target = users.find(u => u.uid === targetUid);
  if (!target) { err.textContent = "Участник не найден"; err.style.display = "block"; return; }

  const me = getCurrentUser();
  const data = {
    title,
    amount,
    description,
    targetUid: target.uid,
    targetLogin: target.login,
    givenBy: me.login,
    givenByUid: me.uid,
    createdAt: Date.now()
  };

  try {
    const ref = await addDoc(collection(db, "premiums"), data);
    premiums.unshift({ id: ref.id, ...data, source: "firebase" });
  } catch (e) {
    premiums.unshift({ id: "demo-prem-" + Date.now(), ...data, source: "demo" });
    saveDemoPremiums();
  }

  playSound("contract");
  addDashEvent("🏆", me.login + " выдал премию " + target.login + " — " + formatMoney(amount) + " ₽", { type: "premium" }).catch(() => {});
  toast("Премия выдана: " + target.login + " — " + formatMoney(amount) + " ₽", "ok");

  renderGrid();
  closeModal();
}

// ==================== УДАЛЕНИЕ ====================
window.__premiumDelete = async function(id) {
  if (!canGivePremium()) return;

  const p = premiums.find(x => x.id === id);
  if (!p) return;

  if (!confirm('Удалить премию «' + p.title + '» для ' + p.targetLogin + '?')) return;

  try {
    if (p.source === "firebase") await deleteDoc(doc(db, "premiums", id));
  } catch (e) {}

  premiums = premiums.filter(x => x.id !== id);
  saveDemoPremiums();
  renderGrid();

  const me = getCurrentUser();
  addDashEvent("🗑", (me?.login || "—") + " удалил премию: " + p.title, { type: "premium" }).catch(() => {});
  toast("Премия удалена", "ok");
};
