// js/admin/admin-users.js
import { listUsers, deleteUser, changePin, changeRole, warnUser, unwarnUser }
  from "../core/auth.js";
import { listRoles } from "../core/roles.js";
import { listDivisions } from "../core/divisions.js";
import { getRoleColor, getRoleName, getDivisionColor, getDivisionName }
  from "../core/colorize.js";
import { toast, openModal, closeModal } from "../core/utils.js";
import { raf } from "../core/perf.js";
import { getCurrentUser } from "../core/state.js";
import { addDashEvent } from "../core/dashboard-events.js";
import {
  setupUsersToolbar, applyFilters, updateBulkRow
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

  on("bulkMuteBtn", async () => {
    const { bulkMute } = await import("./admin-users-bulk.js");
    bulkMute(Array.from(selectedUids));
  });
  on("bulkBanBtn", async () => {
    const { bulkBan } = await import("./admin-users-bulk.js");
    bulkBan(Array.from(selectedUids));
  });
  on("bulkUnbanBtn", async () => {
    const { bulkUnban } = await import("./admin-users-bulk.js");
    bulkUnban(Array.from(selectedUids));
  });
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
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px;">' +
        'Участников нет. Создайте первого через кнопку «Создать аккаунт».</td></tr>';
      updateBulkRow(0);
      renderScheduled = false;
      return;
    }

    const filtered = applyFilters(cachedUsers);
    lastFilteredUsers = filtered;

    const validUids = new Set(filtered.map(u => u.uid));
    selectedUids.forEach(uid => { if (!validUids.has(uid)) selectedUids.delete(uid); });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px;">' +
        'Ничего не найдено по фильтрам.</td></tr>';
      updateBulkRow(0);
      updateHeaderCheckbox();
      renderScheduled = false;
      return;
    }

    const html = filtered.map(u => renderRow(u)).join("");
    tbody.innerHTML = html;

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
  const muted = u.muted && (!u.mutedUntil || Date.now() < u.mutedUntil);
  const wCls = banned ? "danger" : w > 0 ? "warn" : "";
  const lockIcon = banned ? " 🔒" : "";
  const muteIcon = muted ? " 🔇" : "";
  const banLabel = banned ? '<span style="color:var(--red);font-size:10px;margin-left:6px;">ЗАБАНЕН</span>' : "";

  const roleColor = getRoleColor(u.role);
  const roleName = getRoleName(u.role);
  const divColor = getDivisionColor(u.division);
  const divName = getDivisionName(u.division);

  const plusWBtn = banned
    ? '<button class="btn small secondary" disabled style="opacity:0.4;cursor:not-allowed;">+W</button>'
    : '<button class="btn small secondary" onclick="window.__adminWarn(\'' + u.uid + '\')">+W</button>';

  const muteBtn = muted
    ? '<button class="btn small" style="background:var(--gold);color:#001417;" onclick="window.__adminUnmute(\'' + u.uid + '\')" title="Снять мут">🔊</button>'
    : '<button class="btn small secondary" onclick="window.__adminMute(\'' + u.uid + '\')" title="Замутить">🔇</button>';

  const banBtn = banned
    ? '<button class="btn small" style="background:var(--green);color:#001417;" onclick="window.__adminUnban(\'' + u.uid + '\')" title="Разбанить">🔓</button>'
    : '<button class="btn small danger" onclick="window.__adminBan(\'' + u.uid + '\')" title="Забанить">🔒</button>';

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
          ${muteBtn}
          ${banBtn}
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
}

// ==================== СТАРЫЕ ДЕЙСТВИЯ ====================
window.__adminChangePin = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  const newPin = prompt(`Новый PIN для ${u.login}:`);
  if (newPin === null) return;
  try {
    await changePin(uid, newPin);
    toast("PIN обновлён", "ok");
    addAdminLog("Смена PIN у " + u.login, "ok", { target: u.uid, targetLogin: u.login });

    const me = getCurrentUser();
    addDashEvent("🔑", `${me?.login || "—"} сменил PIN у ${u.login}`, { type: "user" }).catch(() => {});

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
    addAdminLog("Смена роли " + u.login + " → " + roles[idx].name, "ok", { target: u.uid, targetLogin: u.login, type: "role" });

    const me = getCurrentUser();
    addDashEvent("🎖", `${me?.login || "—"} сменил роль ${u.login} → ${roles[idx].name}`, { type: "user" }).catch(() => {});

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
    addAdminLog("Смена отряда " + u.login, "ok", { target: u.uid, targetLogin: u.login, type: "division" });

    const me = getCurrentUser();
    const divName = division ? divisions[idx - 1].name : "без отряда";
    addDashEvent("🎯", `${me?.login || "—"} сменил отряд ${u.login} → ${divName}`, { type: "user" }).catch(() => {});

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
    addAdminLog("Warn " + u.login + ": " + reason, "warn", { target: u.uid, targetLogin: u.login, type: "warn" });

    const me = getCurrentUser();
    addDashEvent("⚠", `${me?.login || "—"} выдал warn ${u.login}${reason ? ": " + reason : ""}`, { type: "user" }).catch(() => {});
    if (res.banned) {
      addDashEvent("🔒", `${u.login} автоматически забанен (3/3)`, { type: "user" }).catch(() => {});
    }

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
    addAdminLog("Снятие warn у " + u.login, "ok", { target: u.uid, targetLogin: u.login, type: "unwarn" });

    const me = getCurrentUser();
    addDashEvent("↻", `${me?.login || "—"} снял warn с ${u.login}`, { type: "user" }).catch(() => {});

    await renderUsersTable(true);
  } catch (e) { toast(e.message, "warn"); }
};

