// js/admin/admin-panel.js
import { createUser, listUsers, changePin, changeRole, warnUser, deleteUser, VALID_ROLES, WARN_LIMIT }
  from "../core/auth.js";
import { renderUsersTable } from "./admin-users.js";
import { toast, openModal, closeModal } from "../core/utils.js";

let initialized = false;

export function initAdmin() {
  if (initialized) {
    renderUsersTable(true);
    return;
  }
  initialized = true;
  setupCards();
  renderUsersTable();
  addLog("Панель администратора открыта", "ok");
}

function setupCards() {
  const cards = document.querySelectorAll("#admin .card.clickable");
  cards.forEach((card, idx) => {
    card.addEventListener("click", () => {
      if (idx === 0) openCreateUser();
      else if (idx === 1) openChangePin();
      else if (idx === 2) openChangeRole();
      else if (idx === 3) openWarn();
      else if (idx === 4) openDelete();
    });
  });
}

async function openCreateUser() {
  openModal({
    title: "СОЗДАТЬ АККАУНТ",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Логин (Nick_Name)</label>
          <input type="text" id="newLogin" placeholder="Nick_Name" autocomplete="off">
        </div>
        <div class="form-field">
          <label>PIN-код (4-8 цифр)</label>
          <input type="text" id="newPin" placeholder="1234" autocomplete="off">
        </div>
        <div class="form-field">
          <label>Роль</label>
          <select id="newRole">
            ${VALID_ROLES.slice().reverse().map(r => `<option value="${r}">${r}</option>`).join("")}
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
      const err = document.getElementById("createUserError");
      try {
        await createUser({ login, pin, role });
        toast(`Аккаунт ${login} создан`, "ok");
        addLog(`Создан ${login} (${role})`, "ok");
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
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Участник</label>
          <select id="pinUser">${users.map(u => `<option value="${u.uid}">${u.login} — ${u.role}</option>`).join("")}</select>
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
      const u = users.find(x => x.uid === uid);
      try {
        await changePin(uid, pin);
        toast(`PIN ${u.login} обновлён`, "ok");
        addLog(`PIN ${u.login} изменён`, "ok");
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
  if (!users.length) return toast("Нет участников", "warn");
  openModal({
    title: "СМЕНИТЬ РОЛЬ",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Участник</label>
          <select id="roleUser">${users.map(u => `<option value="${u.uid}">${u.login} — ${u.role}</option>`).join("")}</select>
        </div>
        <div class="form-field">
          <label>Новая роль</label>
          <select id="newRoleValue">${VALID_ROLES.slice().reverse().map(r => `<option value="${r}">${r}</option>`).join("")}</select>
        </div>
      </div>
    `,
    confirmText: "СМЕНИТЬ",
    onConfirm: async () => {
      const uid = document.getElementById("roleUser").value;
      const role = document.getElementById("newRoleValue").value;
      const u = users.find(x => x.uid === uid);
      try {
        await changeRole(uid, role);
        toast(`${u.login} → ${role}`, "ok");
        addLog(`Роль ${u.login} → ${role}`, "ok");
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
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Участник</label>
          <select id="warnUserSel">
            ${users.map(u => `<option value="${u.uid}">${u.login} (${u.warn || 0}/${WARN_LIMIT})</option>`).join("")}
          </select>
        </div>
        <div class="form-field">
          <label>Причина</label>
          <input type="text" id="warnReason" placeholder="Нарушение правил" autocomplete="off">
        </div>
      </div>
      <p style="color:var(--muted);font-size:12px;">При ${WARN_LIMIT} Warn — автобан.</p>
    `,
    confirmText: "ВЫДАТЬ",
    danger: true,
    onConfirm: async () => {
      const uid = document.getElementById("warnUserSel").value;
      const reason = document.getElementById("warnReason").value.trim();
      const u = users.find(x => x.uid === uid);
      try {
        const res = await warnUser(uid, reason);
        if (res.banned) {
          toast(`${u.login} ЗАБАНЕН (${res.warn}/${WARN_LIMIT})`, "warn");
          addLog(`⚠ ${u.login} ЗАБАНЕН (${res.warn}/${WARN_LIMIT})`, "crit");
        } else {
          toast(`${u.login} — Warn (${res.warn}/${WARN_LIMIT})`, "warn");
          addLog(`${u.login} Warn (${res.warn}/${WARN_LIMIT})`, "warn");
        }
        await renderUsersTable(true);
        closeModal();
      } catch (e) { toast(e.message, "warn"); }
    }
  });
}

async function openDelete() {
  const users = await listUsers();
  if (!users.length) return toast("Нет участников", "warn");
  openModal({
    title: "УДАЛИТЬ АККАУНТ",
    html: `
      <div class="form-field">
        <label>Участник</label>
        <select id="deleteUserSel">${users.map(u => `<option value="${u.uid}">${u.login} — ${u.role}</option>`).join("")}</select>
      </div>
      <p style="color:var(--red);font-size:12px;margin-top:12px;">⚠ Необратимо.</p>
    `,
    confirmText: "УДАЛИТЬ",
    danger: true,
    onConfirm: async () => {
      const uid = document.getElementById("deleteUserSel").value;
      const u = users.find(x => x.uid === uid);
      try {
        await deleteUser(uid);
        toast(`${u.login} удалён`, "ok");
        addLog(`Удалён ${u.login}`, "crit");
        await renderUsersTable(true);
        closeModal();
      } catch (e) { toast(e.message, "warn"); }
    }
  });
}

export function addLog(message, type = "info") {
  const log = document.getElementById("adminLog");
  if (!log) return;
 
