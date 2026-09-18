// js/modules/profile-view.js
import { listUsers } from "../core/auth.js";
import { listRoles } from "../core/roles.js";
import { listDivisions } from "../core/divisions.js";
import { getRoleColor, getRoleName, getDivisionColor, getDivisionName } from "../core/colorize.js";
import { openModal, closeModal } from "../core/utils.js";
import { escapeHtml, hexRgba, formatDate } from "./gestion.js";
import { getCurrentUser } from "../core/state.js";

export function setupProfileClicks() {
  // Клик по нику в чате
  document.addEventListener("click", async (e) => {
    const author = e.target.closest(".msg-author");
    if (author) {
      const login = author.textContent.trim();
      await openProfileByLogin(login);
      return;
    }

    // Клик по аватарке в чате
    const avatar = e.target.closest(".msg-avatar");
    if (avatar && avatar.parentElement) {
      const msg = avatar.parentElement;
      const author = msg.querySelector(".msg-author");
      if (author) {
        await openProfileByLogin(author.textContent.trim());
      }
    }
  });
}

export async function openProfileByLogin(login) {
  const users = await listUsers();
  const user = users.find(u => u.login === login);
  if (!user) return;

  const roleName = getRoleName(user.role);
  const roleColor = getRoleColor(user.role);
  const divName = getDivisionName(user.division);
  const divColor = getDivisionColor(user.division);
  const isAlly = user.role === "ally";

  const roleBadge = isAlly
    ? '<span class="role-badge role-badge-rainbow">' + roleName + '</span>'
    : '<span class="role-badge" style="background:' + hexRgba(roleColor, 0.15) + ';color:' + roleColor + ';border:1px solid ' + hexRgba(roleColor, 0.3) + ';">' + roleName + '</span>';

  const divBadge = user.division
    ? '<span class="division-badge" style="background:' + hexRgba(divColor, 0.15) + ';color:' + divColor + ';border:1px solid ' + hexRgba(divColor, 0.3) + ';">' + divName + '</span>'
    : '<span class="division-badge" style="background:rgba(120,120,120,0.15);color:#888;border:1px solid rgba(120,120,120,0.3);">— без отряда —</span>';

  const avatarHtml = user.avatar
    ? '<img src="' + user.avatar + '" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid var(--border);">'
    : '<div style="width:100px;height:100px;border-radius:50%;background:linear-gradient(135deg,#4a4a4a,#2a2a2a);display:flex;align-items:center;justify-content:center;color:#fff;font-size:40px;font-weight:700;border:3px solid var(--border);">' + escapeHtml(user.login.charAt(0).toUpperCase()) + '</div>';

  openModal({
    title: "ПРОФИЛЬ УЧАСТНИКА",
    html:
      '<div style="text-align:center;margin-bottom:20px;">' +
        '<div style="display:inline-block;">' + avatarHtml + '</div>' +
        '<div style="color:#fff;font-size:20px;font-weight:700;margin-top:14px;">' + escapeHtml(user.login) + '</div>' +
        '<div style="margin-top:10px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' + roleBadge + divBadge + '</div>' +
      '</div>' +
      '<div style="background:var(--bg-2);border-radius:10px;padding:16px;">' +
        '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">' +
          '<span style="color:var(--muted);">Возраст</span>' +
          '<span style="color:#fff;font-weight:600;">' + (user.age || '—') + '</span>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">' +
          '<span style="color:var(--muted);">ГС</span>' +
          '<span style="color:#fff;font-weight:600;">' + (user.voice === 'yes' ? '✓ Есть' : '✕ Нет') + '</span>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">' +
          '<span style="color:var(--muted);">Контрактов</span>' +
          '<span style="color:#fff;font-weight:600;">' + (user.contracts || 0) + '</span>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">' +
          '<span style="color:var(--muted);">Warn</span>' +
          '<span style="color:' + ((user.warn || 0) > 0 ? 'var(--red)' : '#fff') + ';font-weight:600;">' + (user.warn || 0) + ' / 3</span>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;padding:8px 0;">' +
          '<span style="color:var(--muted);">Регистрация</span>' +
          '<span style="color:#fff;font-weight:600;">' + formatDate(user.createdAt || Date.now()) + '</span>' +
        '</div>' +
        (user.about ? '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);"><div style="color:var(--muted);font-size:11px;margin-bottom:4px;">О СЕБЕ</div><div style="color:#ccc;">' + escapeHtml(user.about) + '</div></div>' : '') +
        (user.plans ? '<div style="margin-top:12px;"><div style="color:var(--muted);font-size:11px;margin-bottom:4px;">ПЛАНЫ</div><div style="color:#ccc;">' + escapeHtml(user.plans) + '</div></div>' : '') +
      '</div>',
    confirmText: "ЗАКРЫТЬ",
    onConfirm: () => closeModal()
  });
}

window.__openMyProfile = async function() {
  const me = getCurrentUser();
  if (!me) return;
  await openProfileByLogin(me.login);
};
