// js/core/cache.js
const store = new Map();

export function cacheGet(key, ttlMs = 30000) {
  const item = store.get(key);
  if (!item) return null;
  if (Date.now() - item.time > ttlMs) {
    store.delete(key);
    return null;
  }
  return item.value;
}

export function cacheSet(key, value) {
  store.set(key, { value, time: Date.now() });
}

export function cacheInvalidate(key) {
  if (key) store.delete(key);
  else store.clear();
}

export function cacheInvalidatePrefix(prefix) {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
