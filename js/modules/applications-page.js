// js/modules/applications-page.js
import { initAdminApplications } from "../admin/admin-applications.js";
import { initAdminNickApplications } from "../admin/admin-nick-applications.js";
import { initAdminRegistration } from "../admin/admin-registration.js";

let currentTab = "registration";
let initialized = false;

export async function initApplicationsPage() {
  if (!initialized) {
    initialized = true;
    setupTabs();
  }
  await switchTab(currentTab);
}

function setupTabs() {
  const tabsEl = document.getElementById("applicationsTabs");
  if (!tabsEl) return;

  tabsEl.innerHTML =
    '<button class="music-tab active" data-app-tab="registration" onclick="window.__appTab(\'registration\')">📥 Регистрация</button>' +
    '<button class="music-tab" data-app-tab="attestation" onclick="window.__appTab(\'attestation\')">🏅 Аттестация</button>' +
    '<button class="music-tab" data-app-tab="nicks" onclick="window.__appTab(\'nicks\')">🆔 Ники</button>';
}

window.__appTab = async function(tab) {
  currentTab = tab;
  document.querySelectorAll("#applicationsTabs .music-tab").forEach(b => {
    b.classList.toggle("active", b.dataset.appTab === tab);
  });
  await switchTab(tab);
};

async function switchTab(tab) {
  // Скрываем все контейнеры
  document.querySelectorAll("#applicationsPageContent > div[data-app-panel]").forEach(el => {
    el.style.display = "none";
  });

  // Показываем нужный
  const panel = document.querySelector('#applicationsPageContent > div[data-app-panel="' + tab + '"]');
  if (panel) panel.style.display = "grid";

  // Инициализируем модуль
  try {
    if (tab === "registration") await initAdminRegistration();
    else if (tab === "attestation") await initAdminApplications();
    else if (tab === "nicks") await initAdminNickApplications();
  } catch (e) {
    console.warn("Applications page init failed:", e);
  }
}
