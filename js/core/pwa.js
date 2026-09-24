// js/core/pwa.js
// PWA: регистрация Service Worker + показ кнопки «Установить приложение».

export function initPWA() {
  // Регистрация Service Worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          console.log("[PWA] SW зарегистрирован:", reg.scope);
        })
        .catch((err) => {
          console.warn("[PWA] SW ошибка:", err);
        });
    });
  } else {
    console.log("[PWA] Service Worker не поддерживается браузером");
  }

  // Показ кнопки «Установить»
  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton(deferredPrompt);
  });

  window.addEventListener("appinstalled", () => {
    console.log("[PWA] Приложение установлено");
    hideInstallButton();
    deferredPrompt = null;
  });
}

function showInstallButton(deferredPrompt) {
  const header = document.querySelector("header .header-status");
  if (!header || document.getElementById("pwaInstallBtn")) return;

  const btn = document.createElement("button");
  btn.id = "pwaInstallBtn";
  btn.className = "logout-btn";
  btn.style.marginRight = "8px";
  btn.style.background = "linear-gradient(135deg, #00c8d4, #3b82f6)";
  btn.style.color = "#001417";
  btn.style.border = "none";
  btn.style.fontWeight = "700";
  btn.title = "Установить приложение";
  btn.innerHTML = "📲 Установить";

  btn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("[PWA] Пользователь установил");
      hideInstallButton();
    }
    deferredPrompt = null;
  });

  header.insertBefore(btn, header.firstChild);
}

function hideInstallButton() {
  const btn = document.getElementById("pwaInstallBtn");
  if (btn) btn.remove();
}
