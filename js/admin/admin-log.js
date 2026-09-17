// js/admin/admin-log.js
export function addAdminLog(message, type = "info") {
  const log = document.getElementById("adminLog");
  if (!log) return;

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
  line.innerHTML = `<span class="ts">${ts}</span><span class="${cls}">${message}</span>`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}
