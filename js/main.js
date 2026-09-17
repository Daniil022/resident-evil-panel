// js/main.js
import { tryRestoreSession, login } from "./core/auth.js";
import { initRouter } from "./core/router.js";
import { toast } from "./core/utils.js";
import { initDashboard } from "./core/dashboard.js";
import { initAdmin } from "./admin/admin-panel.js";
import { initChat, destroyChat } from "./modules/chat/chat.js";
import { initContracts, destroyContracts, openCreateContract } from "./modules/contracts/contracts.js";
import { initNicks, initRanks } from "./modules/nicks.js";
import { initWarehouse } from "./modules/warehouse.js";
import { initAllies } from "./modules/allies.js";
import { initRules } from "./modules/rules.js";
import { initAccolades } from "./modules/accolades.js";
import { preloadColorData, applyColorsToDOM, getRoleColor, getRoleName } from "./core/colorize.js";

// ==================== ЗАПУСК ====================
document.addEventListener("DOMContentLoaded", () => {
  setupAuthScreen();
  preloadColorData().catch(e => console.warn("Roles preload failed:", e));
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

      try { await preloadColorData(); } catch (e) {}
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

  const navAdmin = document.getElementById("navAdmin");
  const isAdminRole = ["emperor", "lord"].includes(user.role);
  if (navAdmin) navAdmin.classList.toggle("hidden", !isAdminRole);

  initRouter();
  initDashboard();
  applyColorsToDOM();

  // Ники и Ранги — грузим сразу (в фоне)
  try { initNicks(); } catch (e) { console.warn("Nicks init failed:", e); }
  try { initRanks(); } catch (e) { console.warn("Ranks init failed:", e); }

  const inited = {
    chat: false, admin: false, contracts: false,
    warehouse: false, allies: false, rules: false, accolades: false
  };

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

    if (tab === "warehouse" && !inited.warehouse) {
      inited.warehouse = true;
      try { initWarehouse(); } catch (err) { console.warn("Warehouse init failed:", err); }
    }

    if (tab === "allies" && !inited.allies) {
      inited.allies = true;
      try { initAllies(); } catch (err) { console.warn("Allies init failed:", err); }
    }

    if (tab === "rules" && !inited.rules) {
      inited.rules = true;
      try { initRules(); } catch (err) { console.warn("Rules init failed:", err); }
    }

    if (tab === "accolade" && !inited.accolades) {
      inited.accolades = true;
      try { initAccolades(); } catch (err) { console.warn("Accolades init failed:", err); }
    }
  });

  // Если открыли по хэшу — инициализируем сразу
  if (location.hash === "#chat" && !inited.chat) {
    inited.chat = true;
    try { initChat(); } catch (err) {}
  }
  if (location.hash === "#contracts" && !inited.contracts) {
    inited.contracts = true;
    try { initContracts(); } catch (err) {}
  }
  if (location.hash === "#warehouse" && !inited.warehouse) {
    inited.warehouse = true;
    try { initWarehouse(); } catch (err) {}
  }
  if (location.hash === "#allies" && !inited.allies) {
    inited.allies = true;
    try { initAllies(); } catch (err) {}
  }
  if (location.hash === "#rules" && !inited.rules) {
    inited.rules = true;
    try { initRules(); } catch (err) {}
  }
  if (location.hash === "#accolade" && !inited.accolades) {
    inited.accolades = true;
    try { initAccolades(); } catch (err) {}
  }

  const createBtn = document.getElementById("createContractBtn");
  if (createBtn) createBtn.addEventListener("click", openCreateContract);

  toast(`Добро пожаловать, ${user.login}`, "ok");
}

// ==================== ВЫХОД ====================
window.addEventListener("beforeunload", () => {
  try { destroyChat(); } catch (e) {}
  try { destroyContracts(); } catch (e) {}
});
