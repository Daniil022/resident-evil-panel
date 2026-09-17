// js/modules/nicks.js
import { db } from "../firebase-init.js";
import {
  collection, addDoc, getDocs, doc, deleteDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { listUsers, changeRole } from "../core/auth.js";
import { listRoles } from "../core/roles.js";
import { listDivisions } from "../core/divisions.js";
import { getRoleColor, getRoleName, getDivisionColor, getDivisionName }
  from "../core/colorize.js";
import { openModal, closeModal, toast } from "../core/utils.js";
import { escapeHtml, hexRgba, formatDate } from "./gestion.js";
import { getCurrentUser } from "../core/state.js";

// ==================== ИГРОВЫЕ НИКИ ====================
export async function initNicks() {
  const grid = document.getElementById("nicksGrid");
  if (!grid) return;

  // Toolbar
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
    const contracts = u.contracts || 0;
    const banned = u.banned ? `<span style="color:var(--red);font-size:10px;margin-left:6px;">ЗАБАНЕН</span>` : "";

    return `
      <div class="card">
        <div class="name">${escapeHtml(u.login)}${banned}</div>
        <div style="margin:8px 0;">
          <span class="role-badge" style="background:${hexRgba(roleColor,0.15)};color:${roleColor};border:1px solid ${hexRgba(roleColor,0.3)};">${roleName}</span>
          ${u.division ? `<span class="division-badge" style="background:${hexRgba(divColor,0.15)};color:${divColor};border:1px solid ${hexRgba(divColor,0.3)};margin-left:6px;">${divName}</span>` : ""}
        </div>
        ${u.age ? `<div class="stat">Возраст: <span class="val">${u.age}</span></div>` : ""}
        ${u.about ? `<div class="stat">${escapeHtml(u.about)}</div>` : ""}
        <div class="stat">Контрактов: <span class="val">${contracts}</span></div>
        <div class="stat">Warn: <span class="val">${u.warn || 0} / 3</span></div>
      </div>
    `;
  }).join("");
}

function openNickModal() {
  const me = getCurrentUser();
  if (!me) return;

  openModal({
    title: "ДОБАВИТЬ СВОЙ НИК",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Игровой ник</label>
          <input type="text" id="nkNick" value="${escapeHtml(me.login)}" placeholder="Nick_Name" autocomplete="off">
        </div>
        <div class="form-field">
          <label>Реальное имя (опционально)</label>
          <input type="text" id="nkName" placeholder="Даниил" autocomplete="off">
        </div>
        <div class="form-field">
          <label>Возраст</label>
          <input type="number" id="nkAge" placeholder="18" min="10" max="99">
        </div>
        <div class="form-field" style="grid-column:1/-1;">
          <label>О себе</label>
          <textarea id="nkAbout" placeholder="Пара слов о себе..."></textarea>
        </div>
      </div>
      <div id="nkError" style="color:var(--red);font-size:12px;display:none;"></div>
    `,
    confirmText: "ОТПРАВИТЬ",
    onConfirm: () => saveNick()
  });
  setTimeout(() => document.getElementById("nkNick")?.focus(), 80);
}

async function saveNick() {
  const me = getCurrentUser();
  if (!me) return;

  const nick = document.getElementById("nkNick").value.trim();
  const name = document.getElementById("nkName").value.trim();
  const age = parseInt(document.getElementById("nkAge").value) || null;
  const about = document.getElementById("nkAbout").value.trim();
  const err = document.getElementById("nkError");

  err.style.display = "none";
  if (!nick) { err.textContent = "Введите ник"; err.style.display = "block"; return; }

  // Обновляем юзера: добавляем поля name, age, about
  try {
    const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await updateDoc(doc(db, "users", me.uid), {
      realName: name,
      age,
      about,
      nickAddedAt: Date.now()
    });
  } catch (e) {
    // демо
    const demoUsers = JSON.parse(localStorage.getItem("re_panel_demo_users") || "[]");
    const idx = demoUsers.findIndex(u => u.uid === me.uid);
    if (idx >= 0) {
      demoUsers[idx].realName = name;
      demoUsers[idx].age = age;
      demoUsers[idx].about = about;
      localStorage.setItem("re_panel_demo_users", JSON.stringify(demoUsers));
    }
  }

  toast("Ник добавлен в реестр", "ok");
  await initNicks();
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
