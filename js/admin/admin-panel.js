// js/admin/admin-panel.js
import {
  createUser, listUsers, changePin, changeRole, changeDivision,
  warnUser, deleteUser
} from "../core/auth.js";
import { listRoles } from "../core/roles.js";
import { listDivisions } from "../core/divisions.js";
import { renderUsersTable } from "./admin-users.js";
import { initAdminRoles } from "./admin-roles.js";
import { initAdminDivisions } from "./admin-divisions.js";
import { toast, openModal, closeModal } from "../core/utils.js";

let initialized = false;

export async function initAdmin() {
  if (!initialized) {
    initialized = true;
    setupCards();
    addLog("Панель администратора открыта", "ok");
  }
  await initAdminRoles();
  await initAdminDivisions();
  await renderUsersTable(true);
}

function setupCards() {
  const cards = document.querySelectorAll("#admin .card.clickable");
  cards.forEach(card => {
    card.addEventListener("click", () => {
      const action = card.dataset.adminAction;
      if (action === "createUser") openCreateUser();
      else if (action === "changePin") openChangePin();
      else if (action === "changeRole") openChangeRole();
      else if (action === "changeDivision") openChangeDivision();
      else if (action === "warn") openWarn();
      else if (action === "deleteUser") openDeleteUser();
    });
  });
}

// ==================== СОЗДАНИЕ ЮЗЕРА ====================
async function openCreateUser() {
  const roles = await listRoles();
  const divisions = await listDivisions();

  openModal({
    title: "СОЗДАТЬ АККАУНТ",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Логин</label>
          <input type="text" id="newLogin" placeholder="Nick_Name" autocomplete="off">
        </div>
        <div class="form-field">
          <label>PIN (4-8 цифр)</label>
          <input type="text" id="newPin" placeholder="1234" autocomplete="off">
        </div>
        <div class="form-field">
          <label>Роль</label>
          <select id="newRole" class="role-select">
            ${roles.map(r => `<option value="${r.id}">${r.name}</option>`).join("")}
          </select>
        </div>
        <div class="form-field">
          <label>Подразделение</label>
          <select id="newDivision" class="role-select">
            <option value="">— без подразделения —</option>
            ${divisions.map(d => `<option value="${d.id}">${d.name}</option>`).join("")}
          </select>
        </div>
      </div>
      <div id="createUserError" style="color:var(--red);font-size:12px;display:none;"></div>
    `,
    confirmText: "СОЗДАТЬ",
    onConfirm: async () => {
      const login = document.getElementById("newLogin").value.trim();
      const pin = document.getElementById("newPin").value.trim();
      const role = document.getElementById("newRole").value;
      const division = document.getElementById("newDivision").value || null;
      const err = document.getElementById("createUserError");
      try {
        await createUser({ login, pin, role, division });
        toast(`Аккаунт ${login} создан`, "ok");
        addLog(`Создан ${login}`, "ok");
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

// ==================== СМЕНА PIN ====================
async function openChangePin() {
  const users = await listUsers();
  if (!users.length) return toast("Нет участников", "warn");
  openModal({
    title: "СМЕНИТЬ PIN-КОД",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Участник</label>
          <select id="pinUser" class="role-select">
            ${users.map(u => `<option value="${u.uid}">${u.login}</option>`).join("")}
          </select>
        </div>
        <div class="form-field">
          <label>Новый PIN</label>
          <input type="text" id="newPinValue" placeholder="1234" autocomplete="off">
        </div>
      </div>
      <div id="changePinError" style="color:var(--red);font-size:12px;display:none;"></div>
    `,
    confirmText: "СМЕНИТЬ",
    onConfirm: async () => {
      const uid = document.getElementById("pinUser").value;
      const pin = document.getElementById("newPinValue").value.trim();
      const err = document.getElementById("changePinError");
      try {
        await changePin(uid, pin);
        toast("PIN обновлён", "ok");
        addLog(`PIN изменён`, "ok");
        await renderUsersTable(true);
        closeModal();
      } catch (e) {
        err.textContent = e.message;
        err.style.display = "block";
      }
    }
  });
}

