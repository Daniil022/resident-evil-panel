// js/modules/applications-page.js
import { initAdminRegistration } from "../admin/admin-registration.js";

let initialized = false;

export async function initApplicationsPage() {
  if (!initialized) {
    initialized = true;
  }
  await initAdminRegistration();
}
