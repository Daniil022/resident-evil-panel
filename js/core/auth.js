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

  // Авто-разбан/размут, если истёк срок
  try {
    const { autoLiftExpired } = await import("./punishments.js");
    await autoLiftExpired(found.uid);

    // Перечитываем после авто-разбана
    const fresh = await getUserById(found.uid);
    if (fresh) found.data = fresh.data;
  } catch (e) {}

  const warnCount = found.data.warn || 0;
  if (warnCount >= MAX_WARN || found.data.banned) {
    const reason = found.data.banReason ? " (" + found.data.banReason + ")" : "";
    return { ok: false, error: "АККАУНТ ЗАБАНЕН" + reason };
  }

  const user = {
    uid: found.uid,
    login: found.data.login,
    role: found.data.role || "soul",
    division: found.data.division || null,
    avatar: found.data.avatar || null,
    muted: found.data.muted || false,
    mutedUntil: found.data.mutedUntil || null,
    mutedReason: found.data.mutedReason || ""
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
    muted: false,
    contracts: 0,
    avatar: null,
    punishments: [],
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
    const cached = cacheGet(CACHE_KEY_USERS, 300000);
    if (cached) return cached;
  }

  let users = [];

  try {
    const snap = await getDocs(collection(db, "users"));
    if (!snap.empty) {
      users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    }
  } catch (e) {}

  if (users.length === 0) {
    users = getDemoUsers();
  }

  // Обогащаем lastSeen из presence
  try {
    const presenceSnap = await getDocs(collection(db, "presence"));
    const seenMap = {};
    presenceSnap.forEach(d => {
      const data = d.data();
      if (data.lastSeen) seenMap[d.id] = data.lastSeen;
    });
    users.forEach(u => {
      if (seenMap[u.uid]) u.lastSeen = seenMap[u.uid];
    });
  } catch (e) {}

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

// ==================== WARN (прокси на punishments.js) ====================
export async function warnUser(uid, reason = "") {
  const { addWarn } = await import("./punishments.js");
  return addWarn(uid, reason);
}

export async function unwarnUser(uid) {
  const { removeWarn } = await import("./punishments.js");
  return removeWarn(uid);
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

export function isAlly(user) {
  if (!user) return false;
  return user.role === "ally";
}

export function isResident(user) {
  if (!user) return false;
  return user.role !== "ally";
}

export const WARN_LIMIT = MAX_WARN;

window.logout = logout;
