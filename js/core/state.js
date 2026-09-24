// js/core/state.js
const STATE_KEY = "re_panel_session";
let currentUser = null;

export function setCurrentUser(user) {
  currentUser = user;
  if (user) {
    localStorage.setItem(STATE_KEY, JSON.stringify({
      uid: user.uid,
      login: user.login,
      role: user.role,
      division: user.division,
      avatar: user.avatar,
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

// ✅ FIX: сравниваем с ID ролей, а не с русскими названиями
export function isAdmin() {
  return !!currentUser && ["emperor", "lord"].includes(currentUser.role);
}

export function isLeader() {
  return !!currentUser && currentUser.role === "emperor";
}

export function clearSession() {
  currentUser = null;
  localStorage.removeItem(STATE_KEY);
}
