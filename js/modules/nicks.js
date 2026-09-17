// js/modules/nicks.js
import { db } from "../firebase-init.js";
import {
  collection, addDoc, getDocs, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { listUsers } from "../core/auth.js";
import { listRoles } from "../core/roles.js";
import { listDivisions } from "../core/divisions.js";
import { getRoleColor, getRoleName, getDivisionColor, getDivisionName }
  from "../core/colorize.js";
import { openModal, closeModal, toast } from "../core/utils.js";
import { escapeHtml, hexRgba } from "./gestion.js";
import { getCurrentUser } from "../core/state.js";

const DEMO_NICK_APPS = "re_demo_nick_applications";

// ==================== ИГРОВЫЕ НИКИ ====================
export async function initNicks() {
  const grid = document.getElementById("nicksGrid");
  if (!grid) return;

  const toolbar = document.getElementById("nicksToolbar");
  if (toolbar && !toolbar.__bound) {
    toolbar.__bound = true;
    toolbar.innerHTML = `<button class="btn" id="addNickBtn">+ Добавить свой ник</button>`;
    document.getElementById("addNickBtn").onclick = () => openNickModal();
  }

  const users = await listUsers(true);

  if (users.length === 0) {
    grid.innerHTML = `<div class="contracts-empty" style="grid-column:1/-1;">
      <div class="contracts-empty-icon">👤</div>
      <div class="contracts-empty-text">Участников пока нет</div>
      <div class="contracts-empty-sub">Нажми «+ Добавить свой ник» чтобы попасть в реестр</div>
    </div>`;
    return;
  }

  grid.innerHTML = users.map(u => {
    const roleColor = getRoleColor(u.role);
    const roleName = getRoleName(u.role);
    const divColor = getDivisionColor(u.division);
    const divName = getDivisionName(u.division);
    const banned = u.banned ? `<span style="color:var(--red);font-size:10px;margin-left:6px;">ЗАБАНЕН</span>` : "";

    // Отряд — всегда показываем (или "без отряда")
    const divBadge = u.division
      ? `<span class="division-badge" style="background:${hexRgba(divColor,0.15)};color:${divColor};border:1px solid ${hexRgba(divColor,0.3)};margin-left:6px;">${divName}</span>`
      : `<span class="division-badge" style="background:rgba(120,120,120,0.15);color:#888;border:1px solid rgba(120,120,120,0.3);margin-left:6px;">— без отряда —</span>`;

    // Аватар
    const avatarHtml = u.avatar
      ? `<img src="${u.avatar}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;display:block;margin-bottom:10px;border:2px solid var(--border);">`
      : `<div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,var(--cyan),var(--blue));display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:700;margin-bottom:10px;">${escapeHtml(u.login.charAt(0).toUpperCase())}</div>`;

    return `
      <div class="card">
        ${avatarHtml}
        <div class="name">${escapeHtml(u.login)}${banned}</div>
        <div style="margin:8px 0;">
          <span class="role-badge" style="background:${hexRgba(roleColor,0.15)};color:${roleColor};border:1px solid ${hexRgba(roleColor,0.3)};">${roleName}</span>
          ${divBadge}
        </div>
        ${u.age ? `<div class="stat">Возраст: <span class="val">${u.age}</span></div>` : ""}
        ${u.voice ? `<div class="stat">ГС: <span class="val">${u.voice === "yes" ? "✓ есть" : "✕ нет"}</span></div>` : ""}
        ${u.about ? `<div class="stat">О себе: ${escapeHtml(u.about)}</div>` : ""}
        ${u.plans ? `<div class="stat">Планы: ${escapeHtml(u.plans)}</div>` : ""}
        <div class="stat">Контрактов: <span class="val">${u.contracts || 0}</span></div>
        <div class="stat">Warn: <span class="val">${u.warn || 0} / 3</span></div>
      </div>
    `;
  }).join("");
}

// ==================== ФОРМА ЗАЯВКИ НА НИК ====================
function openNickModal() {
  const me = getCurrentUser();
  if (!me) return;

  openModal({
    title: "ЗАЯВКА: ДОБАВИТЬ СВОЙ НИК",
    html: `
      <div class="form-grid">
        <div class="form-field" style="grid-column:1/-1;">
          <label>Игровой ник</label>
          <input type="text" id="nkNick" value="${escapeHtml(me.login)}" readonly>
          <div class="form-hint">Это твой логин в системе</div>
        </div>
        <div class="form-field">
          <label>Возраст</label>
          <input type="number" id="nkAge" placeholder="18" min="10" max="99">
        </div>
        <div class="form-field">
          <label>Есть ли ГС (голосовой чат)?</label>
          <select id="nkVoice" class="role-select">
            <option value="yes">Да</option>
            <option value="no">Нет</option>
          </select>
        </div>
        <div class="form-field" style="grid-column:1/-1;">
          <label>О себе</label>
          <textarea id="nkAbout" placeholder="Пара слов о себе..." maxlength="500"></textarea>
        </div>
        <div class="form-field" style="grid-column:1/-1;">
          <label>Какие планы на симью?</label>
          <textarea id="nkPlans" placeholder="Чем хочешь заниматься в симье..." maxlength="500"></textarea>
        </div>
      </div>
      <p style="color:var(--muted);font-size:11.5px;margin-top:8px;">
        Заявка уйдёт лидеру и заму. После одобрения твой ник появится в реестре.
      </p>
      <div id="nkError" style="color:var(--red);font-size:12px;display:none;"></div>
    `,
    confirmText: "ОТПРАВИТЬ ЗАЯВКУ",
    onConfirm: () => submitNickApplication()
  });
  setTimeout(() => document.getElementById("nkAge")?.focus(), 80);
}

async function submitNickApplication() {
  const me = getCurrentUser();
  if (!me) return;

  const age = parseInt(document.getElementById("nkAge").value) || 0;
  const voice = document.getElementById("nkVoice").value;
  const about = document.getElementById("nkAbout").value.trim();
  const plans = document.getElementById("nkPlans").value.trim();
  const err = document.getElementById("nkError");

  err.style.display = "none";
  if (age < 10 || age > 99) { err.textContent = "Укажите возраст (10-99)"; err.style.display = "block"; return; }
  if (!about) { err.textContent = "Заполните «О себе»"; err.style.display = "block"; return; }
  if (!plans) { err.textContent = "Заполните «Планы на симью»"; err.style.display = "block"; return; }

  const data = {
    uid: me.uid,
    nick: me.login,
    age,
    voice,
    about,
    plans,
    status: "pending",
    createdAt: Date.now()
  };

  try {
    await addDoc(collection(db, "applications_nicks"), data);
    toast("Заявка отправлена лидеру", "ok");
  } catch (e) {
    const demo = JSON.parse(localStorage.getItem(DEMO_NICK_APPS) || "[]");
    demo.push({ id: "demo-nk-" + Date.now(), ...data });
    localStorage.setItem(DEMO_NICK_APPS, JSON.stringify(demo));
    toast("Заявка отправлена (демо)", "ok");
  }
  closeModal();
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
