// js/admin/admin-log.js
// Локальный лог + запись в Firestore через activity-log.

import { logAction } from "../core/activity-log.js";

// Локальный лог в панели (для визуальной обратной связи)
export function addAdminLog(message, type = "info", opts = {}) {
  const log = document.getElementById("adminLog");
  if (log) {
    const now = new Date();
    const ts = "[" +
      String(now.getHours()).padStart(2, "0") + ":" +
      String(now.getMinutes()).padStart(2, "0") + ":" +
      String(now.getSeconds()).padStart(2, "0") +
    "]";
    const line = document.createElement("div");
    line.className = "log-line";
    const cls = type === "ok" ? "ok"
              : type === "warn" ? "warn"
              : type === "crit" ? "crit"
              : "";
    line.innerHTML = '<span class="ts">' + ts + '</span><span class="' + cls + '">' + message + '</span>';
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  // Параллельно — в Firestore
  const logType = opts.type
    || (type === "warn" ? "warn"
      : type === "crit" ? "delete"
      : "other");
  logAction(logType, message, {
    target: opts.target || null,
    targetLogin: opts.targetLogin || null,
    meta: opts.meta || null
  }).catch(() => {});
}
