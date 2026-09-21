// js/core/permissions-cache.js
// Кэш прав ролей и подразделений.

import { db } from "../firebase-init.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let rolePerms = {};
let divPerms = {};

/**
 * Загружает права всех ролей и подразделений из Firestore.
 */
export async function loadPermissionsCache() {
  try {
    const rolesSnap = await getDocs(collection(db, "roles"));
    rolePerms = {};
    rolesSnap.forEach(d => {
      const data = d.data();
      rolePerms[d.id] = data.permissions || null;
    });
  } catch (e) {
    console.warn("[Perms] roles failed:", e);
  }

  try {
    const divsSnap = await getDocs(collection(db, "divisions"));
    divPerms = {};
    divsSnap.forEach(d => {
      const data = d.data();
      divPerms[d.id] = data.permissions || null;
    });
  } catch (e) {
    console.warn("[Perms] divisions failed:", e);
  }
}

export function getRolePermissionsCache(roleId) {
  return rolePerms[roleId] || null;
}

export function getDivisionPermissionsCache(divId) {
  return divPerms[divId] || null;
}

export function setRolePermissionsCache(roleId, perms) {
  rolePerms[roleId] = perms;
}

export function setDivisionPermissionsCache(divId, perms) {
  divPerms[divId] = perms;
}

export function clearPermissionsCache() {
  rolePerms = {};
  divPerms = {};
}
