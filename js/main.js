// js/main.js
import { tryRestoreSession, login } from "./core/auth.js";
import { submitRegistrationRequest } from "./modules/registration.js";
import { initRouter } from "./core/router.js";
import { toast, initGlobalErrorHandler } from "./core/utils.js";
import { initDashboard } from "./core/dashboard.js";
import { initSounds } from "./core/sounds.js";
import { setupSoundButton } from "./core/sounds-panel.js";
import { initPWA } from "./core/pwa.js";
import { startAutoBackupTimer } from "./core/backup-manager.js";
import { initAdmin } from "./admin/admin-panel.js";
import { initApplicationsPage } from "./modules/applications-page.js";
import { initChat, destroyChat } from "./modules/chat/chat.js";
import { destroyReadSubs } from "./modules/chat/chat-read.js";
import { initContracts, destroyContracts, openCreateContract } from "./modules/contracts/contracts.js";
import { initNicks, initRanks } from "./modules/nicks.js";
import { initAllies } from "./modules/allies.js";
import { initRules } from "./modules/rules.js";
import { initMusic } from "./modules/music.js";
import { initAlbum } from "./modules/album.js";
import { initCaptas } from "./modules/captas.js";
import { initPremiums } from "./modules/premiums.js";
import { setupAvatarClick, updateDashAvatar } from "./modules/profile.js";
import { setupProfileClicks } from "./modules/profile-view.js";
import { initOnline, renderOnline } from "./modules/online.js";
import { preloadColorData, applyColorsToDOM, getRoleColor, getRoleName } from "./core/colorize.js";

