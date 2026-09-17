// js/main.js
import { tryRestoreSession, login } from "./core/auth.js";
import { initRouter } from "./core/router.js";
import { toast } from "./core/utils.js";
import { initDashboard } from "./core/dashboard.js";
import { initAdmin } from "./admin/admin-panel.js";
import { initChat, destroyChat } from "./modules/chat/chat.js";
import { initContracts, destroyContracts, openCreateContract } from "./modules/contracts/contracts.js";
import { preloadColorData, applyColorsToDOM, getRoleColor, getRoleName } from "./core/colorize.js";

// ==================== ЗАПУСК ====================
document.addEventListener("DOMContentLoaded", () => {
  setupAuthScreen();

  // Предзагрузка ролей В ФОНЕ — не блокирует вход
  preloadColorData().catch(e => console.warn("Roles preload failed:", e));

  // Проверка сессии
  const session = tryRestoreSession();
  if (session) enterApp(session);
  else showAuthScreen();
});

function showAuthScreen() {
  document.getElementById("authScreen").classList.remove("hidden");
  document.getElementById("app").style.display = "none";
}

// ==================== ЭКРАН АВТОРИЗАЦИИ ====================
function setupAuthScreen() {
  const btn = document.getElementById("loginBtn");
  const loginInput = document.getElementById("loginInput");
  const pinInput = document.getElementById("pinInput");
  const error = document.getElementById("authError");
  const hint = document.getElementById("authDefaultHint");

  if (hint) hint.innerHTML = `🔑 Демо-вход: <b>Emperor</b> / PIN <b>1111</b>`;

  btn.addEventListener("click", doLogin);
  pinInput.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
  loginInput.addEventListener("keydown", e => { if (e.key === "Enter") pinInput.focus(); });

  async function doLogin() {
    error.classList.remove("show");
    btn.disabled = true;
    btn.textContent = "ПРОВЕРКА...";

    try {
      const res = await login(loginInput.value.trim(), pinInput.value.trim());
      btn.disabled = false;
      btn.textContent = "ВОЙТИ В СИСТЕМУ";

      if (!res.ok) {
        error.textContent = res.error;
        error.classList.add("show");
        return;
      }

      // Догружаем роли перед входом в интерфейс
      try {
        await preloadColorData();
      } catch (e) {
        console.warn("Color preload failed, using fallback");
      }

      enterApp(res.user);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "ВОЙТИ В СИСТЕМУ";
      error.textContent = "Ошибка: " + e.message;
      error.classList.add("show");
      console.error(e);
    }
  }

  loginInput.focus();
}

// ==================== ВХОД В ПРИЛОЖЕНИЕ ====================
function enterApp(user) {
  document.getElementById("authScreen").classList.add("hidden");
  document.getElementById("app").style.display = "block";

  const nameEl = document.getElementById("userName");
  const roleEl = document.getElementById("userRoleTag");
  const avatarEl = document.getElementById("userAvatar");

  if (nameEl) nameEl.textContent = user.login;

  if (roleEl) {
    try {
      roleEl.textContent = getRoleName(user.role);
      roleEl.className = "role-tag";
      roleEl.style.color = getRoleColor(user.role);
    } catch (e) {
      roleEl.textContent = user.role || "—";
    }
  }

  if (avatarEl) avatarEl.textContent = user.login.charAt(0).toUpperCase();

  // ADMIN виден только Императору и Лорду Тьмы
  const navAdmin = document.getElementById("navAdmin");
  const isAdminRole = ["emperor", "lord"].includes(user.role);
  if (navAdmin) navAdmin.classList.toggle("hidden", !isAdminRole);

  initRouter();
  initDashboard();
  applyColorsToDOM();

  const inited = { chat: false, admin: false, contracts: false };

  window.addEventListener("tabChange", (e) => {
    const tab = e.detail.tab;

    if (tab === "chat" && !inited.chat) {
      inited.chat = true;
      try { initChat(); } catch (err) { console.warn("Chat init failed:", err); }
    }

    if (tab === "admin" && isAdminRole && !inited.admin) {
      inited.admin = true;
      try { initAdmin(); } catch (err) { console.warn("Admin init failed:", err); }
    }

    if (tab === "contracts" && !inited.contracts) {
      inited.contracts = true;
      try { initContracts(); } catch (err) { console.warn("Contracts init failed:", err); }
    }
  });

  // Если открыли по хэшу — инициализируем сразу
  if (location.hash === "#chat" && !inited.chat) {
    inited.chat = true;
    try { initChat(); } catch (err) { console.warn("Chat init failed:", err); }
  }
  if (location.hash === "#contracts" && !inited.contracts) {
    inited.contracts = true;
    try { initContracts(); } catch (err) { console.warn("Contracts init failed:", err); }
  }

  // Кнопка «Создать контракт»
  const createBtn = document.getElementById("createContractBtn");
  if (createBtn) createBtn.addEventListener("click", openCreateContract);

  toast(`Добро пожаловать, ${user.login}`, "ok");
}

// ==================== ВЫХОД ====================
window.addEventListener("beforeunload", () => {
  try { destroyChat(); } catch (e) {}
  try { destroyContracts(); } catch (e) {}
});
