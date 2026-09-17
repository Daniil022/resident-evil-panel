// js/modules/gestion.js
import { getCurrentUser } from "../core/state.js";
import { toast } from "../core/utils.js";

const ADMIN_ROLES = ["emperor", "lord"];

export function canEdit() {
  const me = getCurrentUser();
  return me && ADMIN_ROLES.includes(me.role);
}

export function requireEdit() {
  if (!canEdit()) {
    toast("Только Император и Лорд Тьмы могут редактировать", "warn");
    return false;
  }
  return true;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

export function hexRgba(hex, alpha) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0,2), 16);
  const g = parseInt(c.substring(2,4), 16);
  const b = parseInt(c.substring(4,6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}
