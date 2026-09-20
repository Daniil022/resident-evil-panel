// js/core/punishments.js
// Система наказаний: warn, mute, ban, временные, история.

import { db } from "../firebase-init.js";
import { doc, updateDoc, getDoc, arrayUnion }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { cacheInvalidate } from "./cache.js";
import { getCurrentUser } from "./state.js";

const DEMO_USERS_KEY = "re_panel_demo_users";
const CACHE_KEY_USERS = "users_list";
const MAX_WARN = 3;
const MAX_PUNISHMENTS = 50; // храним последние 50

// ==================== ВНУТРЕННИЕ ====================
function getDemoUsers() {
  try { return JSON.parse(localStorage.getItem(DEMO_USERS_KEY) || "[]"); }
  catch { return []; }
}
function saveDemoUsers(users) {
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
}

async function getUserRef(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) return { source: "firebase", ref: snap.ref, data: snap.data() };
  } catch (e) {}
  const found = getDemoUsers().find(u => u.uid === uid);
  if (found) return { source: "demo", data: found };
  return null;
}

function makePunishment(type, reason, durationMs = 0) {
  const me = getCurrentUser();
  return {
    type,
    by: me ? me.login : "—",
    reason: reason || "",
    at: Date.now(),
    duration: durationMs || 0
  };
}

async function appendPunishment(found, punishment) {
  const list = (found.data.punishments || []).slice();
  list.push(punishment);
  // Ограничиваем размер
  const trimmed = list.slice(-MAX_PUNISHMENTS);

  if (found.source === "firebase") {
    await updateDoc(found.ref, { punishments: trimmed });
  } else {
    const users = getDemoUsers();
    const idx = users.findIndex(u => u.uid === found.data.uid);
    if (idx >= 0) {
      users[idx].punishments = trimmed;
      saveDemoUsers(users);
    }
  }
}

async function patchUser(found, patch) {
  if (found.source === "firebase") {
    await updateDoc(found.ref, patch);
  } else {
    const users = getDemoUsers();
    const idx = users.findIndex(u => u.uid === found.data.uid);
    if (idx >= 0) {
      Object.assign(users[idx], patch);
      saveDemoUsers(users);
    }
  }
  cacheInvalidate(CACHE_KEY_USERS);
}

// ==================== WARN ====================
export async function addWarn(uid, reason = "") {
  const found = await getUserRef(uid);
  if (!found) throw new Error("Пользователь не найден");

  const current = found.data.warn || 0;
  if (current >= MAX_WARN) throw new Error("Максимум " + MAX_WARN + " Warn");

  const newWarn = current + 1;
  const patch = { warn: newWarn, lastWarnReason: reason, lastWarnAt: Date.now() };

  // Авто-бан при 3 warn
  if (newWarn >= MAX_WARN) {
    patch.banned = true;
    patch.bannedAt = Date.now();
    patch.banReason = "Авто-бан: " + MAX_WARN + " предупреждения";
  }

  await patchUser(found, patch);
  await appendPunishment(found, makePunishment("warn", reason));

  return { warn: newWarn, banned: newWarn >= MAX_WARN };
}

export async function removeWarn(uid, reason = "") {
  const found = await getUserRef(uid);
  if (!found) throw new Error("Пользователь не найден");

  const current = found.data.warn || 0;
  if (current === 0) throw new Error("Нет Warn");

  const newWarn = Math.max(0, current - 1);
  const patch = { warn: newWarn };
  if (newWarn < MAX_WARN) {
    patch.banned = false;
    patch.banReason = "";
  }

  await patchUser(found, patch);
  await appendPunishment(found, makePunishment("unwarn", reason));

  return { warn: newWarn, banned: newWarn >= MAX_WARN };
}

// ==================== MUTE ====================
export async function muteUser(uid, durationMs = 0, reason = "") {
  const found = await getUserRef(uid);
  if (!found) throw new Error("Пользователь не найден");

  const until = durationMs > 0 ? Date.now() + durationMs : null;
  const patch = {
    muted: true,
    mutedUntil: until,
    mutedReason: reason
  };

  await patchUser(found, patch);
  await appendPunishment(found, makePunishment("mute", reason, durationMs));

  return { muted: true, mutedUntil: until };
}

