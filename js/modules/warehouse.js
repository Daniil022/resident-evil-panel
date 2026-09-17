// js/modules/warehouse.js
import { db } from "../firebase-init.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { openModal, closeModal, toast } from "../core/utils.js";
import { uploadMedia } from "./contracts/contracts-upload.js";
import { canEdit, requireEdit, escapeHtml, formatDate } from "./gestion.js";

const DEMO_KEY = "re_demo_warehouse";
let items = [];

export async function initWarehouse() {
  const grid = document.getElementById("warehouseGrid");
  if (!grid) return;

  // Кнопка «Добавить»
  const toolbar = document.getElementById("warehouseToolbar");
  if (toolbar && !toolbar.__bound) {
    toolbar.__bound = true;
    if (canEdit()) {
      toolbar.innerHTML = `<button class="btn" id="addWarehouseBtn">+ Добавить предмет</button>`;
      document.getElementById("addWarehouseBtn").onclick = () => openItemModal();
    } else {
      toolbar.innerHTML = "";
    }
  }

  // Пробуем Firebase, иначе демо
  try {
    const snap = await getDocs(collection(db, "warehouse"));
    items = snap.docs.map(d => ({ id: d.id, ...d.data(), source: "firebase" }));
  } catch (e) {
    items = getDemoItems();
  }

  if (items.length === 0) items = getDemoItems();

  renderGrid();
}

function getDemoItems() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); }
  catch { return []; }
}
function saveDemoItems() {
  localStorage.setItem(DEMO_KEY, JSON.stringify(items.filter(i => i.source !== "firebase")));
}

function renderGrid() {
  const grid = document.getElementById("warehouseGrid");
  if (!grid) return;

  if (items.length === 0) {
    grid.innerHTML = `<div class="contracts-empty" style="grid-column:1/-1;">
      <div class="contracts-empty-icon">🏭</div>
      <div class="contracts-empty-text">Склад пуст</div>
      <div class="contracts-empty-sub">Лидер или зам может добавить предметы</div>
    </div>`;
    return;
  }

  const editable = canEdit();

  grid.innerHTML = items.map(it => `
    <div class="card" data-id="${it.id}">
      <div class="name">${escapeHtml(it.name)}</div>
      <div class="role">${escapeHtml(it.category || "Без категории")}</div>
      <div class="stat">Количество: <span class="val">${it.count || 0}</span></div>
      ${it.photo ? `
        <div class="contract-media" style="margin-top:10px;">
          <img src="${it.photo}" onclick="window.__openMedia('${it.photo}','image')">
        </div>
      ` : ""}
      ${editable ? `
        <div style="display:flex;gap:6px;margin-top:12px;">
          <button class="btn small secondary" onclick="window.__whEdit('${it.id}')">✏️ Изменить</button>
          <button class="btn small danger" onclick="window.__whDelete('${it.id}')">🗑 Удалить</button>
        </div>
      ` : ""}
    </div>
  `).join("");
}

function openItemModal(item = null) {
  if (!requireEdit()) return;

  openModal({
    title: item ? "РЕДАКТИРОВАТЬ ПРЕДМЕТ" : "ДОБАВИТЬ ПРЕДМЕТ",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Название</label>
          <input type="text" id="whName" value="${item ? escapeHtml(item.name) : ""}" placeholder="Аптечка" autocomplete="off">
        </div>
        <div class="form-field">
          <label>Категория</label>
          <input type="text" id="whCategory" value="${item ? escapeHtml(item.category || "") : ""}" placeholder="Медикаменты" autocomplete="off">
        </div>
        <div class="form-field">
          <label>Количество</label>
          <input type="number" id="whCount" value="${item ? (item.count || 0) : 0}" min="0">
        </div>
        <div class="form-field" style="grid-column:1/-1;">
          <label>Фото (опционально)</label>
          <input type="file" id="whPhoto" accept="image/*">
          <div class="form-hint">Фото уйдёт в ВК-беседу. Не обязательно.</div>
        </div>
      </div>
      <div id="whError" style="color:var(--red);font-size:12px;display:none;"></div>
    `,
    confirmText: item ? "СОХРАНИТЬ" : "СОЗДАТЬ",
    onConfirm: () => saveItem(item)
  });

  setTimeout(() => document.getElementById("whName")?.focus(), 80);
}

async function saveItem(existing) {
  if (!requireEdit()) return;

  const name = document.getElementById("whName").value.trim();
  const category = document.getElementById("whCategory").value.trim();
  const count = parseInt(document.getElementById("whCount").value) || 0;
  const photoFile = document.getElementById("whPhoto").files[0];
  const err = document.getElementById("whError");

  err.style.display = "none";

  if (!name) {
    err.textContent = "Введите название";
    err.style.display = "block";
    return;
  }

  let photo = existing?.photo || "";

  if (photoFile) {
    try {
      const media = await uploadMedia(photoFile, "warehouse", "warehouse", `📦 Склад: ${name}`);
      photo = media.url;
    } catch (e) {
      err.textContent = "Ошибка фото: " + e.message;
      err.style.display = "block";
      return;
    }
  }

  const data = { name, category, count, photo };

  try {
    if (existing?.source === "firebase") {
      await updateDoc(doc(db, "warehouse", existing.id), data);
      Object.assign(existing, data);
    } else {
      const ref = await addDoc(collection(db, "warehouse"), data);
      items.push({ id: ref.id, ...data, source: "firebase" });
    }
    toast(existing ? "Предмет обновлён" : "Предмет добавлен", "ok");
  } catch (e) {
    // Демо
    if (existing) {
      Object.assign(existing, data);
    } else {
      items.push({ id: "demo-wh-" + Date.now(), ...data, source: "demo" });
    }
    saveDemoItems();
    toast(existing ? "Предмет обновлён (демо)" : "Предмет добавлен (демо)", "ok");
  }

  renderGrid();
  closeModal();
}

window.__whEdit = function(id) {
  const item = items.find(i => i.id === id);
  if (item) openItemModal(item);
};

window.__whDelete = async function(id) {
  if (!requireEdit()) return;
  if (!confirm("Удалить предмет?")) return;

  const item = items.find(i => i.id === id);
  if (!item) return;

  try {
    if (item.source === "firebase") {
      await deleteDoc(doc(db, "warehouse", id));
    }
    items = items.filter(i => i.id !== id);
    saveDemoItems();
    toast("Предмет удалён", "ok");
  } catch (e) {
    items = items.filter(i => i.id !== id);
    saveDemoItems();
    toast("Предмет удалён (демо)", "ok");
  }
  renderGrid();
};
