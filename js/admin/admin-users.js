// js/admin/admin-users.js
import { listUsers, deleteUser, changePin, changeRole, warnUser, unwarnUser }
  from "../core/auth.js";
import { listRoles } from "../core/roles.js";
import { getRoleColor, getRoleName, getDivisionColor, getDivisionName }
  from "../core/colorize.js";
import { toast } from "../core/utils.js";
import { raf } from "../core/perf.js";

let renderScheduled = false;

export async function renderUsersTable(force = false) {
  if (renderScheduled) return;
  renderScheduled = true;

  const tbody = document.getElementById("usersTbody");
  if (!tbody) { renderScheduled = false; return; }

  const users = await listUsers(force);

  raf(() => {
    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px;">
        Участников нет. Создайте первого через кнопку «Создать аккаунт».
      </td></tr>`;
      renderScheduled = false;
      return;
    }

    const sorted = [...users].sort((a, b) => {
      const bA = a.banned ? 1 : 0;
      const bB = b.banned ? 1 : 0;
      if (bA !== bB) return bB - bA;
      return (b.warn || 0) - (a.warn || 0);
    });

    const html = sorted.map(u => {
      const w = u.warn || 0;
      const banned = u.banned || w >= 3;
      const wCls = banned ? "danger" : w > 0 ? "warn" : "";
      const lockIcon = banned ? " 🔒" : "";
      const banLabel = banned ? `<span style="color:var(--red);font-size:10px;margin-left:6px;">ЗАБАНЕН</span>` : "";

      const roleColor = getRoleColor(u.role);
      const roleName = getRoleName(u.role);
      const divColor = getDivisionColor(u.division);
      const divName = getDivisionName(u.division);

      const plusWBtn = banned
        ? `<button class="btn small secondary" disabled style="opacity:0.4;cursor:not-allowed;">+W</button>`
        : `<button class="btn small secondary" onclick="window.__adminWarn('${u.uid}')">+W</button>`;

      return `
        <tr>
          <td><b style="color:#fff;">${u.login}</b>${lockIcon}${banLabel}</td>
          <td><span class="role-badge" style="background:${hexRgba(roleColor,0.15)};color:${roleColor};border:1px solid ${hexRgba(roleColor,0.3)};">${roleName}</span></td>
          <td>${u.division ? `<span class="division-badge" style="background:${hexRgba(divColor,0.15)};color:${divColor};border:1px solid ${hexRgba(divColor,0.3)};">${divName}</span>` : '<span style="color:#666;font-size:11px;">—</span>'}</td>
          <td class="${wCls}">${w} / 3</td>
          <td>
            <div class="actions">
              <button class="btn small secondary" onclick="window.__adminChangePin('${u.uid}')">PIN</button>
              <button class="btn small secondary" onclick="window.__adminChangeRole('${u.uid}')">Роль</button>
              <button class="btn small secondary" onclick="window.__adminChangeDivision('${u.uid}')">Отряд</button>
              ${plusWBtn}
              <button class="btn small secondary" onclick="window.__adminUnwarn('${u.uid}')">−W</button>
              <button class="btn small danger" onclick="window.__adminDelete('${u.uid}')">✕</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    tbody.innerHTML = html;
    renderScheduled = false;
  });
}

function hexRgba(hex, alpha) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0,2), 16);
  const g = parseInt(c.substring(2,4), 16);
  const b = parseInt(c.substring(4,6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ==================== ДЕЙСТВИЯ ====================
window.__adminChangePin = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  const newPin = prompt(`Новый PIN для ${u.login}:`);
  if (newPin === null) return;
  try {
    await changePin(uid, newPin);
    toast("PIN обновлён", "ok");
    await renderUsersTable(true);
  } catch (e) { toast(e.message, "warn"); }
};

window.__adminChangeRole = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  const roles = await listRoles();
  const menu = roles.map((r, i) => `${i + 1}. ${r.name}`).join("\n");
  const num = prompt(`Роль для ${u.login}:\n\n${menu}\n\nВведи номер:`, "1");
  if (num === null) return;
  const idx = parseInt(num) - 1;
  if (isNaN(idx) || idx < 0 || idx >= roles.length) {
    return toast("Неверный номер", "warn");
  }
  try {
    await changeRole(uid, roles[idx].id);
    toast("Роль изменена", "ok");
    await renderUsersTable(true);
  } catch (e) { toast(e.message, "warn"); }
};

window.__adminChangeDivision = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  const { listDivisions } = await import("../core/divisions.js");
  const divisions = await listDivisions();
  const menu = ["0. — без подразделения —", ...divisions.map((d, i) => `${i + 1}. ${d.name}`)].join("\n");
  const num = prompt(`Подразделение для ${u.login}:\n\n${menu}\n\nВведи номер:`, "0");
  if (num === null) return;
  const idx = parseInt(num);
  if (isNaN(idx) || idx < 0 || idx > divisions.length) {
    return toast("Неверный номер", "warn");
  }
  const division = idx === 0 ? null : divisions[idx - 1].id;
  try {
    const { changeDivision } = await import("../core/auth.js");
    await changeDivision(uid, division);
    toast("Подразделение обновлено", "ok");
    await renderUsersTable(true);
  } catch (e) { toast(e.message, "warn"); }
};

window.__adminWarn = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  const w = u.warn || 0;
  if (w >= 3 || u.banned) return toast(`${u.login} уже забанен`, "warn");
  const reason = prompt(`Причина Warn для ${u.login}:`, "");
  if (reason === null) return;
  try {
    const res = await warnUser(uid, reason.trim());
    toast(res.banned ? `${u.login} ЗАБАНЕН` : `Warn (${res.warn}/3)`, "warn");
    await renderUsersTable(true);
  } catch (e) { toast(e.message, "warn"); }
};

window.__adminUnwarn = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  if (!confirm(`Снять Warn с ${u.login}?`)) return;
  try {
    const res = await unwarnUser(uid);
    toast(`Warn снят (${res.warn}/3)`, "ok");
    await renderUsersTable(true);
  } catch (e) { toast(e.message, "warn"); }
};

window.__adminDelete = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  if (!confirm(`УДАЛИТЬ ${u.login}?`)) return;
  try {
    await deleteUser(uid);
    toast(`${u.login} удалён`, "ok");
    await renderUsersTable(true);
  } catch (e) { toast(e.message, "warn"); }
};
