// js/modules/profile-view.js
import { listUsers } from "../core/auth.js";
import { listRoles } from "../core/roles.js";
import { listDivisions } from "../core/divisions.js";
import { getRoleColor, getRoleName, getDivisionColor, getDivisionName } from "../core/colorize.js";
import { openModal, closeModal, escapeHtml, hexRgba, formatDate } from "../core/utils.js";
import { getCurrentUser } from "../core/state.js";

export function setupProfileClicks() {
  document.addEventListener("click", async (e) => {
    const author = e.target.closest(".msg-author");
    if (author) {
      const login = author.textContent.trim();
      await openProfileByLogin(login);
      return;
    }

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

  const { isBanned, isMuted, getBanRemaining, getMuteRemaining, getPunishments, formatPunishmentType }
    = await import("../core/punishments.js");

  const banned = isBanned(user);
  const muted = isMuted(user);
  const banLeft = getBanRemaining(user);
  const muteLeft = getMuteRemaining(user);
  const punishments = getPunishments(user).slice(0, 10);

  const punishmentsBlock = (banned || muted)
    ? '<div style="margin-top:16px;padding:14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:10px;">' +
        (banned ? '<div style="color:var(--red);font-weight:700;margin-bottom:6px;">🔒 ЗАБАНЕН</div>' +
          (user.banReason ? '<div style="color:#ccc;font-size:12px;margin-bottom:4px;">Причина: ' + escapeHtml(user.banReason) + '</div>' : '') +
          (banLeft ? '<div style="color:var(--muted);font-size:11.5px;">Осталось: ' + formatDuration(banLeft) + '</div>' : '') : '') +
        (muted ? '<div style="color:var(--gold);font-weight:700;margin-top:8px;">🔇 МУТ</div>' +
          (user.mutedReason ? '<div style="color:#ccc;font-size:12px;margin-bottom:4px;">Причина: ' + escapeHtml(user.mutedReason) + '</div>' : '') +
          (muteLeft ? '<div style="color:var(--muted);font-size:11.5px;">Осталось: ' + formatDuration(muteLeft) + '</div>' : '') : '') +
      '</div>'
    : '';

  const historyBlock = punishments.length > 0
    ? '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">' +
        '<div style="color:var(--muted);font-size:11px;margin-bottom:8px;letter-spacing:1px;">ИСТОРИЯ НАКАЗАНИЙ</div>' +
        punishments.map(p => {
          const meta = formatPunishmentType(p.type);
          return '<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px dashed rgba(42,53,67,0.5);font-size:12px;">' +
            '<span style="flex-shrink:0;">' + meta.icon + '</span>' +
            '<div style="flex:1;min-width:0;">' +
              '<div style="color:#fff;font-weight:600;">' + meta.label + (p.reason ? ' — ' + escapeHtml(p.reason) : '') + '</div>' +
              '<div style="color:var(--muted);font-size:11px;">' + escapeHtml(p.by || '—') + ' · ' + formatDate(p.at, "short") + '</div>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>'
    : '';

  openModal({
    title: "ПРОФИЛЬ УЧАСТНИКА",
    html:
      '<div style="text-align:center;margin-bottom:20px;">' +
        '<div style="display:inline-block;">' + avatarHtml + '</div>' +
        '<div style="color:#fff;font-size:20px;font-weight:700;margin-top:14px;">' + escapeHtml(user.login) + '</div>' +
        '<div style="margin-top:10px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' + roleBadge + divBadge + '</div>' +
      '</div>' +
      punishmentsBlock +
      '<div style="background:var(--bg-2);border-radius:10px;padding:16px;margin-top:16px;">' +
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
      '</div>' +
      historyBlock,
    confirmText: "ЗАКРЫТЬ",
    onConfirm: () => closeModal()
  });
}

function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return h + " ч " + m + " мин";
  if (m > 0) return m + " мин";
  return (total % 60) + " сек";
}

window.__openMyProfile = async function() {
  const me = getCurrentUser();
  if (!me) return;
  await openProfileByLogin(me.login);
};