// ==================== СМЕНА РОЛИ ====================
async function openChangeRole() {
  const users = await listUsers();
  const roles = await listRoles();
  if (!users.length) return toast("Нет участников", "warn");
  openModal({
    title: "СМЕНИТЬ РОЛЬ",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Участник</label>
          <select id="roleUser" class="role-select">
            ${users.map(u => `<option value="${u.uid}">${u.login}</option>`).join("")}
          </select>
        </div>
        <div class="form-field">
          <label>Новая роль</label>
          <select id="newRoleValue" class="role-select">
            ${roles.map(r => `<option value="${r.id}">${r.name}</option>`).join("")}
          </select>
        </div>
      </div>
      <p style="color:var(--muted);font-size:12px;margin-top:8px;">Все роли настраиваются в «Редактор ролей» выше.</p>
    `,
    confirmText: "СМЕНИТЬ",
    onConfirm: async () => {
      const uid = document.getElementById("roleUser").value;
      const role = document.getElementById("newRoleValue").value;
      try {
        await changeRole(uid, role);
        toast("Роль изменена", "ok");
        addLog(`Роль изменена`, "ok");
        await renderUsersTable(true);
        closeModal();
      } catch (e) { toast(e.message, "warn"); }
    }
  });
}

// ==================== СМЕНА ПОДРАЗДЕЛЕНИЯ ====================
async function openChangeDivision() {
  const users = await listUsers();
  const divisions = await listDivisions();
  if (!users.length) return toast("Нет участников", "warn");
  openModal({
    title: "СМЕНИТЬ ПОДРАЗДЕЛЕНИЕ",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Участник</label>
          <select id="divUser" class="role-select">
            ${users.map(u => `<option value="${u.uid}">${u.login}</option>`).join("")}
          </select>
        </div>
        <div class="form-field">
          <label>Подразделение</label>
          <select id="newDivValue" class="role-select">
            <option value="">— без подразделения —</option>
            ${divisions.map(d => `<option value="${d.id}">${d.name}</option>`).join("")}
          </select>
        </div>
      </div>
    `,
    confirmText: "НАЗНАЧИТЬ",
    onConfirm: async () => {
      const uid = document.getElementById("divUser").value;
      const division = document.getElementById("newDivValue").value || null;
      try {
        await changeDivision(uid, division);
        toast("Подразделение обновлено", "ok");
        addLog(`Подразделение изменено`, "ok");
        await renderUsersTable(true);
        closeModal();
      } catch (e) { toast(e.message, "warn"); }
    }
  });
}

// ==================== WARN ====================
async function openWarn() {
  const users = await listUsers();
  if (!users.length) return toast("Нет участников", "warn");
  openModal({
    title: "ВЫДАТЬ WARN",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Участник</label>
          <select id="warnUserSel" class="role-select">
            ${users.map(u => `<option value="${u.uid}">${u.login} (${u.warn || 0}/3)</option>`).join("")}
          </select>
        </div>
        <div class="form-field">
          <label>Причина</label>
          <input type="text" id="warnReason" placeholder="Нарушение правил" autocomplete="off">
        </div>
      </div>
    `,
    confirmText: "ВЫДАТЬ",
    danger: true,
    onConfirm: async () => {
      const uid = document.getElementById("warnUserSel").value;
      const reason = document.getElementById("warnReason").value.trim();
      try {
        const res = await warnUser(uid, reason);
        if (res.banned) {
          toast(`ЗАБАНЕН (3/3)`, "warn");
          addLog(`Забанен (3/3)`, "crit");
        } else {
          toast(`Warn (${res.warn}/3)`, "warn");
          addLog(`Warn (${res.warn}/3)`, "warn");
        }
        await renderUsersTable(true);
        closeModal();
      } catch (e) { toast(e.message, "warn"); }
    }
  });
}

// ==================== УДАЛЕНИЕ ====================
async function openDeleteUser() {
  const users = await listUsers();
  if (!users.length) return toast("Нет участников", "warn");
  openModal({
    title: "УДАЛИТЬ АККАУНТ",
    html: `
      <div class="form-field">
        <label>Участник</label>
        <select id="deleteUserSel" class="role-select">
          ${users.map(u => `<option value="${u.uid}">${u.login}</option>`).join("")}
        </select>
      </div>
      <p style="color:var(--red);font-size:12px;margin-top:12px;">⚠ Необратимо.</p>
    `,
    confirmText: "УДАЛИТЬ",
    danger: true,
    onConfirm: async () => {
      const uid = document.getElementById("deleteUserSel").value;
      try {
        await deleteUser(uid);
        toast("Удалён", "ok");
        addLog("Аккаунт удалён", "crit");
        await renderUsersTable(true);
        closeModal();
      } catch (e) { toast(e.message, "warn"); }
    }
  });
}

// ==================== ЛОГ ====================
export function addLog(message, type = "info") {
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
  line.innerHTML = `<span class="ts">${ts}</span><span class="${cls}">${message}</span>`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}
