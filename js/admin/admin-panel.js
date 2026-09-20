// js/admin/admin-panel.js
import {
  createUser, listUsers, changePin, changeRole, changeDivision,
  warnUser, deleteUser
} from "../core/auth.js";
import { listRoles } from "../core/roles.js";
import { listDivisions } from "../core/divisions.js";
import { initUsersModule, bindSelectAll, renderUsersTable } from "./admin-users.js";
import { initAdminRoles } from "./admin-roles.js";
import { initAdminDivisions } from "./admin-divisions.js";
import { initLogsView } from "./admin-logs-view.js";
import { initBackupsView } from "./admin-backups-view.js";
import { initImportExport, exportAll, openImportModal, resetDemoData } from "./admin-import-export.js";
import { checkAutoBackup } from "../core/backup-manager.js";
import { downloadBackup as downloadBackupLegacy, openRestoreModal } from "../modules/backup.js";
import { toast, openModal, closeModal } from "../core/utils.js";
import { ADMIN_SECTIONS } from "./admin-sections.js";

let initialized = false;
let currentSection = null;

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
export async function initAdmin() {
  if (!initialized) {
    initialized = true;
    addLog("Панель администратора открыта", "ok");
  }

  renderAdminHome();
  goToSection(null, false);
}

// ==================== ГЛАВНЫЙ ЭКРАН ====================
function renderAdminHome() {
  const grid = document.getElementById("adminSectionsGrid");
  if (!grid) return;

  grid.innerHTML = ADMIN_SECTIONS.map(s =>
    '<div class="card clickable admin-section-card" data-section="' + s.id + '">' +
      '<div class="admin-section-icon">' + s.icon + '</div>' +
      '<div class="name">' + s.title + '</div>' +
      '<div class="role ' + (s.role || "") + '">Раздел</div>' +
      '<div class="stat">' + s.desc + '</div>' +
    '</div>'
  ).join("");

  grid.querySelectorAll(".admin-section-card").forEach(card => {
    card.addEventListener("click", () => goToSection(card.dataset.section));
  });
}

