// js/core/divisions.js
import { db } from "../firebase-init.js";
import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { cacheGet, cacheSet, cacheInvalidate } from "./cache.js";

const CACHE_KEY = "divisions_list";
const DEMO_KEY = "re_demo_divisions";

export const DEFAULT_DIVISIONS = [
  { id: "guard",      name: "Охраник",      color: "#22c55e", desc: "Охрана",        order: 1 },
  { id: "shooter",    name: "Стрелок",      color: "#ef4444", desc: "Стрельба",      order: 2 },
  { id: "fuller",     name: "Фулер",        color: "#3b82f6", desc: "Фулл-стата",    order: 3 },
  { id: "mechanic",   name: "Механик",      color: "#a855f7", desc: "Механика",      order: 4 },
  { id: "green_lord", name: "Зелёный Лорд", color: "#22c55e", desc: "Лорд",          order: 5 },
  { id: "white_lord", name: "Белый Лорд",   color: "#e5e7eb", desc: "Лорд",          order: 6 },
  { id: "black_lord", name: "Чёрный Лорд",  color: "#4b5563", desc: "Лорд",          order: 7 },
  { id: "red_lord",   name: "Красный Лорд", color: "#dc2626", desc: "Лорд",          order: 8 },
  { id: "leader",     name: "Лидер",        color: "#fbbf24", desc: "Высший состав", order: 9 }
];

function getDemoDivisions() {
  const raw = localStorage.getItem(DEMO_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  localStorage.setItem(DEMO_KEY, JSON.stringify(DEFAULT_DIVISIONS));
  return [...DEFAULT_DIVISIONS];
}

function saveDemoDivisions(divisions) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(divisions));
}

export async function listDivisions(force = false) {
  if (!force) {
    const cached = cacheGet(CACHE_KEY, 300000);
    if (cached) return cached;
  }

  try {
    const snap = await getDocs(collection(db, "divisions"));
    if (!snap.empty) {
      const divisions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      divisions.sort((a, b) => (a.order || 0) - (b.order || 0));
      cacheSet(CACHE_KEY, divisions);
      return divisions;
    }
    await initializeDefaultDivisions();
    cacheSet(CACHE_KEY, [...DEFAULT_DIVISIONS]);
    return [...DEFAULT_DIVISIONS];
  } catch (e) {
    console.warn("Firebase divisions failed, demo mode");
  }

  const divisions = getDemoDivisions();
  cacheSet(CACHE_KEY, divisions);
  return divisions;
}

async function initializeDefaultDivisions() {
  try {
    for (const d of DEFAULT_DIVISIONS) {
      await setDoc(doc(db, "divisions", d.id), d);
    }
  } catch (e) {}
}

export async function getDivision(divisionId) {
  if (!divisionId) return null;
  const divisions = await listDivisions();
  return divisions.find(d => d.id === divisionId) || null;
}

export async function createDivision({ name, color, desc = "" }) {
  if (!name || !name.trim()) throw new Error("Введите название");
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("Неверный HEX-цвет");

  const divisions = await listDivisions(true);
  if (divisions.find(d => d.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("Подразделение с таким названием уже есть");
  }

  const newId = "div_" + Date.now();
  const maxOrder = Math.max(0, ...divisions.map(d => d.order || 0));
  const newDiv = { name: name.trim(), color, desc: desc.trim(), order: maxOrder + 1 };

  try {
    await setDoc(doc(db, "divisions", newId), newDiv);
    cacheInvalidate(CACHE_KEY);
    return { id: newId, ...newDiv };
  } catch (e) {}

  const demo = getDemoDivisions();
  const div = { id: newId, ...newDiv };
  demo.push(div);
  saveDemoDivisions(demo);
  cacheInvalidate(CACHE_KEY);
  return div;
}

export async function updateDivision(divId, updates) {
  const divisions = await listDivisions();
  const div = divisions.find(d => d.id === divId);
  if (!div) throw new Error("Подразделение не найдено");

  const patch = {};
  if (updates.name !== undefined) {
    if (!updates.name.trim()) throw new Error("Пустое название");
    patch.name = updates.name.trim();
  }
  if (updates.color !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(updates.color)) throw new Error("Неверный HEX");
    patch.color = updates.color;
  }
  if (updates.desc !== undefined) patch.desc = updates.desc.trim();
  if (updates.order !== undefined) patch.order = updates.order;

  try {
    await updateDoc(doc(db, "divisions", divId), patch);
    cacheInvalidate(CACHE_KEY);
    return;
  } catch (e) {}

  const demo = getDemoDivisions();
  const idx = demo.findIndex(d => d.id === divId);
  if (idx >= 0) { Object.assign(demo[idx], patch); saveDemoDivisions(demo); }
  cacheInvalidate(CACHE_KEY);
}

export async function deleteDivision(divId) {
  try {
    await deleteDoc(doc(db, "divisions", divId));
  } catch (e) {}

  const demo = getDemoDivisions().filter(d => d.id !== divId);
  saveDemoDivisions(demo);
  cacheInvalidate(CACHE_KEY);
}

export async function moveDivision(divId, direction) {
  const divisions = await listDivisions(true);
  const idx = divisions.findIndex(d => d.id === divId);
  if (idx < 0) return;

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= divisions.length) return;

  const a = divisions[idx];
  const b = divisions[swapIdx];

  await updateDivision(a.id, { order: b.order || swapIdx + 1 });
  await updateDivision(b.id, { order: a.order || idx + 1 });
  cacheInvalidate(CACHE_KEY);
}
