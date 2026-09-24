// js/admin/admin-roles.js
import {
  listRoles, createRole, updateRole, deleteRole, moveRole
} from "../core/roles.js";
import { clearRoleFromUsers } from "../core/auth.js";
import { toast, openModal, closeModal } from "../core/utils.js";
import { preloadColorData, applyColorsToDOM } from "../core/colorize.js";
import { getCurrentUser } from "../core/state.js";
import { addDashEvent } from "../core/dashboard-events.js";

let editingRoleId = null;

export async function initAdminRoles() {
  await renderRolesList();
  const addBtn = document.getElementById("addRoleBtn");
  if (addBtn && !addBtn.__bound) {
    addBtn.__bound = true;
    addBtn.addEventListener("click", openCreateRoleModal);
  }
}

async function renderRolesList() {
  const container = document.getElementById("rolesList");
  if (!container) return;

  const roles = await listRoles(true);

  if (roles.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--muted);padding:40px;">Ролей нет</div>`;
    return;
  }

  container.innerHTML = roles.map((r, idx) => {
    // Считаем права
    let permsLabel = "по умолчанию";
    let permsColor = "var(--muted)";
    if (r.permissions === "*") {
      permsLabel = "ВСЕ";
      permsColor = "var(--gold)";
    } else if (Array.isArray(r.permissions)) {
      permsLabel = r.permissions.length + " шт.";
      permsColor = "var(--cyan)";
    }

    return `
    <div class="role-row" data-role-id="${r.id}">
      <div class="role-color-dot" style="background:${r.color};"></div>
      <div class="role-info">
        <div class="name">
          ${escapeHtml(r.name)}
          ${r.system ? `<span class="badge-system">Системная</span>` : ""}
        </div>
        <div class="desc">${escapeHtml(r.desc || "Без описания")}</div>
        <div class="desc" style="font-size:10.5px;color:${permsColor};">🔐 Права: ${permsLabel}</div>
      </div>
      <div class="role-actions">
        <button onclick="window.__roleMove('${r.id}','up')" ${idx === 0 ? "disabled" : ""} title="Вверх">⬆</button>
        <button onclick="window.__roleMove('${r.id}','down')" ${idx === roles.length - 1 ? "disabled" : ""} title="Вниз">⬇</button>
        <button onclick="window.__rolePermissions('${r.id}')" title="Права">🔐</button>
        <button onclick="window.__roleEdit('${r.id}')" title="Редактировать">✏️</button>
        <button class="danger" onclick="window.__roleDelete('${r.id}')" ${r.system ? "disabled" : ""} title="${r.system ? "Системную роль нельзя удалить" : "Удалить"}">🗑</button>
      </div>
    </div>
  `;
  }).join("");
}

// ==================== ПРАВА ====================
window.__rolePermissions = async function(roleId) {
  const roles = await listRoles(true);
  const role = roles.find(r => r.id === roleId);
  if (!role) return;

  const { openPermissionsEditor } = await import("./admin-permissions.js");
  const perms = ("permissions" in role) ? role.permissions : null;
  openPermissionsEditor("role", roleId, role.name, perms);
};

// ==================== СОЗДАНИЕ ====================
function openCreateRoleModal() {
  editingRoleId = null;
  openRoleModal({
    title: "СОЗДАТЬ РОЛЬ",
    name: "",
    color: "#00c8d4",
    desc: ""
  });
}

// ==================== РЕДАКТИРОВАНИЕ ====================
window.__roleEdit = async function(roleId) {
  const roles = await listRoles();
  const role = roles.find(r => r.id === roleId);
  if (!role) return;

  editingRoleId = roleId;
  openRoleModal({
    title: "РЕДАКТИРОВАТЬ РОЛЬ",
    name: role.name,
    color: role.color,
    desc: role.desc || "",
    system: role.system
  });
};

