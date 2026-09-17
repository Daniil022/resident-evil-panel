// js/admin/admin-users.js
import { listUsers, deleteUser, changePin, changeRole, warnUser, unwarnUser }
  from "../core/auth.js";
import { addAdminLog } from "./admin-log.js";
import { toast } from "../core/utils.js";

export async function renderUsersTable() {
  const tbody = document.getElementById("usersTbody");
  if (!tbody) return;

  const users = await listUsers();
  tbody.innerHTML = "";

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="4" style="text-align:center; color:var(--muted); padding:24px;">
        Участников пока нет. Создайте первого через «Создать аккаунт».
      </td></tr>
    `;
    return;
  }

  users.sort((a, b) => (b.warn || 0) - (a.warn || 0));

  users.forEach(u => {
    const tr = document.createElement("tr");
    const warnCount = u.warn || 0;
    const warnClass = warnCount >= 3 ? "danger" : warnCount > 0 ? "warn" : "";

    tr.innerHTML = `
      <td><b style="color:#fff;">${u.login}</b></td>
      <td class="role-cell ${roleToClass(u.role)}">${u.role}</td>
      <td class="${warnClass}">${warnCount} / 3</td>
      <td>
        <div class="actions">
          <button class="btn small secondary" onclick="window.__adminChangePin('${u.uid}')" title="Сменить PIN">PIN</button>
          <button class="btn small secondary" onclick="window.__adminChangeRole('${u.uid}')" title="Сменить роль">Роль</button>
          <button class="btn small secondary" onclick="window.__adminWarn('${u.uid}')" title="Warn">+W</button>
          <button class="btn small secondary" onclick="window.__adminUnwarn('${u.uid}')" title="Снять Warn">−W</button>
          <button class="btn small danger" onclick="window.__adminDelete('${u.uid}')" title="Удалить">✕</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function roleToClass(role) {
  if (role === "Император") return "gold";
  if (role === "Лорд Тьмы") return "red";
  if (role === "Рыцарь Смерти" || role === "Скелет Ужаса") return "blue";
  return "";
}

// ==================== ГЛОБАЛЬНЫЕ ДЕЙСТВИЯ ====================
window.__adminChangePin = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  const newPin = prompt(`Новый PIN для ${u.login} (4-8 цифр):`);
  if (newPin === null) return;
  try {
    await changePin(uid, newPin);
    toast(`PIN для ${u.login} обновлён`, "ok");
    addAdminLog(`PIN изменён для ${u.login}`, "ok");
    await renderUsersTable();
  } catch (e) {
    toast(e.message, "warn");
  }
};

window.__adminChangeRole = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  const newRole = prompt(`Новая роль для ${u.login}:\n\nДоступные: Император, Лорд Тьмы, Рыцарь Смерти, Скелет Ужаса, Тёмная душа`, u.role);
  if (newRole === null) return;
  try {
    await changeRole(uid, newRole.trim());
    toast(`Роль ${u.login} → ${newRole}`, "ok");
    addAdminLog(`Роль ${u.login} изменена на ${newRole}`, "ok");
    await renderUsersTable();
  } catch (e) {
    toast(e.message, "warn");
  }
};

window.__adminWarn = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  const reason = prompt(`Причина Warn для ${u.login}:`, "");
  if (reason === null) return;
  try {
    const newCount = await warnUser(uid, reason.trim());
    if (newCount >= 3) {
      toast(`${u.login} получил 3/3 Warn — ЗАБАНЕН`, "warn");
      addAdminLog(`⚠ ${u.login} ЗАБАНЕН (3/3 Warn)`, "crit");
    } else {
      toast(`${u.login} получил Warn (${newCount}/3)`, "warn");
      addAdminLog(`${u.login} получил Warn (${newCount}/3) — ${reason || "без причины"}`, "warn");
    }
    await renderUsersTable();
  } catch (e) {
    toast(e.message, "warn");
  }
};

window.__adminUnwarn = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  if (!confirm(`Снять 1 Warn с ${u.login}?`)) return;
  try {
    const newCount = await unwarnUser(uid);
    toast(`Warn снят с ${u.login} (${newCount}/3)`, "ok");
    addAdminLog(`Warn снят с ${u.login} (осталось ${newCount}/3)`, "ok");
    await renderUsersTable();
  } catch (e) {
    toast(e.message, "warn");
  }
};

window.__adminDelete = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  if (!confirm(`УДАЛИТЬ ${u.login}? Действие необратимо.`)) return;
  try {
    await deleteUser(uid);
    toast(`${u.login} удалён из системы`, "ok");
    addAdminLog(`Аккаунт ${u.login} удалён`, "crit");
    await renderUsersTable();
  } catch (e) {
    toast(e.message, "warn");
  }
};
