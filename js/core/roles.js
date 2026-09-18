// js/core/roles.js
import { db } from "../firebase-init.js";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { cacheGet, cacheSet, cacheInvalidate } from "./cache.js";

const CACHE_KEY = "roles_list";
const DEMO_KEY = "re_demo_roles";

export const DEFAULT_ROLES = [
  { id: "emperor",  name: "Император",     color: "#fbbf24", desc: "Лидер семьи",   order: 1, system: true },
  { id: "lord",     name: "Лорд Тьмы",     color: "#ef4444", desc: "Заместитель",   order: 2, system: true },
  { id: "knight",   name: "Рыцарь Смерти", color: "#3b82f6", desc: "Офицер",        order: 3, system: true },
  { id: "skeleton", name: "Скелет Ужаса",  color: "#a855f7", desc: "Офицер",        order: 4, system: true },
  { id: "soul",     name: "Тёмная душа",   color: "#a4b1c0", desc: "Боец",          order: 5, system: true },
  { id: "ally",     name: "Союзник",       color: "rainbow", desc: "Союзник семьи", order: 99, system: true, isAlly: true }
];

function getDemoRoles() {
  const raw = localStorage.getItem(DEMO_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  localStorage.setItem(DEMO_KEY, JSON.stringify(DEFAULT_ROLES));
  return [...DEFAULT_ROLES];
}

function saveDemoRoles(roles) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(roles));
}

export async function listRoles(force = false) {
  if (!force) {
    const cached = cacheGet(CACHE_KEY, 300000);
    if (cached) return cached;
  }

  try {
    const snap = await getDocs(collection(db, "roles"));
    if (!snap.empty) {
      const roles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      roles.sort((a, b) => (a.order || 0) - (b.order || 0));
      cacheSet(CACHE_KEY, roles);
      return roles;
    }
    await initializeDefaultRoles();
    cacheSet(CACHE_KEY, [...DEFAULT_ROLES]);
    return [...DEFAULT_ROLES];
  } catch (e) {
    console.warn("Firebase roles failed, demo mode");
  }

  const roles = getDemoRoles();
  cacheSet(CACHE_KEY, roles);
  return roles;
}

async function initializeDefaultRoles() {
  try {
    for (const r of DEFAULT_ROLES) {
      await setDoc(doc(db, "roles", r.id), r);
    }
  } catch (e) {}
}

export async function getRole(roleId) {
  if (!roleId) return null;
  const roles = await listRoles();
  return roles.find(r => r.id === roleId) || null;
}

export async function createRole({ name, color, desc = "" }) {
  if (!name || !name.trim()) throw new Error("Введите название");
  if (color !== "rainbow" && !/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("Неверный HEX-цвет");

  const roles = await listRoles(true);
  if (roles.find(r => r.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("Роль с таким названием уже есть");
  }

  const newId = "role_" + Date.now();
  const maxOrder = Math.max(0, ...roles.map(r => r.order || 0));
  const newRole = { name: name.trim(), color, desc: desc.trim(), order: maxOrder + 1, system: false };

  try {
    await setDoc(doc(db, "roles", newId), newRole);
    cacheInvalidate(CACHE_KEY);
    return { id: newId, ...newRole };
  } catch (e) {}

  const demo = getDemoRoles();
  const role = { id: newId, ...newRole };
  demo.push(role);
  saveDemoRoles(demo);
  cacheInvalidate(CACHE_KEY);
  return role;
}

export async function updateRole(roleId, updates) {
  const roles = await listRoles();
  const role = roles.find(r => r.id === roleId);
  if (!role) throw new Error("Роль не найдена");

  const patch = {};
  if (updates.name !== undefined) {
    if (!updates.name.trim()) throw new Error("Пустое название");
    patch.name = updates.name.trim();
  }
  if (updates.color !== undefined) {
    if (updates.color !== "rainbow" && !/^#[0-9a-fA-F]{6}$/.test(updates.color)) throw new Error("Неверный HEX");
    patch.color = updates.color;
  }
  if (updates.desc !== undefined) patch.desc = updates.desc.trim();
  if (updates.order !== undefined) patch.order = updates.order;

  try {
    await updateDoc(doc(db, "roles", roleId), patch);
    cacheInvalidate(CACHE_KEY);
    return;
  } catch (e) {}

  const demo = getDemoRoles();
  const idx = demo.findIndex(r => r.id === roleId);
  if (idx >= 0) { Object.assign(demo[idx], patch); saveDemoRoles(demo); }
  cacheInvalidate(CACHE_KEY);
}

export async function deleteRole(roleId) {
  const roles = await listRoles();
  const role = roles.find(r => r.id === roleId);
  if (!role) throw new Error("Роль не найдена");
  if (role.system) throw new Error("Системные роли нельзя удалять");

  try {
    await deleteDoc(doc(db, "roles", roleId));
  } catch (e) {}

  const demo = getDemoRoles().filter(r => r.id !== roleId);
  saveDemoRoles(demo);
  cacheInvalidate(CACHE_KEY);
}

export async function moveRole(roleId, direction) {
  const roles = await listRoles(true);
  const idx = roles.findIndex(r => r.id === roleId);
  if (idx < 0) return;

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= roles.length) return;

  const a = roles[idx];
  const b = roles[swapIdx];
  const aOrder = a.order || idx + 1;
  const bOrder = b.order || swapIdx + 1;

  await updateRole(a.id, { order: bOrder });
  await updateRole(b.id, { order: aOrder });
  cacheInvalidate(CACHE_KEY);
}
