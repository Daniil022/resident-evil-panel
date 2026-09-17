// js/core/colorize.js
// Единая функция покраски ролей и подразделений по всему сайту

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

export function getDivisionColor(divId) {
  const div = divisionsCache.find(d => d.id === divId);
  return div ? div.color : "#666";
}

export function getDivisionName(divId) {
  const div = divisionsCache.find(d => d.id === divId);
  return div ? div.name : "—";
}

// Универсальная функция: рендерит бейдж роли
export function renderRoleBadge(roleId, extraClass = "") {
  const role = rolesCache.find(r => r.id === roleId);
  if (!role) return `<span class="role-badge ${extraClass}" style="background:#333;color:#888;">—</span>`;
  return `<span class="role-badge ${extraClass}" style="background:${hexToRgba(role.color, 0.15)};color:${role.color};border:1px solid ${hexToRgba(role.color, 0.3)};">${role.name}</span>`;
}

export function renderDivisionBadge(divId, extraClass = "") {
  const div = divisionsCache.find(d => d.id === divId);
  if (!div) return "";
  return `<span class="division-badge ${extraClass}" style="background:${hexToRgba(div.color, 0.15)};color:${div.color};border:1px solid ${hexToRgba(div.color, 0.3)};">${div.name}</span>`;
}

// Преобразование HEX → rgba
function hexToRgba(hex, alpha = 1) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Авто-применение к элементам с data-role
export function applyColorsToDOM() {
  document.querySelectorAll("[data-role-id]").forEach(el => {
    const roleId = el.getAttribute("data-role-id");
    const role = rolesCache.find(r => r.id === roleId);
    if (role) {
      el.style.color = role.color;
    }
  });
  document.querySelectorAll("[data-division-id]").forEach(el => {
    const divId = el.getAttribute("data-division-id");
    const div = divisionsCache.find(d => d.id === divId);
    if (div) {
      el.style.color = div.color;
    }
  });
}
