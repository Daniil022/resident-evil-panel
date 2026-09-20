// js/admin/admin-users-bulk.js
// Массовые операции над выделенными участниками.

import { warnUser, unwarnUser, deleteUser, changeDivision, listUsers }
  from "../core/auth.js";
import { listDivisions } from "../core/divisions.js";
import { openModal, closeModal, toast } from "../core/utils.js";
import { playSound } from "../core/sounds.js";
import { exportUsers } from "./admin-users-export.js";
import { addAdminLog } from "./admin-log.js";

export async function bulkWarn(uids) {
  if (!uids.length) return;
  if (!confirm("Выдать warn " + uids.length + " участникам?")) return;

  let ok = 0, failed = 0;
  for (const uid of uids) {
    try {
      const res = await warnUser(uid, "Массовый warn");
      ok++;
      if (res.banned) playSound("application");
    } catch (e) { failed++; }
  }

  addAdminLog("Массовый warn: " + ok + " успешно, " + failed + " ошибок", "warn");
  toast("Warn выдан: " + ok + (failed ? ", ошибок: " + failed : ""), "warn");
  playSound("application");
}

export async function bulkUnwarn(uids) {
  if (!uids.length) return;

  let ok = 0, failed = 0;
  for (const uid of uids) {
    try {
      await unwarnUser(uid);
      ok++;
    } catch (e) { failed++; }
  }

  addAdminLog("Массовое снятие warn: " + ok + " успешно", "ok");
  toast("Warn снят: " + ok + (failed ? ", ошибок: " + failed : ""), "ok");
}

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
      let ok = 0, failed = 0;
      for (const uid of uids) {
        try {
          await changeDivision(uid, divId);
          ok++;
        } catch (e) { failed++; }
      }
      addAdminLog("Массовая смена отряда: " + ok + " успешно", "ok");
      toast("Отряд обновлён: " + ok + (failed ? ", ошибок: " + failed : ""), "ok");
      closeModal();
    }
  });
}

export async function bulkDelete(uids) {
  if (!uids.length) return;
  if (!confirm("Удалить " + uids.length + " участников?\n\nЭто необратимо!")) return;
  if (!confirm("Точно удалить? Второй раз спрашиваю.")) return;

  let ok = 0, failed = 0;
  for (const uid of uids) {
    try {
      await deleteUser(uid);
      ok++;
    } catch (e) { failed++; }
  }

  addAdminLog("Массовое удаление: " + ok + " удалено, " + failed + " ошибок", "crit");
  toast("Удалено: " + ok + (failed ? ", ошибок: " + failed : ""), "warn");
}

export async function bulkExport(uids) {
  if (!uids.length) {
    toast("Ничего не выделено", "warn");
    return;
  }

  const all = await listUsers();
  const selected = all.filter(u => uids.includes(u.uid));

  exportUsers(selected, "selected");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
