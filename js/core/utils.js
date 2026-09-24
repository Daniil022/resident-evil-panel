// js/core/utils.js
// Унифицированные хелперы: toast, лог, форматирование, модалка, safeFirestore,
// escapeHtml, escapeAttr, hexRgba, formatDate, formatTime.

// ==================== TOAST ====================
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

// ==================== ЛОГ (в контейнер) ====================
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

// ==================== ESCAPE ====================
export function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function escapeAttr(s) {
  return String(s == null ? "" : s)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ==================== ЦВЕТ ====================
export function hexRgba(hex, alpha = 1) {
  if (!hex || hex === "rainbow") return "rgba(255,255,255," + alpha + ")";
  const c = String(hex).replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ==================== ДАТА / ВРЕМЯ ====================
export function formatTime(ts) {
  if (!ts) return "--:--";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return String(d.getHours()).padStart(2, "0") + ":" +
         String(d.getMinutes()).padStart(2, "0");
}

/**
 * formatDate — две сигнатуры:
 *   formatDate(ts)         → "15 мар 2025"
 *   formatDate(ts, "short") → "15 мар"
 *   formatDate(ts, "feed")  → "Сегодня" / "Вчера" / "15 мар"
 */
export function formatDate(ts, mode = "default") {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);

  if (mode === "feed") {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (sameDay(d, today)) return "Сегодня";
    if (sameDay(d, yesterday)) return "Вчера";
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  }

  if (mode === "short") {
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  }

  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

/**
 * Относительное время — «только что», «5 мин назад», «2 ч назад», «15 мар».
 */
export function formatRelative(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = Date.now();
  const diff = now - d.getTime();

  if (diff < 60 * 1000) return "только что";
  if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + " мин назад";
  if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + " ч назад";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// ==================== SAFE FIRESTORE ====================
/**
 * Обёртка над Firestore-запросом с таймаутом.
 */
export async function safeFirestore(promise, fallback = null, timeoutMs = 5000, label = "") {
  try {
    const result = await Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Firestore timeout")), timeoutMs)
      )
    ]);
    return result;
  } catch (e) {
    if (e.message === "Firestore timeout") {
      console.warn("[safeFirestore] Таймаут " + (label ? "(" + label + ")" : "") + " — используем fallback");
    } else {
      console.warn("[safeFirestore] Ошибка " + (label ? "(" + label + ")" : "") + ":", e.message);
    }
    return fallback;
  }
}

// ==================== ГЛОБАЛЬНАЯ ОБРАБОТКА ОШИБОК ====================
let errorToastShown = false;

export function initGlobalErrorHandler() {
  window.addEventListener("error", (e) => {
    console.error("[Global Error]", e.error || e.message);
    showErrorToastOnce("Произошла ошибка. Обнови страницу.");
  });

  window.addEventListener("unhandledrejection", (e) => {
    const msg = e.reason?.message || String(e.reason);
    if (msg.includes("Firestore") || msg.includes("network") || msg.includes("offline")) {
      showErrorToastOnce("Нет соединения с сервером. Работаем в офлайн-режиме.");
    } else {
      console.error("[Unhandled Rejection]", e.reason);
    }
  });

  window.addEventListener("offline", () => {
    toast("Нет интернета. Панель работает в демо-режиме.", "warn", 5000);
  });

  window.addEventListener("online", () => {
    toast("Соединение восстановлено.", "ok", 3000);
  });
}

function showErrorToastOnce(message) {
  if (errorToastShown) return;
  errorToastShown = true;
  toast(message, "warn", 5000);
  setTimeout(() => { errorToastShown = false; }, 10000);
}

// ==================== МОДАЛКА ====================
let modalAction = null;

export function openModal(config) {
  const overlay = document.getElementById("modalOverlay");
  const title = document.getElementById("modalTitle");
  const text = document.getElementById("modalText");
  const body = document.getElementById("modalBody");
  const confirmBtn = document.getElementById("modalConfirm");

  if (!overlay) return;

  title.textContent = config.title || "ПОДТВЕРЖДЕНИЕ";

  if (config.html) {
    body.innerHTML = config.html;
  } else {
    body.innerHTML = `<p id="modalText">${config.text || "Вы уверены?"}</p>`;
  }

  modalAction = config.onConfirm || null;
  confirmBtn.textContent = config.confirmText || "ПОДТВЕРДИТЬ";
  confirmBtn.className = "btn" + (config.danger ? " danger" : "");

  if (config.hideConfirm) {
    confirmBtn.style.display = "none";
  } else {
    confirmBtn.style.display = "";
  }

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
