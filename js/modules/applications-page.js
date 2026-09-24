// js/modules/applications-page.js
import { initAdminRegistration, destroyRegistrationSub } from "../admin/admin-registration.js";

let initialized = false;

export async function initApplicationsPage() {
  if (!initialized) {
    initialized = true;
  }

  const panel = document.querySelector('#applicationsPageContent > div[data-app-panel="registration"]');
  if (panel) panel.style.display = "grid";

  await initAdminRegistration();
}

window.addEventListener("beforeunload", () => {
  try { destroyRegistrationSub(); } catch (e) {}
});
