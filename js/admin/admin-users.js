// js/admin/admin-users.js
import { listUsers, deleteUser, changePin, changeRole, warnUser, unwarnUser, setRoleColor, WARN_LIMIT }
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

    const sorted = [...users].sort((a, b) => {
      const bA = a.banned ? 1 : 0;
      const bB = b.banned ? 1 : 0;
      if (bA !== bB) return bB - bA;
      return (b.warn || 0) - (a.warn || 0);
    });

    const html = sorted.map(u => {
      const w = u.warn || 0;
      const banned = u.banned || w >= WARN_LIMIT;
      const wCls = banned ? "danger" : w > 0 ? "warn" : "";
      const lockIcon = banned ? " 🔒" : "";
      const banLabel = banned ? `<span style="color:var(--red);font-size:10px;margin-left:6px;">ЗАБАНЕН</span>` : "";
      const rCls = u.role === "Император" ? "gold"
                : u.role === "Лорд Тьмы" ? "red"
                : (u.role === "Рыцарь Смерти" || u.role === "Скелет Ужаса") ? "blue"
                : "";
      const colorStyle = u.roleColor ? `style="color:${u.roleColor};"` : "";

      const plusWBtn = banned
        ? `<button class="btn small secondary" disabled style="opacity:0.4;cursor:not-allowed;">+W</button>`
        : `<button class="btn small secondary" onclick="window.__adminWarn('${u.uid}')">+W</button>`;

      return `
        <tr>
          <td><b style="color:#fff;">${u.login}</b>${lockIcon}${banLabel}</td>
          <td class="role-cell ${rCls}" ${colorStyle}>${u.role}</td>
          <td class="${wCls}">${w} / ${WARN_LIMIT}</td>
          <td>
            <div class="actions">
              <button class="btn small secondary" onclick="window.__adminChangePin('${u.uid}')">PIN</button>
              <button class="btn small secondary" onclick="window.__adminChangeRole('${u.uid}')">Роль</button>
              <button class="btn small secondary" onclick="window.__adminRoleColor('${u.uid}')">🎨</button>
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

window.__adminChangePin = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  const newPin = prompt(`Новый PIN для ${u.login} (4-8 цифр):`);
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
  const newRole = prompt(
    `Новая роль для ${u.login}:\n\nИмператор\nЛорд Тьмы\nРыцарь Смерти\nСкелет Ужаса\nТёмная душа`,
    u.role
  );
  if (newRole === null) return;
  try {
    await changeRole(uid, newRole.trim());
    toast(`${u.login} → ${newRole.trim()}`, "ok");
    await renderUsersTable(true);
  } catch (e) { toast(e.message, "warn"); }
};

window.__adminRoleColor = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;
  const color = prompt(`HEX-цвет для роли ${u.login} (например #00c8d4):`, u.roleColor || "#00c8d4");
  if (color === null) return;
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    toast("Неверный HEX. Пример: #00c8d4", "warn");
    return;
  }
  try {
    await setRoleColor(uid, color);
    toast(`Цвет роли ${u.login} обновлён`, "ok");
    await renderUsersTable(true);
  } catch (e) { toast(e.message, "warn"); }
};

window.__adminWarn = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;

  const w = u.warn || 0;
  if (w >= WARN_LIMIT || u.banned) {
    toast(`${u.login} уже забанен (${w}/${WARN_LIMIT})`, "warn");
    return;
  }

  const reason = prompt(`Причина Warn для ${u.login} (${w}/${WARN_LIMIT} → ${w+1}/${WARN_LIMIT}):`, "");
  if (reason === null) return;

  try {
    const res = await warnUser(uid, reason.trim());
    if (res.banned) {
      toast(`⚠ ${u.login} ЗАБАНЕН (${res.warn}/${WARN_LIMIT})`, "warn");
    } else {
      toast(`${u.login} — Warn (${res.warn}/${WARN_LIMIT})`, "warn");
    }
    await renderUsersTable(true);
  } catch (e) {
    toast(e.message, "warn");
  }
};

window.__adminUnwarn = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) return;

  const w = u.warn || 0;
  if (w === 0) {
    toast("У пользователя нет Warn", "warn");
    return;
  }

  if (!confirm(`Снять 1 Warn с ${u.login}? (${w}/${WARN_LIMIT} → ${w-1}/${WARN_LIMIT})`)) return;

  try {
    const res = await unwarnUser(uid);
    if (!res.banned && w >= WARN_LIMIT) {
      toast(`Warn снят. ${u.login} разбанен! (${res.warn}/${WARN_LIMIT})`, "ok");
    } else {
      toast(`Warn снят (${res.warn}/${WARN_LIMIT})`, "ok");
    }
    await renderUsersTable(true);
  } catch (e) {
    toast(e.message, "warn");
  }
};

window.__adminDelete = async function(uid) {
  const users = await listUsers();
  const u = users.find(x => x.uid === uid);
  if (!u) {
    toast("Пользователь не найден", "warn");
    return;
  }
  if (!confirm(`УДАЛИТЬ ${u.login}? Действие необратимо.`)) return;

  try {
    await deleteUser(uid);
    toast(`${u.login} удалён`, "ok");
    await renderUsersTable(true);
  } catch (e) {
    toast("Ошибка удаления: " + e.message, "warn");
  }
};
