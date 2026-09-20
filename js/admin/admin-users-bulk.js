// js/admin/admin-users-bulk.js
// Массовые операции над выделенными участниками.

import { warnUser, unwarnUser, deleteUser, changeDivision, listUsers }
  from "../core/auth.js";
import { listDivisions } from "../core/divisions.js";
import { openModal, closeModal, toast } from "../core/utils.js";
import { playSound } from "../core/sounds.js";
import { exportUsers } from "./admin-users-export.js";
import { addAdminLog } from "./admin-log.js";
import { renderUsersTable } from "./admin-users.js";

// ==================== WARN ====================
export async function bulkWarn(uids) {
  if (!uids.length) return;

  const all = await listUsers();
  const users = all.filter(u => uids.includes(u.uid));

  const warnable = users.filter(u => (u.warn || 0) < 3 && !u.banned);
  const skipped = users.filter(u => (u.warn || 0) >= 3 || u.banned);

  if (warnable.length === 0) {
    toast("Все выделенные уже забанены", "warn");
    return;
  }

  let msg = "Выдать warn " + warnable.length + " участникам?";
  if (skipped.length > 0) {
    msg += "\n\nПропущено (уже забанены): " + skipped.length;
  }
  if (!confirm(msg)) return;

  toast("Обработка 0 из " + warnable.length + "...", "info");

  const results = await batchPromises(warnable, async (u) => {
    try {
      const res = await warnUser(u.uid, "Массовый warn");
      return { uid: u.uid, login: u.login, ok: true, banned: res.banned };
    } catch (e) {
      return { uid: u.uid, login: u.login, ok: false, error: e.message };
    }
  }, 5, (done, total) => {
    if (done % 3 === 0 || done === total) {
      toast("Обработка " + done + " из " + total + "...", "info", 800);
    }
  });

  const ok = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  const bannedCount = results.filter(r => r.ok && r.banned).length;

  let summary = "Warn выдан: " + ok;
  if (bannedCount > 0) summary += ", забанено: " + bannedCount;
  if (failed > 0) summary += ", ошибок: " + failed;
  if (skipped.length > 0) summary += ", пропущено: " + skipped.length;

  addAdminLog("Массовый warn: " + summary, "warn");
  toast(summary, "warn");
  playSound("application");

  await renderUsersTable(true);
}

