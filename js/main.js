// js/main.js
import { tryRestoreSession, login } from "./core/auth.js";
import { initRouter } from "./core/router.js";
import { toast } from "./core/utils.js";
import { initDashboard } from "./core/dashboard.js";
import { initAdmin } from "./admin/admin-panel.js";
import { initChat, destroyChat } from "./modules/chat/chat.js";
import { initContracts, destroyContracts, openCreateContract } from "./modules/contracts/contracts.js";
import { preloadColorData, applyColorsToDOM, getRoleColor, getRoleName, getDivisionName, getDivisionColor } from "./core/colorize.js";

document.addEventListener("DOMContentLoaded", async () => {
  await preloadColorData();
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

  if (hint) hint.innerHTML = `🔑 Демо-вход: <b>Emperor</b> / PIN <b>1111</b>`;

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
    roleEl.textContent = getRoleName(user.role);
    roleEl.className = "role-tag";
    roleEl.style.color = getRoleColor(user.role);
  }
  if (avatarEl) avatarEl.textContent = user.login.charAt(0).toUpperCase();

  const navAdmin = document.getElementById("navAdmin");
  const isAdminRole = ["emperor", "lord"].includes(user.role);
  if (navAdmin) navAdmin.classList.toggle("hidden", !isAdminRole);

  initRouter();
  initDashboard();
  applyColorsToDOM();

  const inited = { chat: false, admin: false, contracts: false };

  window.addEventListener("tabChange", (e) => {
    const tab = e.detail.tab;
    if (tab === "chat" && !inited.chat) { inited.chat = true; initChat(); }
    if (tab === "admin" && isAdminRole && !inited.admin) { inited.admin = true; initAdmin(); }
    if (tab === "contracts" && !inited.contracts) { inited.contracts = true; initContracts(); }
  });

  if (location.hash === "#chat" && !inited.chat) { inited.chat = true; initChat(); }
  if (location.hash === "#contracts" && !inited.contracts) { inited.contracts = true; initContracts(); }

  const createBtn = document.getElementById("createContractBtn");
  if (createBtn) createBtn.addEventListener("click", openCreateContract);

  toast(`Добро пожаловать, ${user.login}`, "ok");
}

window.addEventListener("beforeunload", () => {
  destroyChat();
  destroyContracts();
});