// ==================== ОБЩАЯ МОДАЛКА ====================
function openRoleModal({ title, name, color, desc, system }) {
  openModal({
    title,
    html: `
      <div class="role-modal-form">
        <div class="form-field">
          <label>Название роли</label>
          <input type="text" id="roleName" value="${escapeAttr(name)}" placeholder="Например: Глава клана" autocomplete="off">
        </div>

        <div class="form-field">
          <label>Цвет роли</label>
          <div class="role-modal-color-row">
            <input type="color" id="roleColor" value="${color}">
            <input type="text" id="roleColorHex" value="${color}" maxlength="7">
          </div>
        </div>

        <div class="form-field">
          <label>Описание (опционально)</label>
          <input type="text" id="roleDesc" value="${escapeAttr(desc)}" placeholder="Например: Высший офицерский состав" autocomplete="off">
        </div>

        <div class="role-preview">
          <div class="label">Предпросмотр</div>
          <span class="badge-sample" id="rolePreview" style="background:${hexRgba(color, 0.15)};color:${color};border:1px solid ${hexRgba(color, 0.3)};">
            ${escapeHtml(name || "Название")}
          </span>
        </div>

        ${system ? `<p style="color:var(--cyan);font-size:11.5px;margin:0;">ℹ️ Это системная роль. Можно менять название и цвет, но нельзя удалить.</p>` : ""}
      </div>
      <div id="roleError" style="color:var(--red);font-size:12px;display:none;margin-top:8px;"></div>
    `,
    confirmText: editingRoleId ? "СОХРАНИТЬ" : "СОЗДАТЬ",
    onConfirm: saveRole
  });

  setTimeout(() => {
    const colorInput = document.getElementById("roleColor");
    const hexInput = document.getElementById("roleColorHex");
    const nameInput = document.getElementById("roleName");
    const preview = document.getElementById("rolePreview");

    function updatePreview() {
      const c = colorInput.value;
      const n = nameInput.value || "Название";
      preview.textContent = n;
      preview.style.background = hexRgba(c, 0.15);
      preview.style.color = c;
      preview.style.border = `1px solid ${hexRgba(c, 0.3)}`;
    }

    colorInput.addEventListener("input", () => {
      hexInput.value = colorInput.value;
      updatePreview();
    });
    hexInput.addEventListener("input", () => {
      if (/^#[0-9a-fA-F]{6}$/.test(hexInput.value)) {
        colorInput.value = hexInput.value;
        updatePreview();
      }
    });
    nameInput.addEventListener("input", updatePreview);

    nameInput?.focus();
  }, 80);
}

// ==================== СОХРАНЕНИЕ ====================
async function saveRole() {
  const name = document.getElementById("roleName").value.trim();
  const color = document.getElementById("roleColor").value;
  const desc = document.getElementById("roleDesc").value.trim();
  const err = document.getElementById("roleError");

  err.style.display = "none";

  const me = getCurrentUser();

  try {
    if (editingRoleId) {
      await updateRole(editingRoleId, { name, color, desc });
      toast("Роль обновлена", "ok");
      addDashEvent("🎖", `${me?.login || "—"} обновил роль «${name}»`, { type: "user" }).catch(() => {});
    } else {
      await createRole({ name, color, desc });
      toast("Роль создана", "ok");
      addDashEvent("🎖", `${me?.login || "—"} создал роль «${name}»`, { type: "user" }).catch(() => {});
    }
    await preloadColorData();
    applyColorsToDOM();
    await renderRolesList();
    closeModal();
  } catch (e) {
    err.textContent = e.message;
    err.style.display = "block";
  }
}

// ==================== УДАЛЕНИЕ ====================
window.__roleDelete = async function(roleId) {
  const roles = await listRoles();
  const role = roles.find(r => r.id === roleId);
  if (!role) return;
  if (role.system) {
    toast("Системную роль нельзя удалить", "warn");
    return;
  }

  if (!confirm(`Удалить роль «${role.name}»?\n\nВсе участники с этой ролью получат «Тёмная душа».`)) return;

  try {
    await clearRoleFromUsers(roleId);
    await deleteRole(roleId);
    toast(`Роль «${role.name}» удалена`, "ok");
    await preloadColorData();
    applyColorsToDOM();
    await renderRolesList();

    const me = getCurrentUser();
    addDashEvent("🗑", `${me?.login || "—"} удалил роль «${role.name}»`, { type: "user" }).catch(() => {});
  } catch (e) {
    toast(e.message, "warn");
  }
};

// ==================== ПЕРЕМЕЩЕНИЕ ====================
window.__roleMove = async function(roleId, direction) {
  await moveRole(roleId, direction);
  await renderRolesList();
};

// ==================== ХЕЛПЕРЫ ====================
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function escapeAttr(s) {
  return String(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function hexRgba(hex, alpha) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0,2), 16);
  const g = parseInt(c.substring(2,4), 16);
  const b = parseInt(c.substring(4,6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
