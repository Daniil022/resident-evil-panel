// sw.js — Service Worker для PWA
// Кэширует статику, работает офлайн, обновляется автоматически.

// ✅ Меняй версию при каждом деплое, чтобы сбросить старый кэш
const CACHE_NAME = "re-panel-v2";

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
  // Только GET
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

  // Только свои
  if (url.origin !== self.location.origin) return;

  // Network-first (свежие данные в приоритете)
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => {
        // Офлайн — из кэша
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });
      })
  );
});

// ==================== PUSH (опционально) ====================
self.addEventListener("push", (event) => {
  let data = { title: "RESIDENT EVIL", body: "Новое уведомление" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
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
