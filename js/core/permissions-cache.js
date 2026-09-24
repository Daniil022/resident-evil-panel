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
      // permissions может быть undefined / null / "*" / массив
      if (data.permissions !== undefined) {
        rolePerms[d.id] = data.permissions;
      }
    });
  } catch (e) {
    console.warn("[Perms] roles failed:", e);
  }

  try {
    const divsSnap = await getDocs(collection(db, "divisions"));
    divPerms = {};
    divsSnap.forEach(d => {
      const data = d.data();
      if (data.permissions !== undefined) {
        divPerms[d.id] = data.permissions;
      }
    });
  } catch (e) {
    console.warn("[Perms] divisions failed:", e);
  }
}

export function getRolePermissionsCache(roleId) {
  // Возвращаем null если явно не задано (тогда сработает DEFAULT)
  if (!(roleId in rolePerms)) return null;
  return rolePerms[roleId];
}

export function getDivisionPermissionsCache(divId) {
  if (!(divId in divPerms)) return null;
  return divPerms[divId];
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

/**
 * Проверяет, заданы ли права для роли/подразделения явно.
 */
export function hasExplicitRolePermissions(roleId) {
  return roleId in rolePerms;
}

export function hasExplicitDivisionPermissions(divId) {
  return divId in divPerms;
}
