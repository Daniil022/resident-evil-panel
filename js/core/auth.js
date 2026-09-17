// js/core/auth.js
import { db } from "../firebase-init.js";
import {
  collection, query, where, getDocs, doc, getDoc,
  setDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { setCurrentUser, restoreSession, clearSession } from "./state.js";
import { cacheGet, cacheSet, cacheInvalidate } from "./cache.js";

const DEMO_USERS_KEY = "re_panel_demo_users";
const CACHE_KEY_USERS = "users_list";

// ==================== ДЕМО ====================
function getDemoUsers() {
  const raw = localStorage.getItem(DEMO_USERS_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  const defaults = [
    { uid: "demo-emperor",  login: "Emperor",         pin: "1111", role: "Император",     warn: 0, contracts: 0, createdAt: Date.now() - 86400000 * 30 },
    { uid: "demo-lord",     login: "Lord_Darkness",   pin: "2222", role: "Лорд Тьмы",     warn: 0, contracts: 0, createdAt: Date.now() - 86400000 * 25 },
    { uid: "demo-knight",   login: "Death_Knight",    pin: "3333", role: "Рыцарь Смерти", warn: 0, contracts: 0, createdAt: Date.now() - 86400000 * 20 },
    { uid: "demo-skeleton", login: "Horror_Skeleton", pin: "4444", role: "Скелет Ужаса",  warn: 0, contracts: 0, createdAt: Date.now() - 86400000 * 15 },
    { uid: "demo-soul",     login: "Dark_Soul",       pin: "5555", role: "Тёмная душа",   warn: 0, contracts: 0, createdAt: Date.now() - 86400000 * 10 }
  ];
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(defaults));
  return defaults;
}

function saveDemoUsers(users) {
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
}

// ==================== ЛОГИН ====================
export async function login(loginName, pin) {
  if (!loginName || !pin) return { ok: false, error: "Заполните все поля" };
  if (!/^[A-Za-z0-9_]{3,32}$/.test(loginName)) {
    return { ok: false, error: "Логин: латиница, цифры, _ (3-32)" };
  }

  try {
    const q = query(collection(db, "users"), where("login", "==", loginName));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      const data = d.data();
      if (data.pin !== pin) return { ok: false, error: "Неверный PIN-код" };
      if (data.banned) return { ok: false, error: "АККАУНТ ЗАБАНЕН (3/3 Warn). Обратитесь к лидеру." };
      const user = { uid: d.id, login: data.login, role: data.role || "Тёмная душа" };
      setCurrentUser(user);
      return { ok: true, user };
    }
  } catch (e) {
    console.warn("Firebase недоступен, демо-режим");
  }

  const demoUsers = getDemoUsers();
  const found = demoUsers.find(u => u.login === loginName);
  if (!found) return { ok: false, error: "Пользователь не найден" };
  if (found.pin !== pin) return { ok: false, error: "Неверный PIN-код" };
  if (found.banned) return { ok: false, error: "АККАУНТ ЗАБАНЕН (3/3 Warn). Обратитесь к лидеру." };

  const user = { uid: found.uid, login: found.login, role: found.role };
  setCurrentUser(user);
  return { ok: true, user };
}

export function logout() {
  clearSession();
  cacheInvalidate();
  window.location.reload();
}

export function tryRestoreSession() {
  return restoreSession();
}

// ==================== СОЗДАНИЕ ====================
export async function createUser({ login, pin, role }) {
  if (!/^[A-Za-z0-9_]{3,32}$/.test(login)) throw new Error("Неверный формат логина");
  if (!/^\d{4,8}$/.test(pin)) throw new Error("PIN: 4-8 цифр");

  try {
    const q = query(collection(db, "users"), where("login", "==", login));
    const snap = await getDocs(q);
    if (!snap.empty) throw new Error("Логин уже занят");

    const newRef = doc(collection(db, "users"));
    await setDoc(newRef, { login, pin, role, warn: 0, contracts: 0, createdAt: Date.now() });
    cacheInvalidate(CACHE_KEY_USERS);
    return { uid: newRef.id, login, role, warn: 0, contracts: 0 };
  } catch (e) {
    if (e.message === "Логин уже занят") throw e;
  }

  const demoUsers = getDemoUsers();
  if (demoUsers.find(u => u.login === login)) throw new Error("Логин уже занят");
  const user = { uid: "demo-" + Date.now(), login, pin, role, warn: 0, contracts: 0, createdAt: Date.now() };
  demoUsers.push(user);
  saveDemoUsers(demoUsers);
  cacheInvalidate(CACHE_KEY_USERS);
  return user;
}

// ==================== СПИСОК ====================
export async function listUsers(force = false) {
  if (!force) {
    const cached = cacheGet(CACHE_KEY_USERS, 60000);
    if (cached) return cached;
  }

  try {
    const snap = await getDocs(collection(db, "users"));
    if (!snap.empty) {
      const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      cacheSet(CACHE_KEY_USERS, users);
      return users;
    }
  } catch (e) {
    console.warn("Firebase недоступен, читаю демо-юзеров");
  }

  const users = getDemoUsers();
  cacheSet(CACHE_KEY_USERS, users);
  return users;
}

