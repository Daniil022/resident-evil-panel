// js/modules/applications-page.js
import { initAdminRegistration } from "../admin/admin-registration.js";

let initialized = false;

export async function initApplicationsPage() {
  if (!initialized) {
    initialized = true;
  }

  // Показываем контейнер регистрации
  const panel = document.querySelector('#applicationsPageContent > div[data-app-panel="registration"]');
  if (panel) panel.style.display = "grid";

  await initAdminRegistration();
}
