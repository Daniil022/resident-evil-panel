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

function getDemoUsers() {
  const raw = localStorage.getItem(DEMO_USERS_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  const defaults = [
    { uid: "demo-emperor", login: "Emperor", pin: "1111", role: "emperor", division: "leader", warn: 0, banned: false, contracts: 0, createdAt: Date.now() }
  ];
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(defaults));
  return defaults;
}

function saveDemoUsers(users) {
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
}

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

export async function login(loginName, pin) {
  if (!loginName || !pin) return { ok: false, error: "Заполните все поля" };
  if (!/^[A-Za-z0-9_]{3,32}$/.test(loginName)) {
    return { ok: false, error: "Логин: латиница, цифры, _ (3-32)" };
  }

  const found = await findUserByLogin(loginName);
  if (!found) return { ok: false, error: "Пользователь не найден" };
  if (String(found.data.pin) !== String(pin)) return { ok: false, error: "Неверный PIN-код" };

  const warnCount = found.data.warn || 0;
  if (warnCount >= MAX_WARN || found.data.banned) {
    return { ok: false, error: "АККАУНТ ЗАБАНЕН (" + warnCount + "/" + MAX_WARN + " Warn)" };
  }

  const user = {
    uid: found.uid,
    login: found.data.login,
    role: found.data.role || "soul",
    division: found.data.division || null,
    avatar: found.data.avatar || null
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

export async function createUser({ login, pin, role, division = null }) {
  if (!/^[A-Za-z0-9_]{3,32}$/.test(login)) throw new Error("Неверный формат логина");
  if (!/^[0-9]{4,8}$/.test(pin)) throw new Error("PIN: 4-8 цифр");

  const existing = await findUserByLogin(login);
  if (existing) throw new Error("Логин уже занят");

  const newUser = {
    login: login,
    pin: pin,
    role: role,
    division: division,
    warn: 0,
    banned: false,
    contracts: 0,
    avatar: null,
    createdAt: Date.now()
  };

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

export async function listUsers(force = false) {
  if (!force) {
    const cached = cacheGet(CACHE_KEY_USERS, 30000);
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

export async function deleteUser(uid) {
  try { await deleteDoc(doc(db, "users", uid)); } catch (e) {}
  const demoUsers = getDemoUsers().filter(u => u.uid !== uid);
  saveDemoUsers(demoUsers);
  cacheInvalidate(CACHE_KEY_USERS);
}

export async function changePin(uid, newPin) {
  if (!/^[0-9]{4,8}$/.test(newPin)) throw new Error("PIN: 4-8 цифр");
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

export async function changeRole(uid, newRole) {
  if (!newRole) throw new Error("Роль не выбрана");
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

export async function changeDivision(uid, newDivision) {
  const found = await getUserById(uid);
  if (!found) throw new Error("Пользователь не найден");

  if (found.source === "firebase") {
    await updateDoc(found.ref, { division: newDivision });
  } else {
    const demoUsers = getDemoUsers();
    const idx = demoUsers.findIndex(u => u.uid === uid);
    if (idx >= 0) { demoUsers[idx].division = newDivision; saveDemoUsers(demoUsers); }
  }
  cacheInvalidate(CACHE_KEY_USERS);
}

export async function updateAvatar(uid, avatarUrl) {
  const found = await getUserById(uid);
  if (!found) throw new Error("Пользователь не найден");

  if (found.source === "firebase") {
    await updateDoc(found.ref, { avatar: avatarUrl });
  } else {
    const demoUsers = getDemoUsers();
    const idx = demoUsers.findIndex(u => u.uid === uid);
    if (idx >= 0) { demoUsers[idx].avatar = avatarUrl; saveDemoUsers(demoUsers); }
  }
  cacheInvalidate(CACHE_KEY_USERS);
}

export async function warnUser(uid, reason = "") {
  const found = await getUserById(uid);
  if (!found) throw new Error("Пользователь не найден");

  const current = found.data.warn || 0;
  if (current >= MAX_WARN) throw new Error("Максимум " + MAX_WARN + " Warn");

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
  if (current === 0) throw new Error("Нет Warn");

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

export async function clearRoleFromUsers(roleId) {
  const users = await listUsers(true);
  for (const u of users) {
    if (u.role === roleId) {
      try { await changeRole(u.uid, "soul"); } catch (e) {}
    }
  }
}

export async function clearDivisionFromUsers(divId) {
  const users = await listUsers(true);
  for (const u of users) {
    if (u.division === divId) {
      try { await changeDivision(u.uid, null); } catch (e) {}
    }
  }
}

export const WARN_LIMIT = MAX_WARN;

window.logout = logout;
