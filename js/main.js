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
import { initMusic } from "./modules/music.js";
import { initAlbum } from "./modules/album.js";
import { initCaptas } from "./modules/captas.js";
import { setupAvatarClick, updateDashAvatar } from "./modules/profile.js";
import { preloadColorData, applyColorsToDOM, getRoleColor, getRoleName } from "./core/colorize.js";

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

  if (avatarEl) {
    if (user.avatar) {
      avatarEl.innerHTML = '<img src="' + user.avatar + '" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
      avatarEl.style.padding = "0";
      avatarEl.style.overflow = "hidden";
    } else {
      avatarEl.textContent = user.login.charAt(0).toUpperCase();
    }
  }

  const navAdmin = document.getElementById("navAdmin");
  const isAdminRole = ["emperor", "lord"].includes(user.role);
  if (navAdmin) navAdmin.classList.toggle("hidden", !isAdminRole);

  initRouter();
  initDashboard();
  applyColorsToDOM();

  setupAvatarClick();
  if (user.avatar) updateDashAvatar(user);

  const inited = {
    chat: false, admin: false, contracts: false,
    warehouse: false, allies: false, rules: false,
    accolades: false, music: false, album: false,
    captas: false, nicks: false, ranks: false
  };

  window.addEventListener("tabChange", (e) => {
    const tab = e.detail.tab;

    if (tab === "chat" && !inited.chat) { inited.chat = true; try { initChat(); } catch (err) {} }
    if (tab === "admin" && isAdminRole && !inited.admin) { inited.admin = true; try { initAdmin(); } catch (err) {} }
    if (tab === "contracts" && !inited.contracts) { inited.contracts = true; try { initContracts(); } catch (err) {} }
    if (tab === "warehouse" && !inited.warehouse) { inited.warehouse = true; try { initWarehouse(); } catch (err) {} }
    if (tab === "allies" && !inited.allies) { inited.allies = true; try { initAllies(); } catch (err) {} }
    if (tab === "rules" && !inited.rules) { inited.rules = true; try { initRules(); } catch (err) {} }
    if (tab === "accolade" && !inited.accolades) { inited.accolades = true; try { initAccolades(); } catch (err) {} }
    if (tab === "music" && !inited.music) { inited.music = true; try { initMusic(); } catch (err) {} }
    if (tab === "album" && !inited.album) { inited.album = true; try { initAlbum(); } catch (err) {} }
    if (tab === "containers" && !inited.captas) { inited.captas = true; try { initCaptas(); } catch (err) {} }
    if (tab === "nicks" && !inited.nicks) { inited.nicks = true; try { initNicks(); } catch (err) {} }
    if (tab === "ranks" && !inited.ranks) { inited.ranks = true; try { initRanks(); } catch (err) {} }
  });

  const hash = location.hash.replace("#", "");
  if (hash === "chat") { inited.chat = true; try { initChat(); } catch (e) {} }
  if (hash === "contracts") { inited.contracts = true; try { initContracts(); } catch (e) {} }
  if (hash === "warehouse") { inited.warehouse = true; try { initWarehouse(); } catch (e) {} }
  if (hash === "allies") { inited.allies = true; try { initAllies(); } catch (e) {} }
  if (hash === "rules") { inited.rules = true; try { initRules(); } catch (e) {} }
  if (hash === "accolade") { inited.accolades = true; try { initAccolades(); } catch (e) {} }
  if (hash === "music") { inited.music = true; try { initMusic(); } catch (e) {} }
  if (hash === "album") { inited.album = true; try { initAlbum(); } catch (e) {} }
  if (hash === "containers") { inited.captas = true; try { initCaptas(); } catch (e) {} }
  if (hash === "nicks") { inited.nicks = true; try { initNicks(); } catch (e) {} }
  if (hash === "ranks") { inited.ranks = true; try { initRanks(); } catch (e) {} }

  const createBtn = document.getElementById("createContractBtn");
  if (createBtn) createBtn.addEventListener("click", openCreateContract);

  toast(`Добро пожаловать, ${user.login}`, "ok");
}

window.addEventListener("beforeunload", () => {
  try { destroyChat(); } catch (e) {}
  try { destroyContracts(); } catch (e) {}
});
