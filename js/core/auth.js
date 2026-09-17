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
const MAX_WARN = 3;

// ==================== ДЕМО ====================
function getDemoUsers() {
  const raw = localStorage.getItem(DEMO_USERS_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  const defaults = [
    { uid: "demo-emperor",  login: "Emperor",         pin: "1111", role: "Император",     warn: 0, banned: false, contracts: 0, createdAt: Date.now() - 86400000 * 30 },
    { uid: "demo-lord",     login: "Lord_Darkness",   pin: "2222", role: "Лорд Тьмы",     warn: 0, banned: false, contracts: 0, createdAt: Date.now() - 86400000 * 25 },
    { uid: "demo-knight",   login: "Death_Knight",    pin: "3333", role: "Рыцарь Смерти", warn: 0, banned: false, contracts: 0, createdAt: Date.now() - 86400000 * 20 },
    { uid: "demo-skeleton", login: "Horror_Skeleton", pin: "4444", role: "Скелет Ужаса",  warn: 0, banned: false, contracts: 0, createdAt: Date.now() - 86400000 * 15 },
    { uid: "demo-soul",     login: "Dark_Soul",       pin: "5555", role: "Тёмная душа",   warn: 0, banned: false, contracts: 0, createdAt: Date.now() - 86400000 * 10 }
  ];
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(defaults));
  return defaults;
}

function saveDemoUsers(users) {
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
}

// ==================== ПОИСК ====================
async function findUserByLogin(loginName) {
  try {
    const q = query(collection(db, "users"), where("login", "==", loginName));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { source: "firebase", ref: d.ref, uid: d.id, data: d.data() };
    }
  } catch (e) {}
  const demoUsers = getDemoUsers();
  const found = demoUsers.find(u => u.login === loginName);
  if (found) return { source: "demo", uid: found.uid, data: found };
  return null;
}

async function getUserById(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      return { source: "firebase", ref: snap.ref, uid: snap.id, data: snap.data() };
    }
  } catch (e) {}
  const demoUsers = getDemoUsers();
  const found = demoUsers.find(u => u.uid === uid);
  if (found) return { source: "demo", uid: found.uid, data: found };
  return null;
}

// ==================== ЛОГИН ====================
export async function login(loginName, pin) {
  if (!loginName || !pin) return { ok: false, error: "Заполните все поля" };
  if (!/^[A-Za-z0-9_]{3,32}$/.test(loginName)) {
    return { ok: false, error: "Логин: латиница, цифры, _ (3-32)" };
  }

  const found = await findUserByLogin(loginName);
  if (!found) return { ok: false, error: "Пользователь не найден" };
  if (found.data.pin !== pin) return { ok: false, error: "Неверный PIN-код" };

  const warnCount = found.data.warn || 0;
  if (warnCount >= MAX_WARN || found.data.banned) {
    return { ok: false, error: `АККАУНТ ЗАБАНЕН (${warnCount}/${MAX_WARN} Warn)` };
  }

  const user = {
    uid: found.uid,
    login: found.data.login,
    role: found.data.role || "Тёмная душа"
  };
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

  const existing = await findUserByLogin(login);
  if (existing) throw new Error("Логин уже занят");

  const newUser = { login, pin, role, warn: 0, banned: false, contracts: 0, createdAt: Date.now() };

  try {
    const newRef = doc(collection(db, "users"));
    await setDoc(newRef, newUser);
    cacheInvalidate(CACHE_KEY_USERS);
    return { uid: newRef.id, ...newUser };
  } catch (e) {}

  const user = { uid: "demo-" + Date.now(), ...newUser };
  const demoUsers = getDemoUsers();
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
  } catch (e) {}
  const users = getDemoUsers();
  cacheSet(CACHE_KEY_USERS, users);
  return users;
}

// ==================== УДАЛЕНИЕ ====================
export async function deleteUser(uid) {
  let ok = false;
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await deleteDoc(ref);
      ok = true;
    }
  } catch (e) {}

  const demoUsers = getDemoUsers();
  const before = demoUsers.length;
  const after = demoUsers.filter(u => u.uid !== uid);
  if (after.length !== before) {
    saveDemoUsers(after);
    ok = true;
  }
  cacheInvalidate(CACHE_KEY_USERS);
  if (!ok) throw new Error("Пользователь не найден");
  return true;
}

