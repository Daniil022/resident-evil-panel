// js/main.js
import { tryRestoreSession, login } from "./core/auth.js";
import { initRouter } from "./core/router.js";
import { toast } from "./core/utils.js";
import { initDashboard } from "./core/dashboard.js";
import { initAdmin } from "./admin/admin-panel.js";
import { initChat, destroyChat } from "./modules/chat/chat.js";

document.addEventListener("DOMContentLoaded", () => {
  setupAuthScreen();
  const session = tryRestoreSession();
  if (session) enterApp(session);
  else showAuthScreen();
});

function setupAuthScreen() {
  const btn = document.getElementById("loginBtn");
  const loginInput = document.getElementById("loginInput");
  const pinInput = document.getElementById("pinInput");
  const error = document.getElementById("authError");
  const hint = document.getElementById("authDefaultHint");

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

function enterApp(user) {
  document.getElementById("authScreen").classList.add("hidden");
  document.getElementById("app").style.display = "block";

  const nameEl = document.getElementById("userName");
  const roleEl = document.getElementById("userRoleTag");
  const avatarEl = document.getElementById("userAvatar");

  if (nameEl) nameEl.textContent = user.login;
  if (roleEl) {
    roleEl.textContent = user.role;
    roleEl.className = "role-tag";
    if (user.role === "Император") roleEl.classList.add("gold");
    if (user.role === "Лорд Тьмы") roleEl.classList.add("red");
    if (user.role === "Рыцарь Смерти" || user.role === "Скелет Ужаса") roleEl.classList.add("blue");
  }
  if (avatarEl) avatarEl.textContent = user.login.charAt(0).toUpperCase();

  // ADMIN виден только Императору и Лорду Тьмы
  const navAdmin = document.getElementById("navAdmin");
  const isAdminRole = ["Император", "Лорд Тьмы"].includes(user.role);
  if (navAdmin) {
    if (isAdminRole) navAdmin.classList.remove("hidden");
    else navAdmin.classList.add("hidden");
  }

  initRouter();
  initDashboard();
  initChat();

  // ADMIN инициализируется только если есть права
  if (isAdminRole) {
    // Инициализируем при первом открытии вкладки
    window.addEventListener("tabChange", (e) => {
      if (e.detail.tab === "admin") {
        initAdmin();
      }
    });
  }

  toast(`Добро пожаловать, ${user.login}`, "ok");
}

window.addEventListener("beforeunload", () => {
  destroyChat();
});
