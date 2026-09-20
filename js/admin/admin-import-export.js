// js/admin/admin-import-export.js
// Импорт/экспорт участников + сброс демо.

import { listUsers } from "../core/auth.js";
import { db } from "../firebase-init.js";
import {
  collection, doc, setDoc, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { openModal, closeModal, toast } from "../core/utils.js";
import { exportUsers } from "./admin-users-export.js";
import { addAdminLog } from "./admin-log.js";

const DEMO_PREFIXES = ["re_demo_", "re_panel_demo_", "re_last_auto_backup", "re_panel_session"];

// ==================== ЭКСПОРТ ВСЕХ ====================
export async function exportAll() {
  const users = await listUsers(true);
  exportUsers(users, "all");
}

// ==================== ИМПОРТ ====================
export function openImportModal() {
  openModal({
    title: "ИМПОРТ УЧАСТНИКОВ",
    html:
      '<div class="form-grid">' +
        '<div class="form-field" style="grid-column:1/-1;">' +
          '<label>Файл (CSV или JSON)</label>' +
          '<input type="file" id="importFile" accept=".csv,.json,text/csv,application/json">' +
          '<div class="form-hint">CSV: login,role,division,warn,banned,contracts<br>JSON: массив объектов с теми же полями</div>' +
        '</div>' +
        '<div class="form-field" style="grid-column:1/-1;">' +
          '<label><input type="checkbox" id="importSkipExisting" checked> Пропускать существующих (не перезаписывать)</label>' +
        '</div>' +
        '<div class="form-field" style="grid-column:1/-1;">' +
          '<label>PIN по умолчанию (если не указан в файле)</label>' +
          '<input type="text" id="importDefaultPin" value="1234" maxlength="8">' +
        '</div>' +
      '</div>' +
      '<div id="importStatus" style="color:var(--muted);font-size:12px;margin-top:10px;"></div>',
    confirmText: "ИМПОРТИРОВАТЬ",
    onConfirm: () => doImport()
  });
}

async function doImport() {
  const fileInput = document.getElementById("importFile");
  const skipExisting = document.getElementById("importSkipExisting").checked;
  const defaultPin = document.getElementById("importDefaultPin").value.trim() || "1234";
  const status = document.getElementById("importStatus");

  if (!fileInput.files || !fileInput.files[0]) {
    status.style.color = "var(--red)";
    status.textContent = "Выбери файл";
    return;
  }

  const file = fileInput.files[0];
  const text = await file.text();

  let rows = [];

  try {
    if (file.name.endsWith(".json")) {
      rows = JSON.parse(text);
      if (!Array.isArray(rows)) throw new Error("JSON должен быть массивом");
    } else {
      rows = parseCsv(text);
    }
  } catch (e) {
    status.style.color = "var(--red)";
    status.textContent = "Ошибка парсинга: " + e.message;
    return;
  }

  if (rows.length === 0) {
    status.style.color = "var(--red)";
    status.textContent = "Файл пустой";
    return;
  }

  status.style.color = "var(--cyan)";
  status.textContent = "Обработка 0 из " + rows.length + "...";

  let created = 0, skipped = 0, failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const login = String(row.login || row.nick || "").trim();

    if (!login || !/^[A-Za-z0-9_]{3,32}$/.test(login)) {
      failed++;
      continue;
    }

    if (skipExisting) {
      try {
        const q = query(collection(db, "users"), where("login", "==", login));
        const snap = await getDocs(q);
        if (!snap.empty) {
          skipped++;
          continue;
        }
      } catch (e) {}
    }

    const userData = {
      login,
      pin: String(row.pin || defaultPin),
      role: row.role || "soul",
      division: row.division || null,
      warn: parseInt(row.warn) || 0,
      banned: row.banned === true || row.banned === "true",
      contracts: parseInt(row.contracts) || 0,
      muted: false,
      punishments: [],
      createdAt: Date.now()
    };

    try {
      const ref = doc(collection(db, "users"));
      await setDoc(ref, userData);
      created++;
    } catch (e) {
      failed++;
    }

    if (i % 5 === 0) {
      status.textContent = "Обработка " + (i + 1) + " из " + rows.length + "...";
    }
  }

  status.style.color = "var(--green)";
  status.textContent = "Готово! Создано: " + created + ", пропущено: " + skipped + ", ошибок: " + failed;

  addAdminLog("Импорт участников: создано " + created + ", пропущено " + skipped, "ok");

  setTimeout(() => {
    closeModal();
    window.location.reload();
  }, 2000);
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];

  const header = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row = {};
    header.forEach((h, idx) => {
      row[h] = (cells[idx] || "").replace(/^"|"$/g, "");
    });
    rows.push(row);
  }

  return rows;
}

function splitCsvLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ==================== СБРОС ДЕМО ====================
export function resetDemoData() {
  if (!confirm("Сбросить все демо-данные?\n\nЭто удалит ВСЕ ключи re_demo_* из localStorage.\nFirebase не затрагивается.")) return;
  if (!confirm("Точно? Демо-данные восстановятся только если снова уйти в офлайн-режим.")) return;

  let removed = 0;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (DEMO_PREFIXES.some(p => k.startsWith(p))) keys.push(k);
  }

  keys.forEach(k => { localStorage.removeItem(k); removed++; });

  toast("Удалено ключей: " + removed, "ok");
  addAdminLog("Сброс демо-данных: " + removed + " ключей", "warn");

  setTimeout(() => window.location.reload(), 1500);
}

// ==================== ПОДКЛЮЧЕНИЕ ====================
export function initImportExport() {
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el && !el.__bound) {
      el.__bound = true;
      el.addEventListener("click", fn);
    }
  };

  on("adminExportAllBtn", () => exportAll());
  on("adminImportBtn", () => openImportModal());
  on("adminResetDemoBtn", () => resetDemoData());
}
