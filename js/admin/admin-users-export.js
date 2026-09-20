// js/admin/admin-users-export.js
// Экспорт участников в CSV и JSON.

import { toast } from "../core/utils.js";
import { listUsers } from "../core/auth.js";

const CSV_FIELDS = ["login", "role", "division", "warn", "banned", "contracts", "createdAt", "lastSeen"];

export function exportUsers(users, suffix = "all") {
  if (!users || users.length === 0) {
    toast("Нет данных для экспорта", "warn");
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  const baseName = "resident-evil-users-" + suffix + "-" + date;

  // Спрашиваем формат
  const format = prompt(
    "Формат экспорта:\n1. CSV (Excel)\n2. JSON (для импорта)\n\nВведи 1 или 2:",
    "1"
  );

  if (format === null) return;

  if (format.trim() === "2") {
    downloadJson(users, baseName);
  } else {
    downloadCsv(users, baseName);
  }
}

function downloadCsv(users, baseName) {
  const header = CSV_FIELDS.join(",");
  const rows = users.map(u => CSV_FIELDS.map(f => csvCell(u[f])).join(","));
  const csv = "\uFEFF" + header + "\n" + rows.join("\n");

  downloadFile(csv, baseName + ".csv", "text/csv;charset=utf-8");
  toast("CSV экспортирован (" + users.length + ")", "ok");
}

function downloadJson(users, baseName) {
  const clean = users.map(u => {
    const out = {};
    CSV_FIELDS.forEach(f => { out[f] = u[f]; });
    return out;
  });
  const json = JSON.stringify(clean, null, 2);

  downloadFile(json, baseName + ".json", "application/json");
  toast("JSON экспортирован (" + users.length + ")", "ok");
}

function csvCell(v) {
  if (v == null) return "";
  if (typeof v === "object") v = JSON.stringify(v);
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Быстрый экспорт всех
export async function exportAllUsers() {
  const users = await listUsers(true);
  exportUsers(users, "all");
}
