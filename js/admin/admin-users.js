// js/admin/admin-users.js
import { listUsers, deleteUser, changePin, changeRole, warnUser, unwarnUser }
  from "../core/auth.js";
import { listRoles } from "../core/roles.js";
import { listDivisions } from "../core/divisions.js";
import { getRoleColor, getRoleName, getDivisionColor, getDivisionName }
  from "../core/colorize.js";
import { toast } from "../core/utils.js";
import { raf } from "../core/perf.js";
import {
  setupUsersToolbar, applyFilters, getFilterState,
  updateBulkRow, toggleSort
} from "./admin-users-toolbar.js";
import {
  bulkWarn, bulkUnwarn, bulkChangeDivision, bulkDelete, bulkExport
} from "./admin-users-bulk.js";
import { addAdminLog } from "./admin-log.js";

let renderScheduled = false;
let selectedUids = new Set();
let cachedUsers = [];
let lastFilteredUsers = [];
let toolbarReady = false;

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
export async function initUsersModule() {
  if (!toolbarReady) {
    toolbarReady = true;
    setupUsersToolbar(() => {
      renderUsersTable(true);
    });
    bindGlobalButtons();
  }

  await renderUsersTable(true);
}

function bindGlobalButtons() {
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  };

  on("bulkWarnBtn", () => bulkWarn(Array.from(selectedUids)));
  on("bulkUnwarnBtn", () => bulkUnwarn(Array.from(selectedUids)));
  on("bulkDivisionBtn", () => bulkChangeDivision(Array.from(selectedUids)));
  on("bulkDeleteBtn", () => bulkDelete(Array.from(selectedUids)));
  on("bulkExportBtn", () => bulkExport(Array.from(selectedUids)));
}

// ==================== ОСНОВНОЙ РЕНДЕР ====================
export async function renderUsersTable(force = false) {
  if (renderScheduled) return;
  renderScheduled = true;

  const tbody = document.getElementById("usersTbody");
  if (!tbody) { renderScheduled = false; return; }

  cachedUsers = await listUsers(force);

  raf(() => {
    if (cachedUsers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px;">' +
        'Участников нет. Создайте первого через кнопку «Создать аккаунт».</td></tr>';
      updateBulkRow(0);
      renderScheduled = false;
      return;
    }

    // Применяем фильтры/сортировку
    const filtered = applyFilters(cachedUsers);
    lastFilteredUsers = filtered;

    // Чистим selectedUids от тех, кого больше нет
    const validUids = new Set(filtered.map(u => u.uid));
    selectedUids.forEach(uid => { if (!validUids.has(uid)) selectedUids.delete(uid); });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px;">' +
        'Ничего не найдено по фильтрам.</td></tr>';
      updateBulkRow(0);
      updateHeaderCheckbox();
      renderScheduled = false;
      return;
    }

    const html = filtered.map(u => renderRow(u)).join("");
    tbody.innerHTML = html;

    // Обновляем состояние чекбоксов
    tbody.querySelectorAll(".user-checkbox").forEach(cb => {
      const uid = cb.dataset.uid;
      cb.checked = selectedUids.has(uid);
      cb.addEventListener("change", () => {
        if (cb.checked) selectedUids.add(uid);
        else selectedUids.delete(uid);
        updateBulkRow(selectedUids.size);
        updateHeaderCheckbox();
      });
    });

    updateBulkRow(selectedUids.size);
    updateHeaderCheckbox();

    renderScheduled = false;
  });
}

function renderRow(u) {
  const w = u.warn || 0;
  const banned = u.banned || w >= 3;
  const wCls = banned ? "danger" : w > 0 ? "warn" : "";
  const lockIcon = banned ? " 🔒" : "";
  const muteIcon = u.muted ? " 🔇" : "";
  const banLabel = banned ? '<span style="color:var(--red);font-size:10px;margin-left:6px;">ЗАБАНЕН</span>' : "";

  const roleColor = getRoleColor(u.role);
  const roleName = getRoleName(u.role);
  const divColor = getDivisionColor(u.division);
  const divName = getDivisionName(u.division);

  const plusWBtn = banned
    ? '<button class="btn small secondary" disabled style="opacity:0.4;cursor:not-allowed;">+W</button>'
    : '<button class="btn small secondary" onclick="window.__adminWarn(\'' + u.uid + '\')">+W</button>';

  const lastSeen = formatLastSeen(u.lastSeen);

  return `
    <tr class="${banned ? 'user-banned' : ''}">
      <td class="check-cell">
        <input type="checkbox" class="user-checkbox" data-uid="${u.uid}">
      </td>
      <td><b style="color:#fff;">${escapeHtml(u.login)}</b>${lockIcon}${muteIcon}${banLabel}</td>
      <td><span class="role-badge" style="background:${hexRgba(roleColor,0.15)};color:${roleColor};border:1px solid ${hexRgba(roleColor,0.3)};">${escapeHtml(roleName)}</span></td>
      <td>${u.division ? `<span class="division-badge" style="background:${hexRgba(divColor,0.15)};color:${divColor};border:1px solid ${hexRgba(divColor,0.3)};">${escapeHtml(divName)}</span>` : '<span style="color:#666;font-size:11px;">—</span>'}</td>
      <td class="${wCls}">${w} / 3</td>
      <td class="last-seen-cell">${lastSeen}</td>
      <td>
        <div class="actions">
          <button class="btn small secondary" onclick="window.__adminChangePin('${u.uid}')">PIN</button>
          <button class="btn small secondary" onclick="window.__adminChangeRole('${u.uid}')">Роль</button>
          <button class="btn small secondary" onclick="window.__adminChangeDivision('${u.uid}')">Отряд</button>
          ${plusWBtn}
          <button class="btn small secondary" onclick="window.__adminUnwarn('${u.uid}')">−W</button>
          <button class="btn small danger" onclick="window.__adminDelete('${u.uid}')">✕</button>
        </div>
      </td>
    </tr>
  `;
}

