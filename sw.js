// sw.js — Service Worker для PWA
const CACHE_NAME = "re-panel-v4";

const OFFLINE_URLS = [
  "/",
  "/index.html",
  "/manifest.json"
];

// ==================== INSTALL ====================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS);
    })
  );
  self.skipWaiting();
});

// ==================== ACTIVATE ====================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ==================== FETCH ====================
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Не кэшируем Firestore, VK, Vercel API
  if (
    url.hostname.includes("firestore") ||
    url.hostname.includes("vk.com") ||
    url.hostname.includes("googleapis.com") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Навигация — всегда network-first, БЕЗ кэша HTML
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // JS/CSS — stale-while-revalidate
  if (url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Остальное — network-first
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push-уведомления (без иконок, т.к. их нет в проекте)
self.addEventListener("push", (event) => {
  let data = { title: "RESIDENT EVIL", body: "Новое уведомление" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      badge: undefined,
      icon: undefined,
      vibrate: [200, 100, 200]
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow("/");
    })
  );
});
