// js/admin/admin-divisions.js
import {
  listDivisions, createDivision, updateDivision, deleteDivision, moveDivision
} from "../core/divisions.js";
import { clearDivisionFromUsers } from "../core/auth.js";
import { toast, openModal, closeModal } from "../core/utils.js";
import { preloadColorData, applyColorsToDOM } from "../core/colorize.js";
import { getCurrentUser } from "../core/state.js";
import { addDashEvent } from "../core/dashboard-events.js";

let editingDivId = null;

export async function initAdminDivisions() {
  await renderDivisionsList();
  const addBtn = document.getElementById("addDivisionBtn");
  if (addBtn && !addBtn.__bound) {
    addBtn.__bound = true;
    addBtn.addEventListener("click", openCreateDivisionModal);
  }
}

async function renderDivisionsList() {
  const container = document.getElementById("divisionsList");
  if (!container) return;

  const divisions = await listDivisions(true);

  if (divisions.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--muted);padding:40px;">Подразделений нет</div>`;
    return;
  }

  container.innerHTML = divisions.map((d, idx) => {
    // Считаем права
    let permsLabel = "по умолчанию";
    let permsColor = "var(--muted)";
    if (d.permissions === "*") {
      permsLabel = "ВСЕ";
      permsColor = "var(--gold)";
    } else if (Array.isArray(d.permissions)) {
      permsLabel = d.permissions.length + " шт.";
      permsColor = "var(--cyan)";
    }

    return `
    <div class="role-row" data-division-id="${d.id}">
      <div class="role-color-dot" style="background:${d.color};"></div>
      <div class="role-info">
        <div class="name">${escapeHtml(d.name)}</div>
        <div class="desc">${escapeHtml(d.desc || "Без описания")}</div>
        <div class="desc" style="font-size:10.5px;color:${permsColor};">🔐 Права: ${permsLabel}</div>
      </div>
      <div class="role-actions">
        <button onclick="window.__divMove('${d.id}','up')" ${idx === 0 ? "disabled" : ""} title="Вверх">⬆</button>
        <button onclick="window.__divMove('${d.id}','down')" ${idx === divisions.length - 1 ? "disabled" : ""} title="Вниз">⬇</button>
        <button onclick="window.__divPermissions('${d.id}')" title="Права">🔐</button>
        <button onclick="window.__divEdit('${d.id}')" title="Редактировать">✏️</button>
        <button class="danger" onclick="window.__divDelete('${d.id}')" title="Удалить">🗑</button>
      </div>
    </div>
  `;
  }).join("");
}

// ==================== ПРАВА ====================
window.__divPermissions = async function(divId) {
  const divisions = await listDivisions(true);
  const div = divisions.find(d => d.id === divId);
  if (!div) return;

  const { openPermissionsEditor } = await import("./admin-permissions.js");
  const perms = ("permissions" in div) ? div.permissions : null;
  openPermissionsEditor("division", divId, div.name, perms);
};

// ==================== СОЗДАНИЕ ====================
function openCreateDivisionModal() {
  editingDivId = null;
  openDivisionModal({
    title: "СОЗДАТЬ ПОДРАЗДЕЛЕНИЕ",
    name: "",
    color: "#00c8d4",
    desc: ""
  });
}

// ==================== РЕДАКТИРОВАНИЕ ====================
window.__divEdit = async function(divId) {
  const divisions = await listDivisions();
  const div = divisions.find(d => d.id === divId);
  if (!div) return;

  editingDivId = divId;
  openDivisionModal({
    title: "РЕДАКТИРОВАТЬ ПОДРАЗДЕЛЕНИЕ",
    name: div.name,
    color: div.color,
    desc: div.desc || ""
  });
};

