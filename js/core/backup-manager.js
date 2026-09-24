// js/core/backup-manager.js
// Автоматические бэкапы Firestore в коллекцию backups.

import { db } from "../firebase-init.js";
import {
  collection, getDocs, doc, setDoc, deleteDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getCurrentUser } from "./state.js";
import { toast } from "./utils.js";

const BACKUP_COLLECTION = "backups";
const KEEP_DAYS = 7;

// ✅ УБРАН "warehouse" — модуль не нужен
export const BACKUP_COLLECTIONS = [
  "users",
  "roles",
  "divisions",
  "contracts",
  "albums",
  "album_photos",
  "music",
  "music_albums",
  "allies",
  "rules",
  "captas",
  "accolades",
  "premiums",
  "registration_requests",
  "applications",
  "applications_nicks",
  "admin_logs"
];

const LAST_BACKUP_KEY = "re_last_auto_backup";

// ==================== СОЗДАНИЕ ====================
export async function createBackup(reason = "manual") {
  const me = getCurrentUser();
  if (!me) throw new Error("Не залогинен");

  const date = new Date().toISOString().slice(0, 10);
  const timestamp = Date.now();
  const id = date + "_" + timestamp;

  const data = {};

  for (const col of BACKUP_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, col));
      data[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      data[col] = [];
    }
  }

  const totalCount = Object.values(data).reduce((s, arr) => s + arr.length, 0);

  const backup = {
    date,
    createdAt: timestamp,
    createdBy: me.login,
    reason,
    totalCount,
    data
  };

  await setDoc(doc(db, BACKUP_COLLECTION, id), backup);
  localStorage.setItem(LAST_BACKUP_KEY, String(timestamp));

  return { id, ...backup };
}

// ==================== АВТО-БЭКАП ====================
export async function checkAutoBackup() {
  const me = getCurrentUser();
  if (!me) return;
  if (!["emperor", "lord"].includes(me.role)) return;

  const last = parseInt(localStorage.getItem(LAST_BACKUP_KEY) || "0");
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

  if (last > dayAgo) return;

  try {
    await createBackup("auto");
    console.log("[Backup] Авто-бэкап создан");
  } catch (e) {
    console.warn("[Backup] Авто-бэкап не удался:", e);
  }
}

// ✅ НОВОЕ: запускаем периодический авто-бэкап
let autoBackupTimer = null;

export function startAutoBackupTimer(intervalMs = 6 * 60 * 60 * 1000) {
  if (autoBackupTimer) return;

  // Проверяем сразу при старте
  checkAutoBackup().catch(() => {});

  // И далее каждые intervalMs (по умолчанию 6 часов)
  autoBackupTimer = setInterval(() => {
    checkAutoBackup().catch(() => {});
  }, intervalMs);

  console.log("[Backup] Таймер авто-бэкапа запущен (каждые " + Math.round(intervalMs / 3600000) + " ч)");
}

export function stopAutoBackupTimer() {
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }
}

// ==================== СПИСОК ====================
export async function listBackups() {
  const snap = await getDocs(collection(db, BACKUP_COLLECTION));
  const list = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      date: data.date,
      createdAt: data.createdAt,
      createdBy: data.createdBy,
      reason: data.reason,
      totalCount: data.totalCount || 0
    };
  });
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return list;
}

// ==================== ВОССТАНОВЛЕНИЕ ====================
export async function restoreBackup(backupId) {
  const snap = await getDoc(doc(db, BACKUP_COLLECTION, backupId));
  if (!snap.exists()) throw new Error("Бэкап не найден");
  const backup = snap.data();

  if (!backup.data) throw new Error("Повреждённый бэкап");

  let restored = 0;

  for (const col of Object.keys(backup.data)) {
    const records = backup.data[col];
    if (!Array.isArray(records)) continue;

    for (const record of records) {
      if (!record.id) continue;
      const { id, ...rest } = record;
      try {
        await setDoc(doc(db, col, id), rest, { merge: true });
        restored++;
      } catch (e) {
        console.warn("Restore failed", col, id, e);
      }
    }
  }

  return restored;
}

// ==================== СКАЧАТЬ ====================
export async function downloadBackup(backupId) {
  const snap = await getDoc(doc(db, BACKUP_COLLECTION, backupId));
  if (!snap.exists()) throw new Error("Бэкап не найден");
  const backup = snap.data();

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "backup-" + (backup.date || backupId) + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==================== УДАЛЕНИЕ ====================
export async function deleteBackup(backupId) {
  await deleteDoc(doc(db, BACKUP_COLLECTION, backupId));
}

// ==================== ЧИСТКА СТАРЫХ ====================
export async function cleanupOldBackups() {
  const list = await listBackups();
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;

  let deleted = 0;
  for (const b of list) {
    if ((b.createdAt || 0) < cutoff) {
      try {
        await deleteBackup(b.id);
        deleted++;
      } catch (e) {}
    }
  }

  return deleted;
}
