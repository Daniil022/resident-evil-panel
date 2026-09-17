// js/core/utils.js
// Хелперы: toast, лог, форматирование, модалка

export function toast(message, type = "info", duration = 3000) {
  const el = document.createElement("div");
  el.className = "toast" + (type === "ok" ? " ok" : type === "warn" ? " warn" : "");
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.3s, transform 0.3s";
    el.style.opacity = "0";
    el.style.transform = "translateX(120%)";
    setTimeout(() => el.remove(), 300);
  }, duration);
}

export function addLog(containerId, message, type = "info") {
  const log = document.getElementById(containerId);
  if (!log) return;
  const now = new Date();
  const ts = "[" +
    String(now.getHours()).padStart(2, "0") + ":" +
    String(now.getMinutes()).padStart(2, "0") + ":" +
    String(now.getSeconds()).padStart(2, "0") +
  "]";
  const line = document.createElement("div");
  line.className = "log-line";
  const cls = type === "ok" ? "ok" : type === "warn" ? "warn" : type === "crit" ? "crit" : "";
  line.innerHTML = `<span class="ts">${ts}</span><span class="${cls}">${message}</span>`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function formatTime(ts) {
  if (!ts) return "--:--";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return String(d.getHours()).padStart(2, "0") + ":" +
         String(d.getMinutes()).padStart(2, "0");
}

export function formatDate(d) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return "Сегодня";
  if (sameDay(d, yesterday)) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

// ==== МОДАЛКА ====
let modalAction = null;

export function openModal(config) {
  const overlay = document.getElementById("modalOverlay");
  const title = document.getElementById("modalTitle");
  const text = document.getElementById("modalText");
  const body = document.getElementById("modalBody");
  const confirmBtn = document.getElementById("modalConfirm");

  if (!overlay) return;

  title.textContent = config.title || "ПОДТВЕРЖДЕНИЕ";

  // Если есть HTML-контент — вставляем его, иначе текст
  if (config.html) {
    body.innerHTML = config.html;
  } else {
    body.innerHTML = `<p id="modalText">${config.text || "Вы уверены?"}</p>`;
  }

  modalAction = config.onConfirm || null;
  confirmBtn.textContent = config.confirmText || "ПОДТВЕРДИТЬ";
  confirmBtn.className = "btn" + (config.danger ? " danger" : "");

  overlay.classList.add("active");
}

export function closeModal() {
  const overlay = document.getElementById("modalOverlay");
  if (overlay) overlay.classList.remove("active");
  modalAction = null;
}

export function confirmModal() {
  if (typeof modalAction === "function") {
    try { modalAction(); } catch (e) { console.error(e); }
  }
  closeModal();
}

// Глобальные функции для inline onclick в HTML
window.closeModal = closeModal;
window.confirmModal = confirmModal;
window.openModal = openModal;

// Закрытие по Esc и клику по фону
document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("modalOverlay");
  if (!overlay) return;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
});