function openDivisionModal({ title, name, color, desc }) {
  openModal({
    title,
    html: `
      <div class="role-modal-form">
        <div class="form-field">
          <label>Название подразделения</label>
          <input type="text" id="divName" value="${escapeAttr(name)}" placeholder="Например: Охраник" autocomplete="off">
        </div>

        <div class="form-field">
          <label>Цвет подразделения</label>
          <div class="role-modal-color-row">
            <input type="color" id="divColor" value="${color}">
            <input type="text" id="divColorHex" value="${color}" maxlength="7">
          </div>
        </div>

        <div class="form-field">
          <label>Описание (опционально)</label>
          <input type="text" id="divDesc" value="${escapeAttr(desc)}" placeholder="Например: Охрана базы" autocomplete="off">
        </div>

        <div class="role-preview">
          <div class="label">Предпросмотр</div>
          <span class="badge-sample" id="divPreview" style="background:${hexRgba(color, 0.15)};color:${color};border:1px solid ${hexRgba(color, 0.3)};">
            ${escapeHtml(name || "Название")}
          </span>
        </div>
      </div>
      <div id="divError" style="color:var(--red);font-size:12px;display:none;margin-top:8px;"></div>
    `,
    confirmText: editingDivId ? "СОХРАНИТЬ" : "СОЗДАТЬ",
    onConfirm: saveDivision
  });

  setTimeout(() => {
    const colorInput = document.getElementById("divColor");
    const hexInput = document.getElementById("divColorHex");
    const nameInput = document.getElementById("divName");
    const preview = document.getElementById("divPreview");

    function updatePreview() {
      const c = colorInput.value;
      const n = nameInput.value || "Название";
      preview.textContent = n;
      preview.style.background = hexRgba(c, 0.15);
      preview.style.color = c;
      preview.style.border = `1px solid ${hexRgba(c, 0.3)}`;
    }

    colorInput.addEventListener("input", () => { hexInput.value = colorInput.value; updatePreview(); });
    hexInput.addEventListener("input", () => {
      if (/^#[0-9a-fA-F]{6}$/.test(hexInput.value)) { colorInput.value = hexInput.value; updatePreview(); }
    });
    nameInput.addEventListener("input", updatePreview);

    nameInput?.focus();
  }, 80);
}

async function saveDivision() {
  const name = document.getElementById("divName").value.trim();
  const color = document.getElementById("divColor").value;
  const desc = document.getElementById("divDesc").value.trim();
  const err = document.getElementById("divError");
  err.style.display = "none";

  const me = getCurrentUser();

  try {
    if (editingDivId) {
      await updateDivision(editingDivId, { name, color, desc });
      toast("Подразделение обновлено", "ok");
      addDashEvent("🎯", `${me?.login || "—"} обновил отряд «${name}»`, { type: "user" }).catch(() => {});
    } else {
      await createDivision({ name, color, desc });
      toast("Подразделение создано", "ok");
      addDashEvent("🎯", `${me?.login || "—"} создал отряд «${name}»`, { type: "user" }).catch(() => {});
    }
    await preloadColorData();
    applyColorsToDOM();
    await renderDivisionsList();
    closeModal();
  } catch (e) {
    err.textContent = e.message;
    err.style.display = "block";
  }
}

window.__divDelete = async function(divId) {
  const divisions = await listDivisions();
  const div = divisions.find(d => d.id === divId);
  if (!div) return;

  if (!confirm(`Удалить подразделение «${div.name}»?\n\nВсе участники этого подразделения потеряют его.`)) return;

  try {
    await clearDivisionFromUsers(divId);
    await deleteDivision(divId);
    toast(`Подразделение «${div.name}» удалено`, "ok");
    await preloadColorData();
    applyColorsToDOM();
    await renderDivisionsList();

    const me = getCurrentUser();
    addDashEvent("🗑", `${me?.login || "—"} удалил отряд «${div.name}»`, { type: "user" }).catch(() => {});
  } catch (e) {
    toast(e.message, "warn");
  }
};

window.__divMove = async function(divId, direction) {
  await moveDivision(divId, direction);
  await renderDivisionsList();
};

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
