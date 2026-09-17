// js/admin/admin-users.js
import { listUsers, deleteUser, changePin, changeRole, warnUser, unwarnUser, setRoleColor }
  from "../core/auth.js";
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
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px;">
        Участников нет. Создайте первого через «Создать аккаунт».
      </td></tr>`;
      renderScheduled = false;
      return;
    }

    const html = users.sort((a, b) => (b.warn || 0) - (a.warn || 0)).map(u => {
      const w = u.warn || 0;
      const wCls = w >= 3 ? "danger" : w > 0 ? "warn" : "";
      const banned = u.banned ? " 🔒" : "";
      const rCls = u.role === "Император" ? "gold"
                : u.role === "Лорд Тьмы" ? "red"
                : (u.role === "Рыцарь Смерти" || u.role === "Скелет Ужаса") ? "blue"
                : "";
      const colorStyle = u.roleColor ? `style="color:${u.roleColor};"` : "";
      return `
        <tr>
          <td><b style="color:#fff;">${u.login}</b>${banned}</td>
          <td class="role-cell ${rCls}" ${colorStyle}>${u.role}</td>
          <td class="${wCls}">${w} / 3</td>
          <td>
            <div class="actions">
              <button class="btn small secondary" onclick="window.__adminChangePin('${u.uid}')">PIN</button>
              <button class="btn small secondary" onclick="window.__adminChangeRole('${u.uid}')">Роль</button>
              <button class="btn small secondary" onclick="window.__adminRoleColor('${u.uid}')">🎨</button>
              <button class="btn small secondary" onclick="window.__adminWarn('${u.uid}')">+W</button>
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

window.__adminChangePin = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  const newPin = prompt(`Новый PIN для ${u.login}:`);
  if (newPin === null) return;
  try {
    await changePin(uid, newPin);
    toast(`PIN ${u.login} обновлён`, "ok");
    await renderUsersTable(true);
  } catch (e) { toast(e.message, "warn"); }
};

window.__adminChangeRole = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  const newRole = prompt(`Новая роль для ${u.login}:\nИмператор, Лорд Тьмы, Рыцарь Смерти, Скелет Ужаса, Тёмная душа`, u.role);
  if (newRole === null) return;
  try {
    await changeRole(uid, newRole.trim());
    toast(`${u.login} → ${newRole}`, "ok");
    await renderUsersTable(true);
  } catch (e) { toast(e.message, "warn"); }
};

window.__adminRoleColor = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  const color = prompt(`Цвет для роли ${u.login} (HEX, например #00c8d4):`, u.roleColor || "#00c8d4");
  if (color === null) return;
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    toast("Неверный HEX", "warn");
    return;
  }
  await setRoleColor(uid, color);
  toast(`Цвет роли ${u.login} обновлён`, "ok");
  await renderUsersTable(true);
};

window.__adminWarn = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  const reason = prompt(`Причина Warn для ${u.login}:`, "");
  if (reason === null) return;
  const n = await warnUser(uid, reason.trim());
  if (n >= 3) toast(`${u.login} ЗАБАНЕН (3/3)`, "warn");
  else toast(`${u.login} — Warn (${n}/3)`, "warn");
  await renderUsersTable(true);
};

window.__adminUnwarn = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  if (!confirm(`Снять 1 Warn с ${u.login}?`)) return;
  const n = await unwarnUser(uid);
  toast(`Warn снят (${n}/3)`, "ok");
  await renderUsersTable(true);
};

window.__adminDelete = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  if (!confirm(`УДАЛИТЬ ${u.login}? Действие необратимо.`)) return;
  try {
    await deleteUser(uid);
    toast(`${u.login} удалён`, "ok");
    await renderUsersTable(true);
  } catch (e) {
    toast("Ошибка удаления: " + e.message, "warn");
  }
};