// ==================== НАВИГАЦИЯ ====================
async function goToSection(sectionId, scroll = true) {
  currentSection = sectionId;

  const home = document.getElementById("adminHome");
  const sections = document.querySelectorAll(".admin-section-view");

  if (!sectionId) {
    // Показать главный экран
    if (home) home.style.display = "block";
    sections.forEach(el => { el.style.display = "none"; });
    return;
  }

  // Скрыть главный, показать нужный
  if (home) home.style.display = "none";
  sections.forEach(el => {
    el.style.display = (el.dataset.sectionView === sectionId) ? "block" : "none";
  });

  // Скролл к началу
  if (scroll) {
    document.getElementById("admin")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Ленивая инициализация раздела
  try {
    if (sectionId === "users") {
      await initUsersSection();
    } else if (sectionId === "roles") {
      await initAdminRoles();
    } else if (sectionId === "divisions") {
      await initAdminDivisions();
    } else if (sectionId === "registry") {
      await initRegistrySection();
    } else if (sectionId === "history") {
      await initLogsView();
    } else if (sectionId === "cloud") {
      await initBackupsView();
    } else if (sectionId === "backup") {
      initImportExport();
    }
  } catch (e) {
    console.warn("Section init failed:", sectionId, e);
  }
}

window.__adminBack = function() {
  goToSection(null);
};

window.__adminSection = function(id) {
  goToSection(id);
};

// ==================== РАЗДЕЛ: УПРАВЛЕНИЕ ====================
function initUsersSection() {
  const grid = document.getElementById("adminUsersGrid");
  if (!grid || grid.__bound) return;
  grid.__bound = true;

  const cards = [
    { action: "createUser",   name: "Создать аккаунт",        role: "gold",   desc: "Завести нового участника" },
    { action: "changePin",    name: "Сменить PIN",            role: "",       desc: "Изменить PIN участника" },
    { action: "changeRole",   name: "Сменить роль",           role: "",       desc: "Перевести на другую должность" },
    { action: "changeDivision", name: "Сменить подразделение", role: "blue",  desc: "Назначить в отряд" },
    { action: "warn",         name: "Выдать Warn",            role: "danger", desc: "Предупреждение участнику" },
    { action: "deleteUser",   name: "Удалить аккаунт",        role: "danger", desc: "Полное удаление" }
  ];

  grid.innerHTML = cards.map(c =>
    '<div class="card clickable" data-action="' + c.action + '">' +
      '<div class="name">' + c.name + '</div>' +
      '<div class="role ' + c.role + '">Действие</div>' +
      '<div class="stat">' + c.desc + '</div>' +
    '</div>'
  ).join("");

  grid.querySelectorAll(".card.clickable").forEach(card => {
    card.addEventListener("click", () => {
      const a = card.dataset.action;
      if (a === "createUser") openCreateUser();
      else if (a === "changePin") openChangePin();
      else if (a === "changeRole") openChangeRole();
      else if (a === "changeDivision") openChangeDivision();
      else if (a === "warn") openWarn();
      else if (a === "deleteUser") openDeleteUser();
    });
  });
}

// ==================== РАЗДЕЛ: РЕЕСТР ====================
async function initRegistrySection() {
  await initUsersModule();
  bindSelectAll();
}

// ==================== СТАРЫЕ ФУНКЦИИ (создание и т.д.) ====================
async function openCreateUser() {
  const roles = await listRoles();
  const divisions = await listDivisions();

  openModal({
    title: "СОЗДАТЬ АККАУНТ",
    html: '<div class="form-grid">' +
      '<div class="form-field"><label>Логин</label><input type="text" id="newLogin" placeholder="Nick_Name" autocomplete="off"></div>' +
      '<div class="form-field"><label>PIN (4-8 цифр)</label><input type="text" id="newPin" placeholder="1234" autocomplete="off"></div>' +
      '<div class="form-field"><label>Роль</label><select id="newRole" class="role-select">' + roles.map(r => '<option value="' + r.id + '">' + r.name + '</option>').join("") + '</select></div>' +
      '<div class="form-field"><label>Подразделение</label><select id="newDivision" class="role-select"><option value="">— без подразделения —</option>' + divisions.map(d => '<option value="' + d.id + '">' + d.name + '</option>').join("") + '</select></div>' +
      '</div>' +
      '<div id="createUserError" style="color:var(--red);font-size:12px;display:none;"></div>',
    confirmText: "СОЗДАТЬ",
    onConfirm: async () => {
      const login = document.getElementById("newLogin").value.trim();
      const pin = document.getElementById("newPin").value.trim();
      const role = document.getElementById("newRole").value;
      const division = document.getElementById("newDivision").value || null;
      const err = document.getElementById("createUserError");
      try {
        const created = await createUser({ login, pin, role, division });
        toast("Аккаунт " + login + " создан", "ok");
        addLog("Создан " + login, "ok", { target: created.uid, targetLogin: login, type: "create" });
        await renderUsersTable(true);
        closeModal();
      } catch (e) {
        err.textContent = e.message;
        err.style.display = "block";
      }
    }
  });
  setTimeout(() => document.getElementById("newLogin")?.focus(), 80);
}

async function openChangePin() {
  const users = await listUsers();
  if (!users.length) return toast("Нет участников", "warn");
  openModal({
    title: "СМЕНИТЬ PIN-КОД",
    html: '<div class="form-grid">' +
      '<div class="form-field"><label>Участник</label><select id="pinUser" class="role-select">' + users.map(u => '<option value="' + u.uid + '">' + u.login + '</option>').join("") + '</select></div>' +
      '<div class="form-field"><label>Новый PIN</label><input type="text" id="newPinValue" placeholder="1234" autocomplete="off"></div>' +
      '</div><div id="changePinError" style="color:var(--red);font-size:12px;display:none;"></div>',
    confirmText: "СМЕНИТЬ",
    onConfirm: async () => {
      const uid = document.getElementById("pinUser").value;
      const pin = document.getElementById("newPinValue").value.trim();
      const err = document.getElementById("changePinError");
      try {
        await changePin(uid, pin);
        toast("PIN обновлён", "ok");
        await renderUsersTable(true);
        closeModal();
      } catch (e) {
        err.textContent = e.message;
        err.style.display = "block";
      }
    }
  });
}

async function openChangeRole() {
  const users = await listUsers();
  const roles = await listRoles();
  if (!users.length) return toast("Нет участников", "warn");
  openModal({
    title: "СМЕНИТЬ РОЛЬ",
    html: '<div class="form-grid">' +
      '<div class="form-field"><label>Участник</label><select id="roleUser" class="role-select">' + users.map(u => '<option value="' + u.uid + '">' + u.login + '</option>').join("") + '</select></div>' +
      '<div class="form-field"><label>Новая роль</label><select id="newRoleValue" class="role-select">' + roles.map(r => '<option value="' + r.id + '">' + r.name + '</option>').join("") + '</select></div>' +
      '</div>',
    confirmText: "СМЕНИТЬ",
    onConfirm: async () => {
      const uid = document.getElementById("roleUser").value;
      const role = document.getElementById("newRoleValue").value;
      try {
        await changeRole(uid, role);
        toast("Роль изменена", "ok");
        await renderUsersTable(true);
        closeModal();
      } catch (e) { toast(e.message, "warn"); }
    }
  });
}

async function openChangeDivision() {
  const users = await listUsers();
  const divisions = await listDivisions();
  if (!users.length) return toast("Нет участников", "warn");
  openModal({
    title: "СМЕНИТЬ ПОДРАЗДЕЛЕНИЕ",
    html: '<div class="form-grid">' +
      '<div class="form-field"><label>Участник</label><select id="divUser" class="role-select">' + users.map(u => '<option value="' + u.uid + '">' + u.login + '</option>').join("") + '</select></div>' +
      '<div class="form-field"><label>Подразделение</label><select id="newDivValue" class="role-select"><option value="">— без подразделения —</option>' + divisions.map(d => '<option value="' + d.id + '">' + d.name + '</option>').join("") + '</select></div>' +
      '</div>',
    confirmText: "НАЗНАЧИТЬ",
    onConfirm: async () => {
      const uid = document.getElementById("divUser").value;
      const division = document.getElementById("newDivValue").value || null;
      try {
        await changeDivision(uid, division);
        toast("Подразделение обновлено", "ok");
        await renderUsersTable(true);
        closeModal();
      } catch (e) { toast(e.message, "warn"); }
    }
  });
}

async function openWarn() {
  const users = await listUsers();
  if (!users.length) return toast("Нет участников", "warn");
  openModal({
    title: "ВЫДАТЬ WARN",
    html: '<div class="form-grid">' +
      '<div class="form-field"><label>Участник</label><select id="warnUserSel" class="role-select">' + users.map(u => '<option value="' + u.uid + '">' + u.login + ' (' + (u.warn || 0) + '/3)</option>').join("") + '</select></div>' +
      '<div class="form-field"><label>Причина</label><input type="text" id="warnReason" placeholder="Нарушение правил" autocomplete="off"></div>' +
      '</div>',
    confirmText: "ВЫДАТЬ",
    danger: true,
    onConfirm: async () => {
      const uid = document.getElementById("warnUserSel").value;
      const reason = document.getElementById("warnReason").value.trim();
      try {
        const res = await warnUser(uid, reason);
        toast(res.banned ? "ЗАБАНЕН (3/3)" : "Warn (" + res.warn + "/3)", "warn");
        await renderUsersTable(true);
        closeModal();
      } catch (e) { toast(e.message, "warn"); }
    }
  });
}

async function openDeleteUser() {
  const users = await listUsers();
  if (!users.length) return toast("Нет участников", "warn");
  openModal({
    title: "УДАЛИТЬ АККАУНТ",
    html: '<div class="form-field"><label>Участник</label><select id="deleteUserSel" class="role-select">' + users.map(u => '<option value="' + u.uid + '">' + u.login + '</option>').join("") + '</select></div>' +
      '<p style="color:var(--red);font-size:12px;margin-top:12px;">⚠ Необратимо.</p>',
    confirmText: "УДАЛИТЬ",
    danger: true,
    onConfirm: async () => {
      const uid = document.getElementById("deleteUserSel").value;
      try {
        await deleteUser(uid);
        toast("Удалён", "ok");
        await renderUsersTable(true);
        closeModal();
      } catch (e) { toast(e.message, "warn"); }
    }
  });
}

// ==================== ЛОГ ====================
export function addLog(message, type = "info", opts = {}) {
  const log = document.getElementById("adminLog");
  if (!log) return;
  const now = new Date();
  const ts = "[" +
    String(now.getHours()).padStart(2, "0") + ":" +
    String(now.getMinutes()).padStart(2, "0") + ":" +
    String(now.getSeconds()).padStart(2, "0") +
  "]";
  const line = document.createElement("div");
  line.className = "log-line";
  const cls = type === "ok" ? "ok" : type === "warn" ? "warn" : type === "crit" ? "crit" : "";
  line.innerHTML = '<span class="ts">' + ts + '</span><span class="' + cls + '">' + message + '</span>';
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;

  import("../core/activity-log.js").then(m => {
    m.logAction(opts.type || type, message, {
      target: opts.target || null,
      targetLogin: opts.targetLogin || null
    });
  }).catch(() => {});
}

// ==================== ЭКСПОРТЫ ДЛЯ ИМПОРТА В ДРУГИХ МОДУЛЯХ ====================
export { exportAll, openImportModal, resetDemoData };
