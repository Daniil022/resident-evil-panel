// js/core/activity-log.js
// Централизованный лог действий администрации.

import { db } from "../firebase-init.js";
import {
  collection, addDoc, getDocs, query, orderBy, limit, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getCurrentUser } from "./state.js";

const COLLECTION = "admin_logs";
const DEMO_KEY = "re_demo_admin_logs";

// ==================== ЗАПИСЬ ====================
/**
 * Записать действие в лог.
 * @param {string} type    — warn | ban | unban | mute | unmute | delete | create | role | division | backup | login | other
 * @param {string} message — человекочитаемое сообщение
 * @param {object} opts    — { target: uid, targetLogin: "Ник", meta: {...} }
 */
export async function logAction(type, message, opts = {}) {
  const me = getCurrentUser();
  const entry = {
    type,
    message,
    by: me ? me.login : "—",
    byUid: me ? me.uid : null,
    target: opts.target || null,
    targetLogin: opts.targetLogin || null,
    meta: opts.meta || null,
    at: Date.now()
  };

  try {
    await addDoc(collection(db, COLLECTION), entry);
  } catch (e) {
    // Демо-режим
    const demo = getDemoLogs();
    demo.push({ id: "demo-log-" + Date.now(), ...entry });
    // Ограничим 500 последними
    const trimmed = demo.slice(-500);
    localStorage.setItem(DEMO_KEY, JSON.stringify(trimmed));
  }

  return entry;
}

function getDemoLogs() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); }
  catch { return []; }
}

// ==================== ЧТЕНИЕ ====================
/**
 * Загрузить логи. Можно фильтровать по target (uid участника).
 */
export async function loadLogs({ target = null, author = null, type = null, max = 200 } = {}) {
  try {
    // Firestore не умеет несколько where без индексов — берём всё и фильтруем на клиенте
    const q = query(collection(db, COLLECTION), orderBy("at", "desc"), limit(500));
    const snap = await getDocs(q);
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return applyFilters(list, { target, author, type, max });
  } catch (e) {
    let list = getDemoLogs().slice().reverse();
    return applyFilters(list, { target, author, type, max });
  }
}

function applyFilters(list, { target, author, type, max }) {
  let result = list;
  if (target) result = result.filter(l => l.target === target);
  if (author) result = result.filter(l => l.by === author);
  if (type) result = result.filter(l => l.type === type);
  if (max) result = result.slice(0, max);
  return result;
}

// ==================== ИСТОРИЯ ПО УЧАСТНИКУ ====================
export async function loadUserHistory(uid, max = 50) {
  return loadLogs({ target: uid, max });
}

// ==================== ТИПЫ (для UI) ====================
export const LOG_TYPES = [
  { id: "",           label: "Все" },
  { id: "warn",       label: "⚠ Warn" },
  { id: "unwarn",     label: "↻ Снятие warn" },
  { id: "mute",       label: "🔇 Мут" },
  { id: "unmute",     label: "🔊 Снятие мута" },
  { id: "ban",        label: "🔒 Бан" },
  { id: "unban",      label: "🔓 Разбан" },
  { id: "delete",     label: "🗑 Удаление" },
  { id: "create",     label: "➕ Создание" },
  { id: "role",       label: "🎖 Роль" },
  { id: "division",   label: "🎯 Отряд" },
  { id: "backup",     label: "💾 Backup" }
];

export function formatLogType(type) {
  const found = LOG_TYPES.find(t => t.id === type);
  return found ? found.label : "• " + type;
}
