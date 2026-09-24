// js/core/view-mode.js
// Авто-режим по ширине экрана. Без кнопки переключения.

export function initViewMode() {
  applyMode(detectMode());

  window.addEventListener("resize", () => {
    applyMode(detectMode());
  });
}

function detectMode() {
  const isMobile = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent);
  const isNarrow = window.innerWidth < 900;
  return (isMobile || isNarrow) ? "mobile" : "desktop";
}

function applyMode(mode) {
  document.body.classList.remove("mobile-view", "desktop-view");
  document.body.classList.add(mode === "mobile" ? "mobile-view" : "desktop-view");
}
