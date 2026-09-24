// js/modules/gestion.js
// Обратная совместимость: реэкспорт из utils.js + права.

import { getCurrentUser } from "../core/state.js";
import { toast } from "../core/utils.js";
import { can, canAny, canAll } from "../core/permissions.js";

// ✅ Реэкспорт хелперов — старые импорты продолжат работать
export { escapeHtml, escapeAttr, hexRgba, formatDate, formatTime, formatRelative, sameDay } from "../core/utils.js";

const ADMIN_ROLES = ["emperor", "lord"];

/**
 * Проверка: может ли текущий юзер редактировать (по правам).
 */
export function canEdit() {
  const me = getCurrentUser();
  if (!me) return false;

  // Если у роли есть явные права — используем can()
  if (typeof can === "function") {
    // Проверяем несколько ключевых прав редактирования
    if (can("admin.users") || can("admin.roles") || can("admin.divisions")) return true;
  }

  // Fallback — старые роли
  return ADMIN_ROLES.includes(me.role);
}

export function requireEdit() {
  if (!canEdit()) {
    toast("Недостаточно прав для редактирования", "warn");
    return false;
  }
  return true;
}

export { can, canAny, canAll };