document.addEventListener("DOMContentLoaded", () => {
  // ✅ Глобальная обработка ошибок
  initGlobalErrorHandler();

  initSounds();
  initPWA();
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

  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const showRegisterBtn = document.getElementById("showRegisterBtn");
  const showLoginBtn = document.getElementById("showLoginBtn");
  const registerBtn = document.getElementById("registerBtn");
  const regError = document.getElementById("regError");

  if (hint) hint.innerHTML = '🔑 Демо-вход: <b>Emperor</b> / PIN <b>1111</b>';

  btn.addEventListener("click", doLogin);
  pinInput.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
  loginInput.addEventListener("keydown", e => { if (e.key === "Enter") pinInput.focus(); });

  showRegisterBtn.addEventListener("click", () => {
    loginForm.style.display = "none";
    registerForm.style.display = "block";
    document.getElementById("regNick")?.focus();
  });

  showLoginBtn.addEventListener("click", () => {
    registerForm.style.display = "none";
    loginForm.style.display = "block";
    regError.classList.remove("show");
  });

  registerBtn.addEventListener("click", doRegister);

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

  async function doRegister() {
    regError.classList.remove("show");
    const nick = document.getElementById("regNick").value.trim();
    const pin = document.getElementById("regPin").value.trim();
    const pin2 = document.getElementById("regPin2").value.trim();
    const typeEl = document.querySelector('input[name="regType"]:checked');
    const type = typeEl ? typeEl.value : "resident";

    if (pin !== pin2) {
      regError.textContent = "PIN-коды не совпадают";
      regError.classList.add("show");
      return;
    }

    registerBtn.disabled = true;
    registerBtn.textContent = "ОТПРАВКА...";

    try {
      await submitRegistrationRequest(nick, pin, type);
      toast("Заявка отправлена! Ожидайте одобрения лидера.", "ok");
      registerForm.style.display = "none";
      loginForm.style.display = "block";
      document.getElementById("regNick").value = "";
      document.getElementById("regPin").value = "";
      document.getElementById("regPin2").value = "";
    } catch (e) {
      regError.textContent = e.message;
      regError.classList.add("show");
    } finally {
      registerBtn.disabled = false;
      registerBtn.textContent = "ОТПРАВИТЬ ЗАЯВКУ";
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

  const ally = user.role === "ally";

  if (roleEl) {
    try {
      roleEl.textContent = getRoleName(user.role);
      roleEl.className = "role-tag";
      if (ally) {
        roleEl.classList.add("role-tag-rainbow");
      } else {
        roleEl.style.color = getRoleColor(user.role);
      }
    } catch (e) {
      roleEl.textContent = user.role || "—";
    }
  }

  if (avatarEl) {
    if (user.avatar) {
      avatarEl.innerHTML = '<img src="' + user.avatar + '" alt="avatar">';
      avatarEl.style.padding = "0";
      avatarEl.style.overflow = "hidden";
    } else {
      avatarEl.textContent = user.login.charAt(0).toUpperCase();
    }
    if (ally) avatarEl.classList.add("avatar-rainbow");
  }

  applyRoleVisibility(ally);

  const navAdmin = document.getElementById("navAdmin");
  const navApplications = document.getElementById("navApplications");
  const isAdminRole = ["emperor", "lord"].includes(user.role);
  if (navAdmin) navAdmin.classList.toggle("hidden", !isAdminRole);
  if (navApplications) navApplications.classList.toggle("hidden", !isAdminRole);

  initRouter();
  initDashboard();
  applyColorsToDOM();

  setupAvatarClick();
  setupSoundButton();
  setupProfileClicks();
  if (user.avatar) updateDashAvatar(user);

  // ✅ Автобэкап только для админов
  if (isAdminRole) {
    startAutoBackupTimer(6 * 60 * 60 * 1000); // каждые 6 часов
  }

  const inited = {
    chat: false, admin: false, contracts: false,
    allies: false, rules: false,
    music: false, album: false,
    captas: false, nicks: false, ranks: false,
    premiums: false,
    applications: false, online: false
  };

  try { initChat(); inited.chat = true; } catch (err) { console.warn("Chat init failed:", err); }

  window.addEventListener("tabChange", (e) => {
    const tab = e.detail.tab;

    if (tab === "admin" && isAdminRole && !inited.admin) { inited.admin = true; try { initAdmin(); } catch (err) {} }
    if (tab === "applications" && isAdminRole && !inited.applications) { inited.applications = true; try { initApplicationsPage(); } catch (err) {} }
    if (tab === "contracts" && !ally && !inited.contracts) { inited.contracts = true; try { initContracts(); } catch (err) {} }
    if (tab === "allies" && !ally && !inited.allies) { inited.allies = true; try { initAllies(); } catch (err) {} }
    if (tab === "rules" && !ally && !inited.rules) { inited.rules = true; try { initRules(); } catch (err) {} }
    if (tab === "music" && !ally && !inited.music) { inited.music = true; try { initMusic(); } catch (err) {} }
    if (tab === "album" && !ally && !inited.album) { inited.album = true; try { initAlbum(); } catch (err) {} }
    if (tab === "news" && !ally && !inited.captas) { inited.captas = true; try { initCaptas(); } catch (err) {} }
    if (tab === "premiums" && !ally && !inited.premiums) { inited.premiums = true; try { initPremiums(); } catch (err) {} }
    if (tab === "nicks" && !ally && !inited.nicks) { inited.nicks = true; try { initNicks(); } catch (err) {} }
    if (tab === "ranks" && !ally && !inited.ranks) { inited.ranks = true; try { initRanks(); } catch (err) {} }
    if (tab === "online" && !inited.online) { inited.online = true; try { initOnline(); } catch (err) {} }
    if (tab === "online") { try { renderOnline(); } catch (err) {} }
  });

  const hash = location.hash.replace("#", "");
  if (hash === "admin" && isAdminRole) { inited.admin = true; try { initAdmin(); } catch (e) {} }
  if (hash === "applications" && isAdminRole) { inited.applications = true; try { initApplicationsPage(); } catch (e) {} }
  if (hash === "contracts" && !ally) { inited.contracts = true; try { initContracts(); } catch (e) {} }
  if (hash === "allies" && !ally) { inited.allies = true; try { initAllies(); } catch (e) {} }
  if (hash === "rules" && !ally) { inited.rules = true; try { initRules(); } catch (e) {} }
  if (hash === "music" && !ally) { inited.music = true; try { initMusic(); } catch (e) {} }
  if (hash === "album" && !ally) { inited.album = true; try { initAlbum(); } catch (e) {} }
  if (hash === "news" && !ally) { inited.captas = true; try { initCaptas(); } catch (e) {} }
  if (hash === "premiums" && !ally) { inited.premiums = true; try { initPremiums(); } catch (e) {} }
  if (hash === "nicks" && !ally) { inited.nicks = true; try { initNicks(); } catch (e) {} }
  if (hash === "ranks" && !ally) { inited.ranks = true; try { initRanks(); } catch (e) {} }
  if (hash === "online") { inited.online = true; try { initOnline(); } catch (e) {} }

  const createBtn = document.getElementById("createContractBtn");
  if (createBtn) createBtn.addEventListener("click", openCreateContract);

  toast('Добро пожаловать, ' + user.login, "ok");
}

function applyRoleVisibility(isAlly) {
  const hideForAlly = ["dashboard", "nicks", "ranks", "contracts", "news", "premiums", "allies", "music", "rules", "album", "applications", "online"];

  document.querySelectorAll("#mainNav button").forEach(btn => {
    const tab = btn.dataset.tab;
    if (isAlly) {
      if (hideForAlly.includes(tab)) {
        btn.classList.add("hidden");
      } else {
        btn.classList.remove("hidden");
      }
    } else {
      btn.classList.remove("hidden");
    }
  });
}

// ✅ Унифицированная очистка при выгрузке страницы
window.addEventListener("beforeunload", () => {
  const cleanups = [
    ["Chat", () => destroyChat()],
    ["ReadSubs", () => destroyReadSubs()],
    ["Contracts", () => destroyContracts()],
    ["Presence", async () => {
      const { destroyPresence } = await import("./modules/chat/chat-presence.js");
      destroyPresence();
    }]
  ];

  cleanups.forEach(([name, fn]) => {
    try { fn(); } catch (e) { console.warn(`[Cleanup ${name}]`, e); }
  });
});