export async function unmuteUser(uid, reason = "") {
  const found = await getUserRef(uid);
  if (!found) throw new Error("Пользователь не найден");

  await patchUser(found, {
    muted: false,
    mutedUntil: null,
    mutedReason: ""
  });
  await appendPunishment(found, makePunishment("unmute", reason));

  return { muted: false };
}

export function isMuted(user) {
  if (!user) return false;
  if (!user.muted) return false;
  if (user.mutedUntil && Date.now() > user.mutedUntil) return false;
  return true;
}

export function getMuteRemaining(user) {
  if (!user || !user.mutedUntil) return 0;
  const left = user.mutedUntil - Date.now();
  return left > 0 ? left : 0;
}

// ==================== BAN ====================
export async function banUser(uid, durationMs = 0, reason = "") {
  const found = await getUserRef(uid);
  if (!found) throw new Error("Пользователь не найден");

  const until = durationMs > 0 ? Date.now() + durationMs : null;
  const patch = {
    banned: true,
    bannedAt: Date.now(),
    bannedUntil: until,
    banReason: reason
  };

  await patchUser(found, patch);
  await appendPunishment(found, makePunishment("ban", reason, durationMs));

  return { banned: true, bannedUntil: until };
}

export async function unbanUser(uid, reason = "") {
  const found = await getUserRef(uid);
  if (!found) throw new Error("Пользователь не найден");

  await patchUser(found, {
    banned: false,
    bannedUntil: null,
    banReason: "",
    warn: 0
  });
  await appendPunishment(found, makePunishment("unban", reason));

  return { banned: false, warn: 0 };
}

export function isBanned(user) {
  if (!user) return false;
  if (user.bannedUntil && Date.now() > user.bannedUntil) return false;
  if (user.banned) return true;
  return (user.warn || 0) >= MAX_WARN;
}

export function getBanRemaining(user) {
  if (!user || !user.bannedUntil) return 0;
  const left = user.bannedUntil - Date.now();
  return left > 0 ? left : 0;
}

// ==================== ИСТОРИЯ ====================
export function getPunishments(user) {
  if (!user) return [];
  return (user.punishments || []).slice().reverse(); // новые сверху
}

export function formatPunishmentType(type) {
  const map = {
    warn:   { label: "Warn",       icon: "⚠",  cls: "warn" },
    unwarn: { label: "Снятие warn", icon: "↻", cls: "ok" },
    mute:   { label: "Мут",        icon: "🔇", cls: "warn" },
    unmute: { label: "Снятие мута", icon: "🔊", cls: "ok" },
    ban:    { label: "Бан",        icon: "🔒", cls: "crit" },
    unban:  { label: "Разбан",     icon: "🔓", cls: "ok" },
    kick:   { label: "Кик",        icon: "👢", cls: "crit" }
  };
  return map[type] || { label: type, icon: "•", cls: "" };
}

// ==================== АВТО-РАЗБАН ====================
// Вызывается при логине и периодически
export async function autoLiftExpired(uid) {
  const found = await getUserRef(uid);
  if (!found) return null;

  const now = Date.now();
  const patch = {};
  let changed = false;

  // Авто-размут
  if (found.data.muted && found.data.mutedUntil && now > found.data.mutedUntil) {
    patch.muted = false;
    patch.mutedUntil = null;
    patch.mutedReason = "";
    changed = true;
  }

  // Авто-разбан
  if (found.data.banned && found.data.bannedUntil && now > found.data.bannedUntil) {
    patch.banned = false;
    patch.bannedUntil = null;
    patch.banReason = "";
    patch.warn = 0;
    changed = true;
  }

  if (changed) {
    await patchUser(found, patch);
    await appendPunishment(found, makePunishment("unban", "Авто-разбан (истёк срок)"));
  }

  return changed;
}

export const PUNISH_LIMIT = MAX_WARN;
