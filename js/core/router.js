// js/core/router.js
// Переключение вкладок и управление видимостью

export function initRouter() {
  const navButtons = document.querySelectorAll("#mainNav button");
  const panels = document.querySelectorAll(".panel");

  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (!tab) return;
      switchTab(tab);
    });
  });

  // Реакция на hash в URL
  window.addEventListener("hashchange", () => {
    const tab = location.hash.replace("#", "");
    if (tab) switchTab(tab, false);
  });

  const initial = location.hash.replace("#", "") || "nicks";
  switchTab(initial, false);
}

export function switchTab(tab, updateHash = true) {
  const navButtons = document.querySelectorAll("#mainNav button");
  const panels = document.querySelectorAll(".panel");

  navButtons.forEach(b => b.classList.remove("active"));
  panels.forEach(p => p.classList.remove("active"));

  const btn = document.querySelector('#mainNav button[data-tab="' + tab + '"]');
  const panel = document.getElementById(tab);

  if (btn) btn.classList.add("active");
  if (panel) panel.classList.add("active");

  if (updateHash) {
    history.replaceState(null, "", "#" + tab);
  }

  // Событие для модулей
  window.dispatchEvent(new CustomEvent("tabChange", { detail: { tab } }));
}
