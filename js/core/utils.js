// js/core/utils.js
// Хелперы: toast, лог, форматирование, модалка, safeFirestore

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

// ==================== SAFE FIRESTORE ====================
/**
 * Обёртка над Firestore-запросом с таймаутом.
 * Если Firestore не отвечает за N мс — возвращает fallback.
 *
 * @param {Promise} promise — промис Firestore (getDocs, addDoc и т.п.)
 * @param {any} fallback — что вернуть при ошибке/таймауте
 * @param {number} timeoutMs — таймаут в мс (по умолчанию 5000)
 * @param {string} label — метка для логов
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

  // Проверка онлайна
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

  // ✅ Скрыть кнопку подтверждения, если hideConfirm
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