// ==================== UNWARN ====================
export async function bulkUnwarn(uids) {
  if (!uids.length) return;

  const all = await listUsers();
  const users = all.filter(u => uids.includes(u.uid));
  const unwarnable = users.filter(u => (u.warn || 0) > 0);

  if (unwarnable.length === 0) {
    toast("Нечего снимать — у всех warn = 0", "warn");
    return;
  }

  if (!confirm("Снять warn у " + unwarnable.length + " участников?")) return;

  const results = await batchPromises(unwarnable, async (u) => {
    try {
      await unwarnUser(u.uid);
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }, 5);

  const ok = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  addAdminLog("Массовое снятие warn: " + ok + " успешно", "ok");
  toast("Warn снят: " + ok + (failed ? ", ошибок: " + failed : ""), "ok");

  await renderUsersTable(true);
}

// ==================== DIVISION ====================
export async function bulkChangeDivision(uids) {
  if (!uids.length) return;

  const divisions = await listDivisions();

  const optionsHtml =
    '<option value="">— без подразделения —</option>' +
    divisions.map(d => '<option value="' + d.id + '">' + escapeHtml(d.name) + '</option>').join("");

  openModal({
    title: "СМЕНИТЬ ПОДРАЗДЕЛЕНИЕ (" + uids.length + ")",
    html:
      '<div class="form-field">' +
        '<label>Новое подразделение</label>' +
        '<select id="bulkDivSel" class="role-select">' + optionsHtml + '</select>' +
      '</div>',
    confirmText: "НАЗНАЧИТЬ",
    onConfirm: async () => {
      const divId = document.getElementById("bulkDivSel").value || null;

      const all = await listUsers();
      const users = all.filter(u => uids.includes(u.uid));

      toast("Обработка " + users.length + "...", "info", 1000);

      const results = await batchPromises(users, async (u) => {
        try {
          await changeDivision(u.uid, divId);
          return { ok: true };
        } catch (e) {
          return { ok: false };
        }
      }, 5);

      const ok = results.filter(r => r.ok).length;
      const failed = results.filter(r => !r.ok).length;

      addAdminLog("Массовая смена отряда: " + ok + " успешно", "ok");
      toast("Отряд обновлён: " + ok + (failed ? ", ошибок: " + failed : ""), "ok");

      closeModal();
      await renderUsersTable(true);
    }
  });
}

// ==================== DELETE ====================
export async function bulkDelete(uids) {
  if (!uids.length) return;
  if (!confirm("Удалить " + uids.length + " участников?\n\nЭто необратимо!")) return;
  if (!confirm("Точно удалить? Второй раз спрашиваю.")) return;

  toast("Удаление 0 из " + uids.length + "...", "info");

  const results = await batchPromises(uids, async (uid) => {
    try {
      await deleteUser(uid);
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }, 5, (done, total) => {
    if (done % 3 === 0 || done === total) {
      toast("Удаление " + done + " из " + total + "...", "info", 800);
    }
  });

  const ok = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  addAdminLog("Массовое удаление: " + ok + " удалено, " + failed + " ошибок", "crit");
  toast("Удалено: " + ok + (failed ? ", ошибок: " + failed : ""), "warn");

  await renderUsersTable(true);
}

// ==================== EXPORT ====================
export async function bulkExport(uids) {
  if (!uids.length) {
    toast("Ничего не выделено", "warn");
    return;
  }

  const all = await listUsers();
  const selected = all.filter(u => uids.includes(u.uid));

  exportUsers(selected, "selected");
}

// ==================== BULK MUTE ====================
export async function bulkMute(uids) {
  if (!uids.length) return;

  openModal({
    title: "ЗАМУТИТЬ (" + uids.length + ")",
    html:
      '<div class="form-grid">' +
        '<div class="form-field"><label>Длительность</label>' +
          '<select id="bulkMuteDuration" class="role-select">' +
            '<option value="0">Навсегда</option>' +
            '<option value="3600000">1 час</option>' +
            '<option value="86400000">1 день</option>' +
            '<option value="604800000">7 дней</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-field"><label>Причина</label><input type="text" id="bulkMuteReason" placeholder="Причина" autocomplete="off"></div>' +
      '</div>',
    confirmText: "ЗАМУТИТЬ",
    danger: true,
    onConfirm: async () => {
      const duration = parseInt(document.getElementById("bulkMuteDuration").value) || 0;
      const reason = document.getElementById("bulkMuteReason").value.trim();
      const { muteUser } = await import("../core/punishments.js");

      const results = await batchPromises(uids, async (uid) => {
        try { await muteUser(uid, duration, reason); return { ok: true }; }
        catch (e) { return { ok: false }; }
      }, 5);

      const ok = results.filter(r => r.ok).length;
      addAdminLog("Массовый мут: " + ok + " успешно", "warn");
      toast("Замучено: " + ok, "warn");
      closeModal();
      await renderUsersTable(true);
    }
  });
}

// ==================== BULK BAN ====================
export async function bulkBan(uids) {
  if (!uids.length) return;
  if (!confirm("Забанить " + uids.length + " участников?")) return;

  openModal({
    title: "ЗАБАНИТЬ (" + uids.length + ")",
    html:
      '<div class="form-grid">' +
        '<div class="form-field"><label>Длительность</label>' +
          '<select id="bulkBanDuration" class="role-select">' +
            '<option value="0">Навсегда</option>' +
            '<option value="3600000">1 час</option>' +
            '<option value="86400000">1 день</option>' +
            '<option value="604800000">7 дней</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-field"><label>Причина</label><input type="text" id="bulkBanReason" placeholder="Причина" autocomplete="off"></div>' +
      '</div>',
    confirmText: "ЗАБАНИТЬ",
    danger: true,
    onConfirm: async () => {
      const duration = parseInt(document.getElementById("bulkBanDuration").value) || 0;
      const reason = document.getElementById("bulkBanReason").value.trim();
      const { banUser } = await import("../core/punishments.js");

      const results = await batchPromises(uids, async (uid) => {
        try { await banUser(uid, duration, reason); return { ok: true }; }
        catch (e) { return { ok: false }; }
      }, 5);

      const ok = results.filter(r => r.ok).length;
      addAdminLog("Массовый бан: " + ok + " успешно", "crit");
      toast("Забанено: " + ok, "warn");
      closeModal();
      await renderUsersTable(true);
    }
  });
}

// ==================== BULK UNBAN ====================
export async function bulkUnban(uids) {
  if (!uids.length) return;
  if (!confirm("Разбанить " + uids.length + " участников?")) return;

  const { unbanUser } = await import("../core/punishments.js");
  const results = await batchPromises(uids, async (uid) => {
    try { await unbanUser(uid, "Массовый разбан"); return { ok: true }; }
    catch (e) { return { ok: false }; }
  }, 5);

  const ok = results.filter(r => r.ok).length;
  addAdminLog("Массовый разбан: " + ok, "ok");
  toast("Разбанено: " + ok, "ok");
  await renderUsersTable(true);
}

// ==================== ХЕЛПЕРЫ ====================
async function batchPromises(items, fn, batchSize = 5, onProgress = null) {
  const results = [];
  let done = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    done += batch.length;
    if (onProgress) onProgress(done, items.length);
  }

  return results;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
