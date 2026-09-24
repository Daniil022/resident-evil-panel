// js/modules/rules.js
import { db } from "../firebase-init.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { openModal, closeModal, toast, escapeHtml } from "../core/utils.js";
import { canEdit, requireEdit } from "./gestion.js";

const DEMO_KEY = "re_demo_rules";
let rules = [];

export async function initRules() {
  const grid = document.getElementById("rulesGrid");
  if (!grid) return;

  const toolbar = document.getElementById("rulesToolbar");
  if (toolbar && !toolbar.__bound) {
    toolbar.__bound = true;
    if (canEdit()) {
      toolbar.innerHTML = `<button class="btn" id="addRuleBtn">+ Добавить правило</button>`;
      document.getElementById("addRuleBtn").onclick = () => openRuleModal();
    } else {
      toolbar.innerHTML = "";
    }
  }

  try {
    const snap = await getDocs(collection(db, "rules"));
    rules = snap.docs.map(d => ({ id: d.id, ...d.data(), source: "firebase" }));
  } catch (e) {
    rules = getDemoRules();
  }

  if (rules.length === 0) rules = getDemoRules();
  renderGrid();
}

function getDemoRules() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); }
  catch { return []; }
}
function saveDemoRules() {
  localStorage.setItem(DEMO_KEY, JSON.stringify(rules.filter(r => r.source !== "firebase")));
}

function renderGrid() {
  const grid = document.getElementById("rulesGrid");
  if (!grid) return;

  if (rules.length === 0) {
    grid.innerHTML = `<div class="contracts-empty" style="grid-column:1/-1;">
      <div class="contracts-empty-icon">📖</div>
      <div class="contracts-empty-text">Правил пока нет</div>
      <div class="contracts-empty-sub">Лидер или зам может добавить правила</div>
    </div>`;
    return;
  }

  const editable = canEdit();

  grid.innerHTML = rules.map((r, i) => `
    <div class="card">
      <div class="name">${i + 1}. ${escapeHtml(r.title)}</div>
      <div class="stat">${escapeHtml(r.text)}</div>
      ${editable ? `
        <div style="display:flex;gap:6px;margin-top:12px;">
          <button class="btn small secondary" onclick="window.__ruleEdit('${r.id}')">✏️</button>
          <button class="btn small danger" onclick="window.__ruleDelete('${r.id}')">🗑</button>
        </div>
      ` : ""}
    </div>
  `).join("");
}

function openRuleModal(rule = null) {
  if (!requireEdit()) return;

  openModal({
    title: rule ? "РЕДАКТИРОВАТЬ ПРАВИЛО" : "ДОБАВИТЬ ПРАВИЛО",
    html: `
      <div class="form-grid">
        <div class="form-field" style="grid-column:1/-1;">
          <label>Заголовок</label>
          <input type="text" id="rTitle" value="${rule ? escapeHtml(rule.title) : ""}" placeholder="Верность" autocomplete="off">
        </div>
        <div class="form-field" style="grid-column:1/-1;">
          <label>Текст правила</label>
          <textarea id="rText" placeholder="Описание правила...">${rule ? escapeHtml(rule.text) : ""}</textarea>
        </div>
      </div>
      <div id="ruleError" style="color:var(--red);font-size:12px;display:none;"></div>
    `,
    confirmText: rule ? "СОХРАНИТЬ" : "СОЗДАТЬ",
    onConfirm: () => saveRule(rule)
  });
  setTimeout(() => document.getElementById("rTitle")?.focus(), 80);
}

async function saveRule(existing) {
  if (!requireEdit()) return;

  const title = document.getElementById("rTitle").value.trim();
  const text = document.getElementById("rText").value.trim();
  const err = document.getElementById("ruleError");

  err.style.display = "none";
  if (!title) { err.textContent = "Введите заголовок"; err.style.display = "block"; return; }

  const data = { title, text };

  try {
    if (existing?.source === "firebase") {
      await updateDoc(doc(db, "rules", existing.id), data);
      Object.assign(existing, data);
    } else {
      const ref = await addDoc(collection(db, "rules"), data);
      rules.push({ id: ref.id, ...data, source: "firebase" });
    }
    toast(existing ? "Обновлено" : "Добавлено", "ok");
  } catch (e) {
    if (existing) Object.assign(existing, data);
    else rules.push({ id: "demo-rule-" + Date.now(), ...data, source: "demo" });
    saveDemoRules();
    toast("Готово (демо)", "ok");
  }
  renderGrid();
  closeModal();
}

window.__ruleEdit = function(id) {
  const r = rules.find(x => x.id === id);
  if (r) openRuleModal(r);
};

window.__ruleDelete = async function(id) {
  if (!requireEdit()) return;
  if (!confirm("Удалить правило?")) return;
  const r = rules.find(x => x.id === id);
  if (!r) return;
  try { if (r.source === "firebase") await deleteDoc(doc(db, "rules", id)); } catch (e) {}
  rules = rules.filter(x => x.id !== id);
  saveDemoRules();
  renderGrid();
  toast("Удалено", "ok");
};