// ==================== УДАЛЕНИЕ ====================
export async function deleteUser(uid) {
  try {
    await deleteDoc(doc(db, "users", uid));
  } catch (e) {
    console.warn("Firebase delete failed:", e.message);
  }
  const demoUsers = getDemoUsers().filter(u => u.uid !== uid);
  saveDemoUsers(demoUsers);
  cacheInvalidate(CACHE_KEY_USERS);
}

// ==================== PIN ====================
export async function changePin(uid, newPin) {
  if (!/^\d{4,8}$/.test(newPin)) throw new Error("PIN: 4-8 цифр");
  try {
    await updateDoc(doc(db, "users", uid), { pin: newPin });
    cacheInvalidate(CACHE_KEY_USERS);
    return;
  } catch {}
  const demoUsers = getDemoUsers();
  const idx = demoUsers.findIndex(u => u.uid === uid);
  if (idx >= 0) { demoUsers[idx].pin = newPin; saveDemoUsers(demoUsers); }
  cacheInvalidate(CACHE_KEY_USERS);
}

// ==================== РОЛЬ ====================
export const VALID_ROLES = [
  "Император", "Лорд Тьмы", "Рыцарь Смерти", "Скелет Ужаса", "Тёмная душа"
];

export async function changeRole(uid, newRole) {
  if (!VALID_ROLES.includes(newRole)) throw new Error("Неверная роль");
  try {
    await updateDoc(doc(db, "users", uid), { role: newRole });
    cacheInvalidate(CACHE_KEY_USERS);
    return;
  } catch {}
  const demoUsers = getDemoUsers();
  const idx = demoUsers.findIndex(u => u.uid === uid);
  if (idx >= 0) { demoUsers[idx].role = newRole; saveDemoUsers(demoUsers); }
  cacheInvalidate(CACHE_KEY_USERS);
}

// ==================== ЦВЕТ РОЛИ ====================
export async function setRoleColor(uid, hexColor) {
  try {
    await updateDoc(doc(db, "users", uid), { roleColor: hexColor });
    cacheInvalidate(CACHE_KEY_USERS);
    return;
  } catch {}
  const demoUsers = getDemoUsers();
  const idx = demoUsers.findIndex(u => u.uid === uid);
  if (idx >= 0) { demoUsers[idx].roleColor = hexColor; saveDemoUsers(demoUsers); }
  cacheInvalidate(CACHE_KEY_USERS);
}

// ==================== WARN ====================
export async function warnUser(uid, reason = "") {
  let newWarn = 0;
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const current = snap.data().warn || 0;
      newWarn = current + 1;
      const updates = { warn: newWarn, lastWarnReason: reason, lastWarnAt: Date.now() };
      if (newWarn >= 3) { updates.banned = true; updates.bannedAt = Date.now(); }
      await updateDoc(userRef, updates);
      cacheInvalidate(CACHE_KEY_USERS);
      return newWarn;
    }
  } catch (e) { console.warn("Firebase warn failed"); }

  const demoUsers = getDemoUsers();
  const idx = demoUsers.findIndex(u => u.uid === uid);
  if (idx >= 0) {
    demoUsers[idx].warn = (demoUsers[idx].warn || 0) + 1;
    demoUsers[idx].lastWarnReason = reason;
    demoUsers[idx].lastWarnAt = Date.now();
    if (demoUsers[idx].warn >= 3) {
      demoUsers[idx].banned = true;
      demoUsers[idx].bannedAt = Date.now();
    }
    newWarn = demoUsers[idx].warn;
    saveDemoUsers(demoUsers);
    cacheInvalidate(CACHE_KEY_USERS);
  }
  return newWarn;
}

export async function unwarnUser(uid) {
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const current = snap.data().warn || 0;
      const newWarn = Math.max(0, current - 1);
      await updateDoc(userRef, { warn: newWarn, banned: newWarn >= 3 });
      cacheInvalidate(CACHE_KEY_USERS);
      return newWarn;
    }
  } catch {}
  const demoUsers = getDemoUsers();
  const idx = demoUsers.findIndex(u => u.uid === uid);
  if (idx >= 0) {
    demoUsers[idx].warn = Math.max(0, (demoUsers[idx].warn || 0) - 1);
    demoUsers[idx].banned = demoUsers[idx].warn >= 3;
    saveDemoUsers(demoUsers);
    cacheInvalidate(CACHE_KEY_USERS);
    return demoUsers[idx].warn;
  }
  return 0;
}

// ==================== КОНТРАКТЫ ====================
export async function incrementContracts(uid, by = 1) {
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const current = snap.data().contracts || 0;
      await updateDoc(userRef, { contracts: current + by });
      cacheInvalidate(CACHE_KEY_USERS);
      return current + by;
    }
  } catch {}
  const demoUsers = getDemoUsers();
  const idx = demoUsers.findIndex(u => u.uid === uid);
  if (idx >= 0) {
    demoUsers[idx].contracts = (demoUsers[idx].contracts || 0) + by;
    saveDemoUsers(demoUsers);
    cacheInvalidate(CACHE_KEY_USERS);
    return demoUsers[idx].contracts;
  }
  return 0;
}

window.logout = logout;
