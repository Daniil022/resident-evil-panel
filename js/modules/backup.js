// js/modules/backup.js
import { db } from "../firebase-init.js";
import {
  collection, getDocs, doc, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { toast, openModal, closeModal } from "../core/utils.js";
import { getCurrentUser } from "../core/state.js";
import { BACKUP_COLLECTIONS } from "../core/backup-manager.js";

const ADMIN_ROLES = ["emperor", "lord"];

// ==================== СКАЧАТЬ BACKUP ====================
export async function downloadBackup() {
  const me = getCurrentUser();
  if (!me || !ADMIN_ROLES.includes(me.role)) {
    toast("Только лидер и зам могут делать backup", "warn");
    return;
  }

  toast("Собираю данные...", "info");

  const backup = {
    version: "1.0",
    createdAt: Date.now(),
    createdBy: me.login,
    data: {}
  };

  try {
    for (const col of BACKUP_COLLECTIONS) {
      try {
        const snap = await getDocs(collection(db, col));
        backup.data[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        backup.data[col] = [];
      }
    }

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = "resident-evil-backup-" + date + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const totalCount = Object.values(backup.data).reduce((s, arr) => s + arr.length, 0);
    toast("Backup готов! " + totalCount + " записей", "ok");
  } catch (e) {
    toast("Ошибка backup: " + e.message, "warn");
    console.error(e);
  }
}

// ==================== ЗАГРУЗИТЬ BACKUP ====================
export function openRestoreModal() {
  const me = getCurrentUser();
  if (!me || !ADMIN_ROLES.includes(me.role)) {
    toast("Только лидер и зам", "warn");
    return;
  }

  openModal({
    title: "ВОССТАНОВЛЕНИЕ ИЗ BACKUP",
    html: '<div class="form-grid">' +
      '<div class="form-field" style="grid-column:1/-1;">' +
        '<label>JSON-файл backup</label>' +
        '<input type="file" id="backupFile" accept=".json,application/json">' +
        '<div class="form-hint">Выбери файл, который скачал ранее</div>' +
      '</div>' +
      '<div class="form-field" style="grid-column:1/-1;">' +
        '<label><input type="checkbox" id="wipeExisting"> Удалить существующие данные перед восстановлением</label>' +
        '<div class="form-hint">⚠ Опасная опция — удалит все текущие записи из коллекций</div>' +
      '</div>' +
      '</div>' +
      '<div id="restoreError" style="color:var(--red);font-size:12px;display:none;"></div>' +
      '<div id="restoreProgress" style="color:var(--cyan);font-size:12px;display:none;"></div>',
    confirmText: "ВОССТАНОВИТЬ",
    danger: true,
    onConfirm: () => restoreFromFile()
  });
}

async function restoreFromFile() {
  const fileInput = document.getElementById("backupFile");
  const wipe = document.getElementById("wipeExisting").checked;
  const err = document.getElementById("restoreError");
  const prog = document.getElementById("restoreProgress");

  err.style.display = "none";
  prog.style.display = "none";

  if (!fileInput.files || !fileInput.files[0]) {
    err.textContent = "Выбери файл";
    err.style.display = "block";
    return;
  }

  const file = fileInput.files[0];

  if (!confirm("Восстановить данные из backup? Это перезапишет существующие записи с теми же ID.")) {
    return;
  }

  prog.textContent = "Читаю файл...";
  prog.style.display = "block";

  try {
    const text = await file.text();
    const backup = JSON.parse(text);

    if (!backup.data || typeof backup.data !== "object") {
      throw new Error("Неверный формат backup");
    }

    let totalRestored = 0;
    let totalWiped = 0;

    for (const col of Object.keys(backup.data)) {
      const records = backup.data[col];
      if (!Array.isArray(records)) continue;

      prog.textContent = "Обработка: " + col + " (" + records.length + ")...";

      if (wipe) {
        try {
          const existing = await getDocs(collection(db, col));
          for (const d of existing.docs) {
            await deleteDoc(doc(db, col, d.id));
            totalWiped++;
          }
        } catch (e) {
          console.warn("Wipe failed for " + col, e.message);
        }
      }

      for (const record of records) {
        if (!record.id) continue;
        const { id, ...data } = record;
        try {
          await setDoc(doc(db, col, id), data, { merge: true });
          totalRestored++;
        } catch (e) {
          console.warn("Restore failed for " + col + "/" + id, e.message);
        }
      }
    }

    prog.textContent = "Готово! Восстановлено " + totalRestored + " записей" + (wipe ? ", удалено " + totalWiped : "");
    toast("Восстановление завершено!", "ok");

    setTimeout(() => {
      if (confirm("Данные восстановлены. Обновить страницу?")) {
        window.location.reload();
      }
    }, 1000);

  } catch (e) {
    err.textContent = "Ошибка: " + e.message;
    err.style.display = "block";
    prog.style.display = "none";
  }
}