// ==================== PIN / РОЛЬ / ЦВЕТ ====================
export async function changePin(uid, newPin) {
  if (!/^\d{4,8}$/.test(newPin)) throw new Error("PIN: 4-8 цифр");
  const found = await getUserById(uid);
  if (!found) throw new Error("Пользователь не найден");
  if (found.source === "firebase") {
    await updateDoc(found.ref, { pin: newPin });
  } else {
    const demoUsers = getDemoUsers();
    const idx = demoUsers.findIndex(u => u.uid === uid);
    if (idx >= 0) { demoUsers[idx].pin = newPin; saveDemoUsers(demoUsers); }
  }
  cacheInvalidate(CACHE_KEY_USERS);
}

export const VALID_ROLES = ["Император", "Лорд Тьмы", "Рыцарь Смерти", "Скелет Ужаса", "Тёмная душа"];

export async function changeRole(uid, newRole) {
  if (!VALID_ROLES.includes(newRole)) throw new Error("Неверная роль");
  const found = await getUserById(uid);
  if (!found) throw new Error("Пользователь не найден");
  if (found.source === "firebase") {
    await updateDoc(found.ref, { role: newRole });
  } else {
    const demoUsers = getDemoUsers();
    const idx = demoUsers.findIndex(u => u.uid === uid);
    if (idx >= 0) { demoUsers[idx].role = newRole; saveDemoUsers(demoUsers); }
  }
  cacheInvalidate(CACHE_KEY_USERS);
}

export async function setRoleColor(uid, hexColor) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hexColor)) throw new Error("Неверный HEX");
  const found = await getUserById(uid);
  if (!found) throw new Error("Пользователь не найден");
  if (found.source === "firebase") {
    await updateDoc(found.ref, { roleColor: hexColor });
  } else {
    const demoUsers = getDemoUsers();
    const idx = demoUsers.findIndex(u => u.uid === uid);
    if (idx >= 0) { demoUsers[idx].roleColor = hexColor; saveDemoUsers(demoUsers); }
  }
  cacheInvalidate(CACHE_KEY_USERS);
}

// ==================== WARN ====================
export async function warnUser(uid, reason = "") {
  const found = await getUserById(uid);
  if (!found) throw new Error("Пользователь не найден");

  const current = found.data.warn || 0;
  if (current >= MAX_WARN) throw new Error(`Максимум ${MAX_WARN} Warn. Аккаунт забанен.`);

  const newWarn = current + 1;
  const updates = { warn: newWarn, lastWarnReason: reason, lastWarnAt: Date.now() };
  if (newWarn >= MAX_WARN) {
    updates.banned = true;
    updates.bannedAt = Date.now();
  }

  if (found.source === "firebase") {
    await updateDoc(found.ref, updates);
  } else {
    const demoUsers = getDemoUsers();
    const idx = demoUsers.findIndex(u => u.uid === uid);
    if (idx >= 0) { Object.assign(demoUsers[idx], updates); saveDemoUsers(demoUsers); }
  }
  cacheInvalidate(CACHE_KEY_USERS);
  return { warn: newWarn, banned: updates.banned === true };
}

export async function unwarnUser(uid) {
  const found = await getUserById(uid);
  if (!found) throw new Error("Пользователь не найден");

  const current = found.data.warn || 0;
  if (current === 0) throw new Error("У пользователя нет Warn");

  const newWarn = Math.max(0, current - 1);
  const updates = { warn: newWarn, banned: newWarn >= MAX_WARN };

  if (found.source === "firebase") {
    await updateDoc(found.ref, updates);
  } else {
    const demoUsers = getDemoUsers();
    const idx = demoUsers.findIndex(u => u.uid === uid);
    if (idx >= 0) { Object.assign(demoUsers[idx], updates); saveDemoUsers(demoUsers); }
  }
  cacheInvalidate(CACHE_KEY_USERS);
  return { warn: newWarn, banned: updates.banned };
}

// ==================== КОНТРАКТЫ ====================
export async function incrementContracts(uid, by = 1) {
  const found = await getUserById(uid);
  if (!found) throw new Error("Пользователь не найден");
  const current = found.data.contracts || 0;
  const newVal = current + by;
  if (found.source === "firebase") {
    await updateDoc(found.ref, { contracts: newVal });
  } else {
    const demoUsers = getDemoUsers();
    const idx = demoUsers.findIndex(u => u.uid === uid);
    if (idx >= 0) { demoUsers[idx].contracts = newVal; saveDemoUsers(demoUsers); }
  }
  cacheInvalidate(CACHE_KEY_USERS);
  return newVal;
}

export const WARN_LIMIT = MAX_WARN;

window.logout = logout;
