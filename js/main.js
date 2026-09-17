// js/main.js
// Точка входа приложения

import { tryRestoreSession, login, logout } from "./core/auth.js";
import { setCurrentUser, getCurrentUser } from "./core/state.js";
import { initRouter, switchTab } from "./core/router.js";
import { toast } from "./core/utils.js";

// ==================== ЗАПУСК ====================
document.addEventListener("DOMContentLoaded", () => {
  setupAuthScreen();
  const session = tryRestoreSession();
  if (session) {
    enterApp(session);
  } else {
    showAuthScreen();
  }
});

// ==================== ЭКРАН АВТОРИЗАЦИИ ====================
function setupAuthScreen() {
  const btn = document.getElementById("loginBtn");
  const loginInput = document.getElementById("loginInput");
  const pinInput = document.getElementById("pinInput");
  const error = document.getElementById("authError");
  const hint = document.getElementById("authDefaultHint");

  // Подсказка по демо-входу
  if (hint) {
    hint.innerHTML = `🔑 Демо-вход: <b>Emperor</b> / PIN <b>1111</b><br>или <b>Lord_Darkness</b> / <b>2222</b>`;
  }

  btn.addEventListener("click", doLogin);
  pinInput.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
  loginInput.addEventListener("keydown", e => { if (e.key === "Enter") pinInput.focus(); });

  async function doLogin() {
    error.classList.remove("show");
    btn.disabled = true;
    btn.textContent = "ПРОВЕРКА...";

    const res = await login(loginInput.value.trim(), pinInput.value.trim());

    btn.disabled = false;
    btn.textContent = "ВОЙТИ В СИСТЕМУ";

    if (!res.ok) {
      error.textContent = res.error;
      error.classList.add("show");
      return;
    }

    enterApp(res.user);
  }

  loginInput.focus();
}

// ==================== ВХОД В ПРИЛОЖЕНИЕ ====================
function enterApp(user) {
  document.getElementById("authScreen").classList.add("hidden");
  document.getElementById("app").style.display = "block";

  // Заполняем шапку
  const nameEl = document.getElementById("userName");
  const roleEl = document.getElementById("userRoleTag");
  if (nameEl) nameEl.textContent = user.login;
  if (roleEl) {
    roleEl.textContent = user.role;
    roleEl.className = "role-tag";
    if (user.role === "Император") roleEl.classList.add("gold");
    if (user.role === "Лорд Тьмы") roleEl.classList.add("red");
  }

  // ADMIN виден только Императору и Лорду Тьмы
  const navAdmin = document.getElementById("navAdmin");
  if (navAdmin) {
    if (["Император", "Лорд Тьмы"].includes(user.role)) {
      navAdmin.classList.remove("hidden");
    } else {
      navAdmin.classList.add("hidden");
    }
  }

  // Инициализация роутера
  initRouter();

  // Приветствие
  toast(`Добро пожаловать, ${user.login}`, "ok");
}