window.__adminDelete = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  if (!confirm(`УДАЛИТЬ ${u.login}?`)) return;
  try {
    addAdminLog("Удаление " + u.login, "crit", { target: u.uid, targetLogin: u.login, type: "delete" });
    await deleteUser(uid);
    toast(`${u.login} удалён`, "ok");

    const me = getCurrentUser();
    addDashEvent("🗑", `${me?.login || "—"} удалил аккаунт ${u.login}`, { type: "user" }).catch(() => {});

    await renderUsersTable(true);
  } catch (e) { toast(e.message, "warn"); }
};

// ==================== MUTE ====================
window.__adminMute = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;

  openModal({
    title: "ЗАМУТИТЬ " + u.login,
    html:
      '<div class="form-grid">' +
        '<div class="form-field"><label>Длительность</label>' +
          '<select id="muteDuration" class="role-select">' +
            '<option value="0">Навсегда</option>' +
            '<option value="3600000">1 час</option>' +
            '<option value="21600000">6 часов</option>' +
            '<option value="86400000">1 день</option>' +
            '<option value="604800000">7 дней</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-field"><label>Причина</label><input type="text" id="muteReason" placeholder="Например: спам в чате" autocomplete="off"></div>' +
      '</div>',
    confirmText: "ЗАМУТИТЬ",
    danger: true,
    onConfirm: async () => {
      const duration = parseInt(document.getElementById("muteDuration").value) || 0;
      const reason = document.getElementById("muteReason").value.trim();
      try {
        const { muteUser } = await import("../core/punishments.js");
        await muteUser(uid, duration, reason);
        toast(u.login + " замучен" + (duration ? " на " + formatDuration(duration) : " навсегда"), "warn");
        addAdminLog("Мут " + u.login + ": " + reason, "warn", { target: u.uid, targetLogin: u.login, type: "mute" });

        const me = getCurrentUser();
        addDashEvent("🔇", `${me?.login || "—"} замутил ${u.login}${reason ? ": " + reason : ""}`, { type: "user" }).catch(() => {});

        await renderUsersTable(true);
        closeModal();
      } catch (e) { toast(e.message, "warn"); }
    }
  });
};

window.__adminUnmute = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  if (!confirm("Снять мут с " + u.login + "?")) return;
  try {
    const { unmuteUser } = await import("../core/punishments.js");
    await unmuteUser(uid, "Ручное снятие");
    toast("Мут снят", "ok");
    addAdminLog("Снятие мута " + u.login, "ok", { target: u.uid, targetLogin: u.login, type: "unmute" });

    const me = getCurrentUser();
    addDashEvent("🔊", `${me?.login || "—"} снял мут с ${u.login}`, { type: "user" }).catch(() => {});

    await renderUsersTable(true);
  } catch (e) { toast(e.message, "warn"); }
};

// ==================== BAN ====================
window.__adminBan = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;

  openModal({
    title: "ЗАБАНИТЬ " + u.login,
    html:
      '<div class="form-grid">' +
        '<div class="form-field"><label>Длительность</label>' +
          '<select id="banDuration" class="role-select">' +
            '<option value="0">Навсегда</option>' +
            '<option value="3600000">1 час</option>' +
            '<option value="21600000">6 часов</option>' +
            '<option value="86400000">1 день</option>' +
            '<option value="604800000">7 дней</option>' +
            '<option value="2592000000">30 дней</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-field"><label>Причина</label><input type="text" id="banReason" placeholder="Например: нарушение правил" autocomplete="off"></div>' +
      '</div>' +
      '<p style="color:var(--red);font-size:12px;margin-top:12px;">⚠ Аккаунт будет заблокирован до истечения срока или до ручного разбана.</p>',
    confirmText: "ЗАБАНИТЬ",
    danger: true,
    onConfirm: async () => {
      const duration = parseInt(document.getElementById("banDuration").value) || 0;
      const reason = document.getElementById("banReason").value.trim();
      try {
        const { banUser } = await import("../core/punishments.js");
        await banUser(uid, duration, reason);
        toast(u.login + " забанен" + (duration ? " на " + formatDuration(duration) : " навсегда"), "warn");
        addAdminLog("Бан " + u.login + ": " + reason, "crit", { target: u.uid, targetLogin: u.login, type: "ban" });

        const me = getCurrentUser();
        addDashEvent("🔒", `${me?.login || "—"} забанил ${u.login}${reason ? ": " + reason : ""}`, { type: "user" }).catch(() => {});

        await renderUsersTable(true);
        closeModal();
      } catch (e) { toast(e.message, "warn"); }
    }
  });
};

window.__adminUnban = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  if (!confirm("Разбанить " + u.login + "?\n\nWarn будет сброшен в 0.")) return;
  try {
    const { unbanUser } = await import("../core/punishments.js");
    await unbanUser(uid, "Ручной разбан");
    toast(u.login + " разбанен", "ok");
    addAdminLog("Разбан " + u.login, "ok", { target: u.uid, targetLogin: u.login, type: "unban" });

    const me = getCurrentUser();
    addDashEvent("🔓", `${me?.login || "—"} разбанил ${u.login}`, { type: "user" }).catch(() => {});

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

function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return h + " ч " + (m > 0 ? m + " мин" : "");
  if (m > 0) return m + " мин";
  return (total % 60) + " сек";
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

window.__usersSort = function(field) {
  import("./admin-users-toolbar.js").then(m => m.toggleSort(field));
};
