// js/admin/admin-backups-view.js
import {
  listBackups, createBackup, restoreBackup, downloadBackup, deleteBackup,
  cleanupOldBackups
} from "../core/backup-manager.js";
import { toast } from "../core/utils.js";
import { escapeHtml, formatDate } from "../modules/gestion.js";

export async function initBackupsView() {
  const container = document.getElementById("backupsList");
  if (!container) return;

  await renderBackupsList();

  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el && !el.__bound) {
      el.__bound = true;
      el.addEventListener("click", fn);
    }
  };

  on("backupCreateNowBtn", async () => {
    if (!confirm("Создать бэкап сейчас?")) return;
    toast("Создаю бэкап...", "info", 2000);
    try {
      const b = await createBackup("manual");
      toast("Бэкап создан: " + b.totalCount + " записей", "ok");
      await renderBackupsList();
    } catch (e) {
      toast("Ошибка: " + e.message, "warn");
    }
  });

  on("backupCleanupBtn", async () => {
    if (!confirm("Удалить бэкапы старше 7 дней?")) return;
    try {
      const n = await cleanupOldBackups();
      toast("Удалено старых: " + n, "ok");
      await renderBackupsList();
    } catch (e) {
      toast("Ошибка: " + e.message, "warn");
    }
  });
}

export async function renderBackupsList() {
  const container = document.getElementById("backupsList");
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;">Загрузка...</div>';

  let list = [];
  try {
    list = await listBackups();
  } catch (e) {
    container.innerHTML = '<div style="text-align:center;color:var(--red);padding:20px;">Ошибка загрузки: ' + escapeHtml(e.message) + '</div>';
    return;
  }

  if (list.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;">Бэкапов пока нет</div>';
    return;
  }

  container.innerHTML = list.map(b =>
    '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:8px;">' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="color:#fff;font-weight:600;font-size:13.5px;">' +
          '📦 ' + escapeHtml(b.date) +
          (b.reason === "auto" ? ' <span style="color:var(--muted);font-size:11px;">(авто)</span>' : '') +
        '</div>' +
        '<div style="color:var(--muted);font-size:11px;margin-top:4px;">' +
          'Автор: ' + escapeHtml(b.createdBy || '—') + ' · ' +
          'Записей: ' + b.totalCount + ' · ' +
          formatDate(b.createdAt) +
        '</div>' +
      '</div>' +
      '<button class="btn small secondary" onclick="window.__backupDownload(\'' + b.id + '\')">📥</button>' +
      '<button class="btn small" onclick="window.__backupRestore(\'' + b.id + '\')">↺ Восстановить</button>' +
      '<button class="btn small danger" onclick="window.__backupDelete(\'' + b.id + '\')">✕</button>' +
    '</div>'
  ).join('');
}

window.__backupDownload = async function(id) {
  try {
    await downloadBackup(id);
    toast("Бэкап скачан", "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

window.__backupRestore = async function(id) {
  if (!confirm("Восстановить данные из бэкапа?\n\nЗаписи перезапишутся (по совпадению ID).")) return;
  if (!confirm("Уверен? Это может занять время.")) return;

  toast("Восстановление...", "info", 3000);

  try {
    const n = await restoreBackup(id);
    toast("Восстановлено записей: " + n, "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

window.__backupDelete = async function(id) {
  if (!confirm("Удалить бэкап?")) return;
  try {
    await deleteBackup(id);
    toast("Бэкап удалён", "ok");
    await renderBackupsList();
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};
