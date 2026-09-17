// js/core/auth.js
// Авторизация: логин + PIN
// Работает и с Firebase, и в демо-режиме (localStorage)

import { db, auth } from "../firebase-init.js";
import {
  collection, query, where, getDocs, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { setCurrentUser, restoreSession, clearSession } from "./state.js";
import { toast, addLog } from "./utils.js";

const DEMO_USERS_KEY = "re_panel_demo_users";

// ==== ДЕМО-ПОЛЬЗОВАТЕЛИ (для офлайн-теста без Firebase) ====
function getDemoUsers() {
  const raw = localStorage.getItem(DEMO_USERS_KEY);
  if (raw) return JSON.parse(raw);
  const defaults = [
    { uid: "demo-emperor", login: "Emperor", pin: "1111", role: "Император" },
    { uid: "demo-lord",    login: "Lord_Darkness", pin: "2222", role: "Лорд Тьмы" },
    { uid: "demo-knight",  login: "Death_Knight", pin: "3333", role: "Рыцарь Смерти" },
    { uid: "demo-skeleton",login: "Horror_Skeleton", pin: "4444", role: "Скелет Ужаса" },
    { uid: "demo-soul",    login: "Dark_Soul", pin: "5555", role: "Тёмная душа" }
  ];
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(defaults));
  return defaults;
}

function saveDemoUsers(users) {
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
}

// ==== ПРОВЕРКА ЛОГИНА ====
export async function login(loginName, pin) {
  if (!loginName || !pin) {
    return { ok: false, error: "Заполните все поля" };
  }

  // Валидация формата Nick_Name
  if (!/^[A-Za-z0-9_]{3,32}$/.test(loginName)) {
    return { ok: false, error: "Логин: латиница, цифры, _ (3-32 символа)" };
  }

  // Попытка через Firebase
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("login", "==", loginName));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const docSnap = snap.docs[0];
      const data = docSnap.data();
      if (data.pin !== pin) {
        return { ok: false, error: "Неверный PIN-код" };
      }
      const user = {
        uid: docSnap.id,
        login: data.login,
        role: data.role || "Тёмная душа"
      };
      setCurrentUser(user);
      return { ok: true, user };
    }
    // Если Firebase ответил, но юзера нет — проверяем демо
  } catch (e) {
    console.warn("Firebase недоступен, работаем в демо-режиме:", e.message);
  }

  // Демо-режим
  const demoUsers = getDemoUsers();
  const found = demoUsers.find(u => u.login === loginName);
  if (!found) {
    return { ok: false, error: "Пользователь не найден" };
  }
  if (found.pin !== pin) {
    return { ok: false, error: "Неверный PIN-код" };
  }

  const user = { uid: found.uid, login: found.login, role: found.role };
  setCurrentUser(user);
  return { ok: true, user };
}

// ==== ВЫХОД ====
export function logout() {
  clearSession();
  window.location.reload();
}

// ==== ВОССТАНОВЛЕНИЕ СЕССИИ ====
export function tryRestoreSession() {
  return restoreSession();
}

// ==== ЭКСПОРТ ДЛЯ ADMIN (создание юзера) ====
export async function createUser({ login, pin, role }) {
  if (!/^[A-Za-z0-9_]{3,32}$/.test(login)) {
    throw new Error("Неверный формат логина");
  }
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error("PIN: 4-8 цифр");
  }

  // Firebase
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("login", "==", login));
    const snap = await getDocs(q);
    if (!snap.empty) throw new Error("Логин уже занят");

    const newRef = doc(collection(db, "users"));
    await setDoc(newRef, { login, pin, role, createdAt: Date.now() });
    return { uid: newRef.id, login, role };
  } catch (e) {
    if (e.message === "Логин уже занят") throw e;
    console.warn("Firebase недоступен, создаю в демо-режиме");
  }

  // Демо
  const demoUsers = getDemoUsers();
  if (demoUsers.find(u => u.login === login)) {
    throw new Error("Логин уже занят");
  }
  const user = { uid: "demo-" + Date.now(), login, pin, role };
  demoUsers.push(user);
  saveDemoUsers(demoUsers);
  return user;
}

// ==== СПИСОК ЮЗЕРОВ (для ADMIN) ====
export async function listUsers() {
  try {
    const snap = await getDocs(collection(db, "users"));
    if (!snap.empty) {
      return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    }
  } catch (e) {
    console.warn("Firebase недоступен, читаю демо-юзеров");
  }
  return getDemoUsers();
}

// ==== УДАЛЕНИЕ ====
export async function deleteUser(uid) {
  try {
    const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await deleteDoc(doc(db, "users", uid));
    return;
  } catch (e) {
    console.warn("Firebase недоступен, удаляю в демо-режиме");
  }
  const demoUsers = getDemoUsers().filter(u => u.uid !== uid);
  saveDemoUsers(demoUsers);
}

// ==== СМЕНА PIN ====
export async function changePin(uid, newPin) {
  if (!/^\d{4,8}$/.test(newPin)) throw new Error("PIN: 4-8 цифр");
  try {
    const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await updateDoc(doc(db, "users", uid), { pin: newPin });
    return;
  } catch (e) {
    console.warn("Firebase недоступен, меняю PIN в демо-режиме");
  }
  const demoUsers = getDemoUsers();
  const idx = demoUsers.findIndex(u => u.uid === uid);
  if (idx >= 0) {
    demoUsers[idx].pin = newPin;
    saveDemoUsers(demoUsers);
  }
}

// ==== СМЕНА РОЛИ ====
export async function changeRole(uid, newRole) {
  const valid = ["Император", "Лорд Тьмы", "Рыцарь Смерти", "Скелет Ужаса", "Тёмная душа"];
  if (!valid.includes(newRole)) throw new Error("Неверная роль");

  try {
    const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await updateDoc(doc(db, "users", uid), { role: newRole });
    return;
  } catch (e) {
    console.warn("Firebase недоступен, меняю роль в демо-режиме");
  }
  const demoUsers = getDemoUsers();
  const idx = demoUsers.findIndex(u => u.uid === uid);
  if (idx >= 0) {
    demoUsers[idx].role = newRole;
    saveDemoUsers(demoUsers);
  }
}

// Глобальный доступ из inline-обработчиков
window.logout = logout;
