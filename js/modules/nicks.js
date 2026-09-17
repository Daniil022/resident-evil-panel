// js/modules/nicks.js
import { listUsers } from "../core/auth.js";
import { listRoles } from "../core/roles.js";
import { listDivisions } from "../core/divisions.js";
import { getRoleColor, getRoleName, getDivisionColor, getDivisionName }
  from "../core/colorize.js";

// ==================== ИГРОВЫЕ НИКИ ====================
export async function initNicks() {
  const grid = document.getElementById("nicksGrid");
  if (!grid) return;

  const users = await listUsers(true);

  if (users.length === 0) {
    grid.innerHTML = `
      <div class="contracts-empty" style="grid-column:1/-1;">
        <div class="contracts-empty-icon">👤</div>
        <div class="contracts-empty-text">Участников пока нет</div>
        <div class="contracts-empty-sub">Игроки появятся здесь после создания аккаунтов</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = users.map(u => {
    const roleColor = getRoleColor(u.role);
    const roleName = getRoleName(u.role);
    const divColor = getDivisionColor(u.division);
    const divName = getDivisionName(u.division);
    const contracts = u.contracts || 0;
    const banned = u.banned ? `<span style="color:var(--red);font-size:10px;margin-left:6px;">ЗАБАНЕН</span>` : "";

    return `
      <div class="card">
        <div class="name">${escapeHtml(u.login)}${banned}</div>
        <div style="margin:8px 0;">
          <span class="role-badge" style="background:${hexRgba(roleColor,0.15)};color:${roleColor};border:1px solid ${hexRgba(roleColor,0.3)};">${roleName}</span>
          ${u.division ? `<span class="division-badge" style="background:${hexRgba(divColor,0.15)};color:${divColor};border:1px solid ${hexRgba(divColor,0.3)};margin-left:6px;">${divName}</span>` : ""}
        </div>
        <div class="stat">Контрактов: <span class="val">${contracts}</span></div>
        <div class="stat">Warn: <span class="val">${u.warn || 0} / 3</span></div>
      </div>
    `;
  }).join("");
}

// ==================== РАНГИ СИМЬИ ====================
export async function initRanks() {
  const grid = document.getElementById("ranksGrid");
  if (!grid) return;

  const roles = await listRoles();
  const divisions = await listDivisions();

  if (roles.length === 0 && divisions.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--muted);padding:40px;">
      Роли и подразделения не настроены. Зайдите в ADMIN.
    </div>`;
    return;
  }

  let html = "";

  // Секция РОЛИ
  if (roles.length) {
    html += `<div style="grid-column:1/-1; margin-top:8px; margin-bottom:12px;">
      <h3 style="color:#fff; font-size:15px; letter-spacing:2px; text-transform:uppercase; border-left:3px solid var(--cyan); padding-left:12px;">Роли</h3>
    </div>`;
    html += roles.map(r => `
      <div class="card" style="border-left-color:${r.color};">
        <div class="name" style="color:${r.color};">${escapeHtml(r.name)}</div>
        <div class="stat">${escapeHtml(r.desc || "Без описания")}</div>
        ${r.system ? `<div class="stat" style="color:var(--cyan);font-size:10px;">Системная роль</div>` : ""}
      </div>
    `).join("");
  }

  // Секция ПОДРАЗДЕЛЕНИЯ
  if (divisions.length) {
    html += `<div style="grid-column:1/-1; margin-top:24px; margin-bottom:12px;">
      <h3 style="color:#fff; font-size:15px; letter-spacing:2px; text-transform:uppercase; border-left:3px solid var(--cyan); padding-left:12px;">Подразделения</h3>
    </div>`;
    html += divisions.map(d => `
      <div class="card" style="border-left-color:${d.color};">
        <div class="name" style="color:${d.color};">${escapeHtml(d.name)}</div>
        <div class="stat">${escapeHtml(d.desc || "Без описания")}</div>
      </div>
    `).join("");
  }

  grid.innerHTML = html;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function hexRgba(hex, alpha) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0,2), 16);
  const g = parseInt(c.substring(2,4), 16);
  const b = parseInt(c.substring(4,6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
