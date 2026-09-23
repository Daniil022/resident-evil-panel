// js/core/view-mode.js
// Переключение ПК/мобильного вида.

const STORAGE_KEY = "re_panel_view_mode";

/**
 * Инициализация режима вида:
 * - Проверяет localStorage
 * - Если нет — авто-определение по ширине экрана
 * - Применяет класс на body
 */
export function initViewMode() {
  const saved = localStorage.getItem(STORAGE_KEY);
  let mode;

  if (saved === "mobile" || saved === "desktop") {
    mode = saved;
  } else {
    mode = detectMode();
  }

  applyMode(mode);
  setupToggleButton();
}

function detectMode() {
  const isMobile = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent);
  const isNarrow = window.innerWidth < 900;
  return (isMobile || isNarrow) ? "mobile" : "desktop";
}

function applyMode(mode) {
  document.body.classList.remove("mobile-view", "desktop-view");
  document.body.classList.add(mode === "mobile" ? "mobile-view" : "desktop-view");

  // Обновляем иконку кнопки, если она есть
  const btn = document.getElementById("viewModeBtn");
  if (btn) {
    btn.textContent = mode === "mobile" ? "🖥" : "📱";
    btn.title = mode === "mobile" ? "Переключить на ПК-вид" : "Переключить на мобильный вид";
  }
}

function toggleMode() {
  const current = document.body.classList.contains("mobile-view") ? "mobile" : "desktop";
  const next = current === "mobile" ? "desktop" : "mobile";
  localStorage.setItem(STORAGE_KEY, next);
  applyMode(next);
}

function setupToggleButton() {
  const header = document.querySelector("header .header-status");
  if (!header || document.getElementById("viewModeBtn")) return;

  const btn = document.createElement("button");
  btn.id = "viewModeBtn";
  btn.className = "logout-btn";
  btn.style.marginRight = "4px";
  btn.style.minWidth = "auto";
  btn.title = "Переключить вид";
  btn.textContent = document.body.classList.contains("mobile-view") ? "🖥" : "📱";

  btn.addEventListener("click", toggleMode);

  header.insertBefore(btn, header.firstChild);
}

// Если пользователь крутит телефон — не переключаем автоматически, если он уже выбрал режим вручную
window.addEventListener("resize", () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return; // пользователь уже выбрал вручную
  const mode = detectMode();
  applyMode(mode);
});
