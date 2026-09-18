// js/core/colorize.js
import { listRoles } from "./roles.js";
import { listDivisions } from "./divisions.js";

let rolesCache = [];
let divisionsCache = [];

export async function preloadColorData() {
  rolesCache = await listRoles();
  divisionsCache = await listDivisions();
}

export function getRoleColor(roleId) {
  const role = rolesCache.find(r => r.id === roleId);
  return role ? role.color : "#a4b1c0";
}

export function getRoleName(roleId) {
  const role = rolesCache.find(r => r.id === roleId);
  return role ? role.name : "—";
}

export function isAllyRole(roleId) {
  const role = rolesCache.find(r => r.id === roleId);
  return role && (role.isAlly || role.id === "ally");
}

export function getDivisionColor(divId) {
  const div = divisionsCache.find(d => d.id === divId);
  return div ? div.color : "#666";
}

export function getDivisionName(divId) {
  const div = divisionsCache.find(d => d.id === divId);
  return div ? div.name : "—";
}

const RAINBOW = "linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #00c8d4, #0000ff, #4b0082, #9400d3)";

export function renderRoleBadge(roleId, extraClass = "") {
  const role = rolesCache.find(r => r.id === roleId);
  if (!role) return '<span class="role-badge ' + extraClass + '" style="background:#333;color:#888;">—</span>';

  if (role.isAlly || role.id === "ally" || role.color === "rainbow") {
    return '<span class="role-badge role-badge-rainbow ' + extraClass + '">' + role.name + '</span>';
  }

  return '<span class="role-badge ' + extraClass + '" style="background:' + hexToRgba(role.color, 0.15) + ';color:' + role.color + ';border:1px solid ' + hexToRgba(role.color, 0.3) + ';">' + role.name + '</span>';
}

export function renderDivisionBadge(divId, extraClass = "") {
  const div = divisionsCache.find(d => d.id === divId);
  if (!div) return "";
  return '<span class="division-badge ' + extraClass + '" style="background:' + hexToRgba(div.color, 0.15) + ';color:' + div.color + ';border:1px solid ' + hexToRgba(div.color, 0.3) + ';">' + div.name + '</span>';
}

function hexToRgba(hex, alpha = 1) {
  if (!hex || hex === "rainbow") return "rgba(255,255,255," + alpha + ")";
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
}

export function applyColorsToDOM() {
  document.querySelectorAll("[data-role-id]").forEach(el => {
    const roleId = el.getAttribute("data-role-id");
    const role = rolesCache.find(r => r.id === roleId);
    if (role && role.color !== "rainbow") el.style.color = role.color;
  });
  document.querySelectorAll("[data-division-id]").forEach(el => {
    const divId = el.getAttribute("data-division-id");
    const div = divisionsCache.find(d => d.id === divId);
    if (div) el.style.color = div.color;
  });
}
