// js/admin/admin-panel.js
import { createUser, listUsers, changePin, changeRole, warnUser, deleteUser }
  from "../core/auth.js";
import { addAdminLog } from "./admin-log.js";
import { renderUsersTable } from "./admin-users.js";
import { toast, openModal, closeModal } from "../core/utils.js";

export function initAdmin() {
  setupAdminCards();
  renderUsersTable();
  addAdminLog("Панель администратора открыта", "ok");
}

function setupAdminCards() {
  const cards = document.querySelectorAll("#admin .card.clickable");
  if (!cards.length) return;

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

// ==================== СОЗДАНИЕ ====================
async function openCreateUser() {
  openModal({
    title: "СОЗДАТЬ АККАУНТ",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Логин (Nick_Name)</label>
          <input type="text" id="newLogin" placeholder="Nick_Name" autocomplete="off">
          <div class="form-hint">Латиница, цифры, _ (3-32)</div>
        </div>
        <div class="form-field">
          <label>PIN-код (4-8 цифр)</label>
          <input type="text" id="newPin" placeholder="1234" autocomplete="off">
        </div>
        <div class="form-field">
          <label>Роль</label>
          <select id="newRole">
            <option value="Тёмная душа">Тёмная душа</option>
            <option value="Скелет Ужаса">Скелет Ужаса</option>
            <option value="Рыцарь Смерти">Рыцарь Смерти</option>
            <option value="Лорд Тьмы">Лорд Тьмы</option>
            <option value="Император">Император</option>
          </select>
        </div>
      </div>
      <div id="createUserError" style="color:var(--red); font-size:12px; display:none;"></div>
    `,
    confirmText: "СОЗДАТЬ",
    onConfirm: async () => {
      const login = document.getElementById("newLogin").value.trim();
      const pin = document.getElementById("newPin").value.trim();
      const role = document.getElementById("newRole").value;
      const errorEl = document.getElementById("createUserError");

      errorEl.style.display = "none";

      try {
        await createUser({ login, pin, role });
        toast(`Аккаунт ${login} создан (${role})`, "ok");
        addAdminLog(`Создан аккаунт ${login} с ролью ${role}`, "ok");
        await renderUsersTable();
        closeModal();
      } catch (e) {
        errorEl.textContent = e.message;
        errorEl.style.display = "block";
      }
    }
  });

  // Фокус на первое поле
  setTimeout(() => document.getElementById("newLogin")?.focus(), 100);
}

// ==================== СМЕНА PIN ====================
async function openChangePin() {
  const users = await listUsers();
  if (users.length === 0) {
    toast("Нет участников", "warn");
    return;
  }

  openModal({
    title: "СМЕНИТЬ PIN-КОД",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Участник</label>
          <select id="pinUser">
            ${users.map(u => `<option value="${u.uid}">${u.login} — ${u.role}</option>`).join("")}
          </select>
        </div>
        <div class="form-field">
          <label>Новый PIN (4-8 цифр)</label>
          <input type="text" id="newPinValue" placeholder="1234" autocomplete="off">
        </div>
      </div>
      <div id="changePinError" style="color:var(--red); font-size:12px; display:none;"></div>
    `,
    confirmText: "СМЕНИТЬ",
    onConfirm: async () => {
      const uid = document.getElementById("pinUser").value;
      const newPin = document.getElementById("newPinValue").value.trim();
      const errorEl = document.getElementById("changePinError");
      const user = users.find(u => u.uid === uid);

      errorEl.style.display = "none";

      try {
        await changePin(uid, newPin);
        toast(`PIN ${user.login} обновлён`, "ok");
        addAdminLog(`PIN ${user.login} изменён`, "ok");
        await renderUsersTable();
        closeModal();
      } catch (e) {
        errorEl.textContent = e.message;
        errorEl.style.display = "block";
      }
    }
  });
}

// ==================== СМЕНА РОЛИ ====================
async function openChangeRole() {
  const users = await listUsers();
  if (users.length === 0) {
    toast("Нет участников", "warn");
    return;
  }

  openModal({
    title: "СМЕНИТЬ РОЛЬ",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Участник</label>
          <select id="roleUser">
            ${users.map(u => `<option value="${u.uid}">${u.login} — ${u.role}</option>`).join("")}
          </select>
        </div>
        <div class="form-field">
          <label>Новая роль</label>
          <select id="newRoleValue">
            <option value="Тёмная душа">Тёмная душа</option>
            <option value="Скелет Ужаса">Скелет Ужаса</option>
            <option value="Рыцарь Смерти">Рыцарь Смерти</option>
            <option value="Лорд Тьмы">Лорд Тьмы</option>
            <option value="Император">Император</option>
          </select>
        </div>
      </div>
      <div id="changeRoleError" style="color:var(--red); font-size:12px; display:none;"></div>
    `,
    confirmText: "СМЕНИТЬ",
    onConfirm: async () => {
      const uid = document.getElementById("roleUser").value;
      const newRole = document.getElementById("newRoleValue").value;
      const errorEl = document.getElementById("changeRoleError");
      const user = users.find(u => u.uid === uid);

      errorEl.style.display = "none";

      try {
        await changeRole(uid, newRole);
        toast(`${user.login} → ${newRole}`, "ok");
        addAdminLog(`Роль ${user.login} изменена на ${newRole}`, "ok");
        await renderUsersTable();
        closeModal();
      } catch (e) {
        errorEl.textContent = e.message;
        errorEl.style.display = "block";
      }
    }
  });
}

// ==================== WARN ====================
async function openWarn() {
  const users = await listUsers();
  if (users.length === 0) {
    toast("Нет участников", "warn");
    return;
  }

  openModal({
    title: "ВЫДАТЬ WARN",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Участник</label>
          <select id="warnUserSel">
            ${users.map(u => `<option value="${u.uid}">${u.login} — ${u.role} (Warn: ${u.warn || 0}/3)</option>`).join("")}
          </select>
        </div>
        <div class="form-field">
          <label>Причина (опционально)</label>
          <input type="text" id="warnReason" placeholder="Например: нарушение правил" autocomplete="off">
        </div>
      </div>
      <p style="color:var(--muted); font-size:12px; margin-top:8px;">
        При 3 предупреждениях участник автоматически банится.
      </p>
    `,
    confirmText: "ВЫДАТЬ",
    danger: true,
    onConfirm: async () => {
      const uid = document.getElementById("warnUserSel").value;
      const reason = document.getElementById("warnReason").value.trim();
      const user = users.find(u => u.uid === uid);

      try {
        const newCount = await warnUser(uid, reason);
        if (newCount >= 3) {
          toast(`${user.login} ЗАБАНЕН (3/3 Warn)`, "warn");
          addAdminLog(`⚠ ${user.login} ЗАБАНЕН (3/3 Warn)`, "crit");
        } else {
          toast(`${user.login} получил Warn (${newCount}/3)`, "warn");
          addAdminLog(`${user.login} получил Warn (${newCount}/3) — ${reason || "без причины"}`, "warn");
        }
        await renderUsersTable();
        closeModal();
      } catch (e) {
        toast(e.message, "warn");
      }
    }
  });
}

// ==================== УДАЛЕНИЕ ====================
async function openDelete() {
  const users = await listUsers();
  if (users.length === 0) {
    toast("Нет участников", "warn");
    return;
  }

  openModal({
    title: "УДАЛИТЬ АККАУНТ",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Участник</label>
          <select id="deleteUserSel">
            ${users.map(u => `<option value="${u.uid}">${u.login} — ${u.role}</option>`).join("")}
          </select>
        </div>
      </div>
      <p style="color:var(--red); font-size:12px; margin-top:8px;">
        ⚠ Действие необратимо. Аккаунт будет полностью удалён.
      </p>
    `,
    confirmText: "УДАЛИТЬ",
    danger: true,
    onConfirm: async () => {
      const uid = document.getElementById("deleteUserSel").value;
      const user = users.find(u => u.uid === uid);

      try {
        await deleteUser(uid);
        toast(`${user.login} удалён`, "ok");
        addAdminLog(`Аккаунт ${user.login} удалён`, "crit");
        await renderUsersTable();
        closeModal();
      } catch (e) {
        toast(e.message, "warn");
      }
    }
  });
}

// Экспорт
window.__adminRefresh = renderUsersTable;
