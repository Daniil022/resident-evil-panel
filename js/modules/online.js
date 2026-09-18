// js/modules/online.js
import { db } from "../firebase-init.js";
import {
  collection, getDocs, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { listUsers } from "../core/auth.js";
import { getRoleColor, getRoleName, getDivisionColor, getDivisionName } from "../core/colorize.js";
import { escapeHtml, hexRgba } from "./gestion.js";
import { openProfileByLogin } from "./profile-view.js";

let unsub = null;

export async function initOnline() {
  const grid = document.getElementById("onlineGrid");
  if (!grid) return;

  // Первая отрисовка
  renderOnline();
}

export async function renderOnline() {
  const grid = document.getElementById("onlineGrid");
  if (!grid) return;

  try {
    const [users, presenceSnap] = await Promise.all([
      listUsers(),
      getDocs(collection(db, "presence"))
    ]);

    const onlineUids = new Set();
    presenceSnap.forEach(d => {
      const data = d.data();
      if (data.online) onlineUids.add(d.id);
    });

    const onlineUsers = users.filter(u => onlineUids.has(u.uid));

    // Обновляем бейдж
    const badge = document.getElementById("onlineBadge");
    if (badge) badge.textContent = onlineUsers.length;

    if (onlineUsers.length === 0) {
      grid.innerHTML = '<div class="contracts-empty" style="grid-column:1/-1;">' +
        '<div class="contracts-empty-icon">👥</div>' +
        '<div class="contracts-empty-text">Никого нет онлайн</div>' +
        '<div class="contracts-empty-sub">Заходи позже</div>' +
        '</div>';
      return;
    }

    grid.innerHTML = onlineUsers.map(u => {
      const roleColor = getRoleColor(u.role);
      const roleName = getRoleName(u.role);
      const divColor = getDivisionColor(u.division);
      const divName = getDivisionName(u.division);
      const isAlly = u.role === "ally";

      const roleBadge = isAlly
        ? '<span class="role-badge role-badge-rainbow">' + roleName + '</span>'
        : '<span class="role-badge" style="background:' + hexRgba(roleColor, 0.15) + ';color:' + roleColor + ';border:1px solid ' + hexRgba(roleColor, 0.3) + ';">' + roleName + '</span>';

      const divBadge = u.division
        ? '<span class="division-badge" style="background:' + hexRgba(divColor, 0.15) + ';color:' + divColor + ';border:1px solid ' + hexRgba(divColor, 0.3) + ';margin-left:6px;">' + divName + '</span>'
        : '';

      const avatarHtml = u.avatar
        ? '<img src="' + u.avatar + '" style="width:56px;height:56px;border-radius:50%;object-fit:cover;">'
        : '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#4a4a4a,#2a2a2a);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700;">' + escapeHtml(u.login.charAt(0).toUpperCase()) + '</div>';

      return '<div class="card clickable" onclick="window.__openProfileByName(\'' + escapeHtml(u.login) + '\')" style="display:flex;align-items:center;gap:14px;position:relative;">' +
        '<div style="position:relative;">' +
          avatarHtml +
          '<div style="position:absolute;bottom:2px;right:2px;width:14px;height:14px;background:var(--green);border-radius:50%;border:2px solid var(--panel);box-shadow:0 0 8px var(--green);"></div>' +
        '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div class="name">' + escapeHtml(u.login) + '</div>' +
          '<div style="margin-top:6px;">' + roleBadge + divBadge + '</div>' +
        '</div>' +
      '</div>';
    }).join("");

  } catch (e) {
    console.warn("Online load failed:", e);
    grid.innerHTML = '<div style="text-align:center;color:var(--muted);padding:40px;grid-column:1/-1;">Ошибка загрузки</div>';
  }
}

window.__openProfileByName = async function(login) {
  await openProfileByLogin(login);
};
