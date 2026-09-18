// js/modules/platform-switch.js

const STORAGE_KEY = "re_panel_platform";

const MENU_ITEMS = [
  { tab: "dashboard",  icon: "📊", label: "Дашборд" },
  { tab: "nicks",      icon: "👤", label: "Игровые ники" },
  { tab: "ranks",      icon: "🎖", label: "Ранги семьи" },
  { tab: "contracts",  icon: "📜", label: "Контракты" },
  { tab: "accolade",   icon: "🏅", label: "Акколада" },
  { tab: "containers", icon: "🎯", label: "Капты" },
  { tab: "allies",     icon: "🤝", label: "Союз семьи" },
  { tab: "music",      icon: "🎵", label: "Музыка" },
  { tab: "rules",      icon: "📖", label: "Правила" },
  { tab: "album",      icon: "📸", label: "Фотоальбом" },
  { tab: "chat",       icon: "💬", label: "Общение" },
  { tab: "chat-allies", icon: "🤝", label: "Общение союз" },
  { tab: "applications", icon: "📥", label: "Заявки" },
  { tab: "admin",      icon: "⚙", label: "ADMIN" }
];

export function initPlatformSwitch() {
  const saved = localStorage.getItem(STORAGE_KEY) || "pc";
  applyPlatform(saved);

  const switcher = document.getElementById("platformSwitch");
  if (switcher) {
    switcher.querySelectorAll(".platform-btn").forEach(btn => {
      if (btn.dataset.platform === saved) btn.classList.add("active");
      btn.addEventListener("click", () => {
        const platform = btn.dataset.platform;
        applyPlatform(platform);
        localStorage.setItem(STORAGE_KEY, platform);
        switcher.querySelectorAll(".platform-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
  }

  setupBottomNav();
  setupMoreMenu();
}

export function applyPlatform(platform) {
  if (platform === "mobile") {
    document.body.setAttribute("data-platform", "mobile");
  } else {
    document.body.removeAttribute("data-platform");
  }
}

function setupBottomNav() {
  const nav = document.getElementById("bottomNav");
  if (!nav) return;

  window.addEventListener("tabChange", (e) => {
    const tab = e.detail.tab;
    document.querySelectorAll(".bottom-nav-btn").forEach(btn => {
      const btnTab = btn.dataset.bottomTab;
      if (btnTab === tab) {
        btn.classList.add("active");
      } else if (btnTab !== "more") {
        btn.classList.remove("active");
      }
    });
  });
}

window.__bottomTab = function(tab) {
  if (tab === "more") {
    window.__bottomMore();
    return;
  }

  if (window.switchTab) {
    window.switchTab(tab);
  } else {
    const btn = document.querySelector('#mainNav button[data-tab="' + tab + '"]');
    if (btn) btn.click();
  }

  document.querySelectorAll(".bottom-nav-btn").forEach(b => {
    if (b.dataset.bottomTab === tab) b.classList.add("active");
    else b.classList.remove("active");
  });
};

function setupMoreMenu() {
  const overlay = document.getElementById("moreMenuOverlay");
  if (!overlay) return;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeMoreMenu();
  });

  renderMoreMenuItems();
}

function renderMoreMenuItems() {
  const container = document.getElementById("moreMenuItems");
  if (!container) return;

  const user = window.__currentUser;
  const isAdminRole = user && ["emperor", "lord"].includes(user.role);
  const isAlly = user && user.role === "ally";

  const hideForAlly = ["dashboard", "nicks", "ranks", "contracts", "accolade", "containers", "allies", "music", "rules", "album", "applications", "chat"];

  container.innerHTML = MENU_ITEMS.map(item => {
    if (isAlly && hideForAlly.includes(item.tab)) return "";
    if (item.tab === "admin" && !isAdminRole) return "";
    if (item.tab === "applications" && !isAdminRole) return "";

    return '<button class="more-menu-item" data-more-tab="' + item.tab + '" onclick="window.__bottomTab(\'' + item.tab + '\'); window.__closeMore();">' +
      '<span class="icon">' + item.icon + '</span>' +
      '<span class="label">' + item.label + '</span>' +
    '</button>';
  }).join("");
}

window.__bottomMore = function() {
  const overlay = document.getElementById("moreMenuOverlay");
  if (!overlay) return;
  renderMoreMenuItems();
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
};

window.__closeMore = function() {
  const overlay = document.getElementById("moreMenuOverlay");
  if (!overlay) return;
  overlay.classList.remove("active");
  document.body.style.overflow = "";
};

function closeMoreMenu() {
  window.__closeMore();
}
