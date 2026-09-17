// js/core/state.js
// Глобальное состояние приложения

const STATE_KEY = "re_panel_session";

let currentUser = null;

export function setCurrentUser(user) {
  currentUser = user;
  if (user) {
    localStorage.setItem(STATE_KEY, JSON.stringify({
      uid: user.uid,
      login: user.login,
      role: user.role,
      sessionAt: Date.now()
    }));
  } else {
    localStorage.removeItem(STATE_KEY);
  }
}

export function getCurrentUser() {
  return currentUser;
}

export function restoreSession() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Сессия живёт 7 дней
    if (Date.now() - data.sessionAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STATE_KEY);
      return null;
    }
    currentUser = data;
    return data;
  } catch {
    return null;
  }
}

export function isAdmin() {
  return currentUser && ["Император", "Лорд Тьмы"].includes(currentUser.role);
}

export function clearSession() {
  currentUser = null;
  localStorage.removeItem(STATE_KEY);
}
