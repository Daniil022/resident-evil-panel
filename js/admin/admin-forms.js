// js/admin/admin-forms.js
import { VALID_ROLES } from "../core/auth.js";

// Форма создания аккаунта
export function createUserForm() {
  return `
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
          ${VALID_ROLES.map(r => `<option value="${r}">${r}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="form-hint" id="createUserError" style="color:var(--red); display:none;"></div>
  `;
}

// Форма смены PIN
export function changePinForm(users) {
  return `
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
    <div class="form-hint" id="changePinError" style="color:var(--red); display:none;"></div>
  `;
}

// Форма смены роли
export function changeRoleForm(users) {
  return `
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
          ${VALID_ROLES.map(r => `<option value="${r}">${r}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="form-hint" id="changeRoleError" style="color:var(--red); display:none;"></div>
  `;
}

// Форма Warn
export function warnForm(users) {
  return `
    <div class="form-grid">
      <div class="form-field">
        <label>Участник</label>
        <select id="warnUser">
          ${users.map(u => `<option value="${u.uid}">${u.login} — ${u.role} (Warn: ${u.warn || 0})</option>`).join("")}
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
  `;
}

// Форма удаления
export function deleteUserForm(users) {
  return `
    <div class="form-grid">
      <div class="form-field">
        <label>Участник для удаления</label>
        <select id="deleteUser">
          ${users.map(u => `<option value="${u.uid}">${u.login} — ${u.role}</option>`).join("")}
        </select>
      </div>
    </div>
    <p style="color:var(--red); font-size:12px; margin-top:8px;">
      ⚠ Действие необратимо. Участник будет полностью удалён из системы.
    </p>
  `;
}