// ==================== HEADER CHECKBOX ====================
function updateHeaderCheckbox() {
  const headerCb = document.getElementById("usersSelectAll");
  if (!headerCb) return;

  const total = lastFilteredUsers.length;
  const selected = lastFilteredUsers.filter(u => selectedUids.has(u.uid)).length;

  if (selected === 0) {
    headerCb.checked = false;
    headerCb.indeterminate = false;
  } else if (selected === total && total > 0) {
    headerCb.checked = true;
    headerCb.indeterminate = false;
  } else {
    headerCb.checked = false;
    headerCb.indeterminate = true;
  }
}

export function bindSelectAll() {
  const headerCb = document.getElementById("usersSelectAll");
  if (!headerCb || headerCb.__bound) return;
  headerCb.__bound = true;

  headerCb.addEventListener("change", () => {
    if (headerCb.checked) {
      lastFilteredUsers.forEach(u => selectedUids.add(u.uid));
    } else {
      selectedUids.clear();
    }
    renderUsersTable(true);
  });

  // Кнопки «Выделить всех» / «Снять выделение» в toolbar
  const selAll = document.getElementById("usersSelectAllBtn");
  const deselAll = document.getElementById("usersDeselectAllBtn");
  if (selAll) selAll.addEventListener("click", () => {
    lastFilteredUsers.forEach(u => selectedUids.add(u.uid));
    renderUsersTable(true);
  });
  if (deselAll) deselAll.addEventListener("click", () => {
    selectedUids.clear();
    renderUsersTable(true);
  });
}

// ==================== ДЕЙСТВИЯ (старые) ====================
window.__adminChangePin = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  const newPin = prompt(`Новый PIN для ${u.login}:`);
  if (newPin === null) return;
  try {
    await changePin(uid, newPin);
    toast("PIN обновлён", "ok");
    addAdminLog("Смена PIN у " + u.login, "ok");
    await renderUsersTable(true);
  } catch (e) { toast(e.message, "warn"); }
};

window.__adminChangeRole = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  const roles = await listRoles();
  const menu = roles.map((r, i) => `${i + 1}. ${r.name}`).join("\n");
  const num = prompt(`Роль для ${u.login}:\n\n${menu}\n\nВведи номер:`, "1");
  if (num === null) return;
  const idx = parseInt(num) - 1;
  if (isNaN(idx) || idx < 0 || idx >= roles.length) return toast("Неверный номер", "warn");
  try {
    await changeRole(uid, roles[idx].id);
    toast("Роль изменена", "ok");
    addAdminLog("Смена роли " + u.login + " → " + roles[idx].name, "ok");
    await renderUsersTable(true);
  } catch (e) { toast(e.message, "warn"); }
};

window.__adminChangeDivision = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  const divisions = await listDivisions();
  const menu = ["0. — без подразделения —", ...divisions.map((d, i) => `${i + 1}. ${d.name}`)].join("\n");
  const num = prompt(`Подразделение для ${u.login}:\n\n${menu}\n\nВведи номер:`, "0");
  if (num === null) return;
  const idx = parseInt(num);
  if (isNaN(idx) || idx < 0 || idx > divisions.length) return toast("Неверный номер", "warn");
  const division = idx === 0 ? null : divisions[idx - 1].id;
  try {
    const { changeDivision } = await import("../core/auth.js");
    await changeDivision(uid, division);
    toast("Подразделение обновлено", "ok");
    addAdminLog("Смена отряда " + u.login, "ok");
    await renderUsersTable(true);
  } catch (e) { toast(e.message, "warn"); }
};

window.__adminWarn = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  const w = u.warn || 0;
  if (w >= 3 || u.banned) return toast(`${u.login} уже забанен`, "warn");
  const reason = prompt(`Причина Warn для ${u.login}:`, "");
  if (reason === null) return;
  try {
    const res = await warnUser(uid, reason.trim());
    toast(res.banned ? `${u.login} ЗАБАНЕН` : `Warn (${res.warn}/3)`, "warn");
    addAdminLog("Warn " + u.login + ": " + reason, "warn");
    await renderUsersTable(true);
  } catch (e) { toast(e.message, "warn"); }
};

window.__adminUnwarn = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  if (!confirm(`Снять Warn с ${u.login}?`)) return;
  try {
    const res = await unwarnUser(uid);
    toast(`Warn снят (${res.warn}/3)`, "ok");
    addAdminLog("Снятие warn у " + u.login, "ok");
    await renderUsersTable(true);
  } catch (e) { toast(e.message, "warn"); }
};

window.__adminDelete = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  if (!confirm(`УДАЛИТЬ ${u.login}?`)) return;
  try {
    await deleteUser(uid);
    toast(`${u.login} удалён`, "ok");
    addAdminLog("Удаление " + u.login, "crit");
    await renderUsersTable(true);
  } catch (e) { toast(e.message, "warn"); }
};

// ==================== ХЕЛПЕРЫ ====================
function formatLastSeen(ts) {
  if (!ts) return '<span style="color:#555;">—</span>';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60 * 1000) return '<span style="color:var(--green);">только что</span>';
  if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + " мин назад";
  if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + " ч назад";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function hexRgba(hex, alpha) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
