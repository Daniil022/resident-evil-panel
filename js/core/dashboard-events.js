// js/core/dashboard-events.js
// Лента событий: пишем в Firestore коллекцию dash_events, читаем последние 30.

import { db } from "../firebase-init.js";
import {
  collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getCurrentUser } from "./state.js";

const COLLECTION = "dash_events";
const DEMO_KEY = "re_demo_dash_events";
const MAX_EVENTS = 30;

// ==================== ЗАПИСЬ ====================
/**
 * Записать событие в ленту.
 * @param {string} icon — emoji, например "💬"
 * @param {string} text — текст события
 * @param {object} opts — { type: "chat"|"contract"|"premium"|"news"|"user" }
 */
export async function addDashEvent(icon, text, opts = {}) {
  const me = getCurrentUser();
  const entry = {
    icon,
    text,
    type: opts.type || "other",
    by: me ? me.login : "—",
    byUid: me ? me.uid : null,
    at: Date.now()
  };

  try {
    await addDoc(collection(db, COLLECTION), entry);
    // Чистим старые — оставляем только 30
    cleanupOld().catch(() => {});
  } catch (e) {
    // Демо
    const demo = getDemoEvents();
    demo.unshift({ id: "demo-ev-" + Date.now(), ...entry });
    const trimmed = demo.slice(0, MAX_EVENTS);
    localStorage.setItem(DEMO_KEY, JSON.stringify(trimmed));
  }

  return entry;
}

// ==================== ЧТЕНИЕ ====================
/**
 * Загрузить последние N событий.
 */
export async function loadDashEvents(max = MAX_EVENTS) {
  try {
    const q = query(
      collection(db, COLLECTION),
      orderBy("at", "desc"),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    return getDemoEvents().slice(0, max);
  }
}

// ==================== ЧИСТКА ====================
async function cleanupOld() {
  try {
    const q = query(
      collection(db, COLLECTION),
      orderBy("at", "desc"),
      limit(100)
    );
    const snap = await getDocs(q);
    const docs = snap.docs;
    // Всё, что после 30-го — удаляем
    for (let i = MAX_EVENTS; i < docs.length; i++) {
      try { await deleteDoc(doc(db, COLLECTION, docs[i].id)); } catch (e) {}
    }
  } catch (e) {}
}

// ==================== ДЕМО ====================
function getDemoEvents() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); }
  catch { return []; }
}
