// js/admin/admin-permissions.js
// Редактор прав для роли / подразделения.

import { db } from "../firebase-init.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { openModal, closeModal, toast } from "../core/utils.js";
import { PERMISSIONS } from "../core/permissions.js";
import { setRolePermissionsCache, setDivisionPermissionsCache } from "../core/permissions-cache.js";

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
  const currentSet = new Set(
    currentPerms === "*" ? allPerms : (Array.isArray(currentPerms) ? currentPerms : [])
  );
  const isAll = currentPerms === "*";

  // HTML
  let html = '<div style="max-height:60vh;overflow-y:auto;padding-right:8px;">';
  html += '<div style="margin-bottom:12px;padding:10px;background:var(--bg-2);border-radius:8px;">';
  html += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;color:#fff;">';
  html += '<input type="checkbox" id="permAll" ' + (isAll ? "checked" : "") + '>';
  html += '<b>ВСЕ ПРАВА (полный доступ)</b>';
  html += '</label>';
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
    onConfirm: () => savePermissions(type, id)
  });

  // Обработчик «Все права»
  setTimeout(() => {
    const allCheckbox = document.getElementById("permAll");
    if (allCheckbox) {
      allCheckbox.addEventListener("change", () => {
        const checked = allCheckbox.checked;
        document.querySelectorAll(".perm-check").forEach(cb => {
          cb.checked = checked;
          cb.disabled = checked;
        });
      });
      // Если "все" — вырубаем остальные
      if (allCheckbox.checked) {
        document.querySelectorAll(".perm-check").forEach(cb => {
          cb.disabled = true;
        });
      }
    }
  }, 50);
}

async function savePermissions(type, id) {
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

  toast("Права сохранены", "ok");
  closeModal();
}
