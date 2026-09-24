// js/admin/admin-permissions.js
// Редактор прав для роли / подразделения.

import { db } from "../firebase-init.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { openModal, closeModal, toast } from "../core/utils.js";
import { PERMISSIONS } from "../core/permissions.js";
import {
  setRolePermissionsCache, setDivisionPermissionsCache
} from "../core/permissions-cache.js";
import { getCurrentUser } from "../core/state.js";
import { addDashEvent } from "../core/dashboard-events.js";

/**
 * Открывает модалку редактирования прав.
 * @param {"role"|"division"} type
 * @param {string} id — id роли или подразделения
 * @param {string} name — название для заголовка
 * @param {Array|"*"|null} currentPerms — текущие права
 */
export function openPermissionsEditor(type, id, name, currentPerms) {
  // Группируем права по секциям
  const groups = {};
  for (const [key, meta] of Object.entries(PERMISSIONS)) {
    if (!groups[meta.group]) groups[meta.group] = [];
    groups[meta.group].push({ key, label: meta.label });
  }

  // Приводим currentPerms к массиву
  const allPerms = Object.keys(PERMISSIONS);
  const isAll = currentPerms === "*";
  const isNull = currentPerms === null || currentPerms === undefined;
  const currentSet = new Set(
    isAll ? allPerms : (Array.isArray(currentPerms) ? currentPerms : [])
  );

  // HTML
  let html = '<div style="max-height:60vh;overflow-y:auto;padding-right:8px;">';

  // Статус «не задано»
  if (isNull) {
    html += '<div style="margin-bottom:12px;padding:10px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:8px;font-size:12px;color:var(--gold);">' +
      '⚠️ Права не заданы явно. Используются права по умолчанию для этой роли/подразделения.' +
      '</div>';
  }

  // Верхняя панель: чекбокс «Все» + счётчик
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:10px;background:var(--bg-2);border-radius:8px;gap:12px;flex-wrap:wrap;">';
  html += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;color:#fff;">';
  html += '<input type="checkbox" id="permAll" ' + (isAll ? "checked" : "") + '>';
  html += '<b>ВСЕ ПРАВА (полный доступ)</b>';
  html += '</label>';
  html += '<div style="display:flex;gap:6px;">';
  html += '<button type="button" class="btn small secondary" id="permSelectAll">Все</button>';
  html += '<button type="button" class="btn small secondary" id="permSelectNone">Ничего</button>';
  html += '</div>';
  html += '</div>';

  // Счётчик выбранных
  html += '<div style="margin-bottom:12px;font-size:12px;color:var(--muted);">';
  html += 'Выбрано: <span id="permCount" style="color:var(--cyan);font-weight:700;">0</span> из ' + allPerms.length;
  html += '</div>';

  for (const [groupName, perms] of Object.entries(groups)) {
    html += '<div style="margin-bottom:16px;">';
    html += '<div style="color:var(--cyan);font-size:11px;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;font-weight:700;">' + groupName + '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
    for (const p of perms) {
      const checked = currentSet.has(p.key) ? "checked" : "";
      html += '<label style="display:flex;align-items:center;gap:6px;color:#ccc;font-size:12.5px;cursor:pointer;padding:4px 6px;border-radius:4px;">';
      html += '<input type="checkbox" class="perm-check" data-perm="' + p.key + '" ' + checked + '>';
      html += '<span>' + p.label + '</span>';
      html += '</label>';
    }
    html += '</div>';
    html += '</div>';
  }

  html += '</div>';

  openModal({
    title: "🔐 ПРАВА: " + name,
    html: html,
    confirmText: "СОХРАНИТЬ",
    onConfirm: () => savePermissions(type, id, name)
  });

  // Обработчики
  setTimeout(() => {
    const allCheckbox = document.getElementById("permAll");
    const checks = () => document.querySelectorAll(".perm-check");
    const countEl = document.getElementById("permCount");

    const updateCount = () => {
      const total = checks().length;
      const selected = Array.from(checks()).filter(cb => cb.checked).length;
      if (countEl) countEl.textContent = selected;
    };

    const setAllDisabled = (disabled) => {
      checks().forEach(cb => {
        if (disabled) {
          cb.dataset.prevChecked = cb.checked ? "1" : "0";
          cb.checked = true;
          cb.disabled = true;
        } else {
          cb.disabled = false;
          if (cb.dataset.prevChecked === "0") cb.checked = false;
          delete cb.dataset.prevChecked;
        }
      });
      updateCount();
    };

    if (allCheckbox) {
      allCheckbox.addEventListener("change", () => {
        setAllDisabled(allCheckbox.checked);
      });
      if (allCheckbox.checked) setAllDisabled(true);
    }

    checks().forEach(cb => {
      cb.addEventListener("change", updateCount);
    });

    document.getElementById("permSelectAll")?.addEventListener("click", () => {
      if (allCheckbox) allCheckbox.checked = false;
      checks().forEach(cb => { cb.disabled = false; cb.checked = true; });
      updateCount();
    });

    document.getElementById("permSelectNone")?.addEventListener("click", () => {
      if (allCheckbox) allCheckbox.checked = false;
      checks().forEach(cb => { cb.disabled = false; cb.checked = false; });
      updateCount();
    });

    updateCount();
  }, 50);
}

async function savePermissions(type, id, name) {
  const allCheckbox = document.getElementById("permAll");
  let perms;

  if (allCheckbox && allCheckbox.checked) {
    perms = "*";
  } else {
    perms = Array.from(document.querySelectorAll(".perm-check"))
      .filter(cb => cb.checked)
      .map(cb => cb.dataset.perm);
  }

  const collectionName = type === "role" ? "roles" : "divisions";

  try {
    await updateDoc(doc(db, collectionName, id), { permissions: perms });
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
    return;
  }

  // Обновляем кэш
  if (type === "role") setRolePermissionsCache(id, perms);
  else setDivisionPermissionsCache(id, perms);

  // Запись в ленту
  const me = getCurrentUser();
  const permsLabel = perms === "*" ? "ВСЕ ПРАВА" : perms.length + " шт.";
  addDashEvent("🔐", `${me?.login || "—"} обновил права ${type === "role" ? "роли" : "отдела"} «${name}»: ${permsLabel}`, { type: "user" }).catch(() => {});

  toast("Права сохранены", "ok");
  closeModal();

  // Перезагружаем список
  if (type === "role") {
    try {
      const { initAdminRoles } = await import("./admin-roles.js");
      await initAdminRoles();
    } catch (e) {}
  } else {
    try {
      const { initAdminDivisions } = await import("./admin-divisions.js");
      await initAdminDivisions();
    } catch (e) {}
  }
}
