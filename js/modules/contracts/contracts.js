// js/modules/contracts/contracts.js
import { db, storage } from "../../firebase-init.js";
import {
  collection, addDoc, query, orderBy, onSnapshot,
  doc, getDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getCurrentUser } from "../../core/state.js";
import { listUsers, incrementContracts } from "../../core/auth.js";
import { toast, openModal, closeModal } from "../../core/utils.js";
import { renderContractCard, renderMyProgress } from "./contracts-render.js";
import { uploadMedia } from "./contracts-upload.js";

let unsubscribe = null;
let currentContracts = [];
let demoMode = false;
const DEMO_KEY = "re_demo_contracts";

export async function initContracts() {
  const grid = document.getElementById("contractsGrid");
  const progressEl = document.getElementById("contractProgress");
  if (!grid) return;

  // Мой прогресс
  const me = getCurrentUser();
  if (progressEl && me) {
    const users = await listUsers();
    const fullMe = users.find(u => u.uid === me.uid);
    progressEl.innerHTML = renderMyProgress(fullMe || me);
  }

  // Список контрактов
  try {
    const q = query(collection(db, "contracts"), orderBy("createdAt", "desc"));
    unsubscribe = onSnapshot(q, async (snap) => {
      currentContracts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      await renderAll();
    }, () => {
      enableDemo();
    });
  } catch (e) {
    enableDemo();
  }
}

function enableDemo() {
  demoMode = true;
  currentContracts = getDemoContracts();
  renderAll();
}

function getDemoContracts() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); }
  catch { return []; }
}

function saveDemoContracts() {
  localStorage.setItem(DEMO_KEY, JSON.stringify(currentContracts));
}

async function renderAll() {
  const grid = document.getElementById("contractsGrid");
  if (!grid) return;

  if (currentContracts.length === 0) {
    grid.innerHTML = `
      <div class="contracts-empty">
        <div class="contracts-empty-icon">📜</div>
        <div class="contracts-empty-text">Контрактов пока нет</div>
        <div class="contracts-empty-sub">Лидер или зам может создать первый контракт</div>
      </div>
    `;
    return;
  }

  const users = await listUsers();
  const me = getCurrentUser();

  grid.innerHTML = currentContracts
    .map(c => renderContractCard(c, users, me))
    .join("");
}

// ==================== СОЗДАНИЕ ====================
export function openCreateContract() {
  const me = getCurrentUser();
  if (!["Император", "Лорд Тьмы"].includes(me.role)) {
    return toast("Только Император и Лорд Тьмы могут создавать контракты", "warn");
  }

  openModal({
    title: "СОЗДАТЬ КОНТРАКТ",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Название</label>
          <input type="text" id="cTitle" placeholder="Зачистка нефтезавода" autocomplete="off">
        </div>
        <div class="form-field">
          <label>Награда, ₽</label>
          <input type="number" id="cReward" placeholder="50000" min="0">
        </div>
        <div class="form-field" style="grid-column:1/-1;">
          <label>Описание</label>
          <textarea id="cDesc" placeholder="Что нужно сделать..."></textarea>
        </div>
      </div>
      <div id="cError" style="color:var(--red); font-size:12px; display:none;"></div>
    `,
    confirmText: "СОЗДАТЬ",
    onConfirm: async () => {
      const title = document.getElementById("cTitle").value.trim();
      const reward = parseInt(document.getElementById("cReward").value) || 0;
      const description = document.getElementById("cDesc").value.trim();
      const err = document.getElementById("cError");

      if (!title) {
        err.textContent = "Введите название";
        err.style.display = "block";
        return;
      }

      const contract = {
        title, reward, description,
        authorId: me.uid,
        authorLogin: me.login,
        status: "open",
        media: [],
        submittedBy: null,
        createdAt: demoMode ? Date.now() : serverTimestamp()
      };

      try {
        if (demoMode) throw new Error("demo");
        await addDoc(collection(db, "contracts"), contract);
        toast("Контракт создан", "ok");
        closeModal();
      } catch {
        contract.id = "demo-c-" + Date.now();
        contract.createdAt = Date.now();
        currentContracts.unshift(contract);
        saveDemoContracts();
        renderAll();
        toast("Контракт создан (демо)", "ok");
        closeModal();
      }
    }
  });
}

// ==================== ОТЧЁТ ====================
window.__contractSubmit = function(contractId) {
  const c = currentContracts.find(x => x.id === contractId);
  if (!c) return;

  openModal({
    title: "СДАТЬ ОТЧЁТ",
    html: `
      <div class="form-grid">
        <div class="form-field">
          <label>Твой ник</label>
          <input type="text" id="rNick" value="${getCurrentUser().login}" readonly>
        </div>
        <div class="form-field">
          <label>Сколько контрактов выполнил</label>
          <input type="number" id="rCount" value="1" min="1" max="100">
        </div>
        <div class="form-field" style="grid-column:1/-1;">
          <label>Фото/видео доказательство</label>
          <input type="file" id="rMedia" accept="image/*,video/*" multiple>
          <div class="form-hint">До 50 МБ. JPG/PNG/WEBP/GIF или MP4/WEBM/MOV.</div>
        </div>
        <div class="form-field" style="grid-column:1/-1;">
          <label>Комментарий (опционально)</label>
          <textarea id="rComment" placeholder="Кратко о выполнении..."></textarea>
        </div>
      </div>
      <div id="rError" style="color:var(--red); font-size:12px; display:none;"></div>
    `,
    confirmText: "ОТПРАВИТЬ",
    onConfirm: async () => {
      const nick = document.getElementById("rNick").value;
      const count = parseInt(document.getElementById("rCount").value) || 1;
      const files = document.getElementById("rMedia").files;
      const comment = document.getElementById("rComment").value.trim();
      const err = document.getElementById("rError");

      if (!files || files.length === 0) {
        err.textContent = "Прикрепите хотя бы одно фото или видео";
        err.style.display = "block";
        return;
      }

      err.style.display = "none";

      // Загружаем медиа
      const media = [];
      for (const file of Array.from(files).slice(0, 5)) {
        try {
          const result = await uploadMedia(file, contractId, nick);
          media.push(result);
        } catch (e) {
          err.textContent = e.message;
          err.style.display = "block";
          return;
        }
      }

      // Обновляем контракт
      const update = {
        status: "review",
        submittedBy: { uid: getCurrentUser().uid, login: nick, count, comment },
        media,
        submittedAt: demoMode ? Date.now() : serverTimestamp()
      };

      try {
        if (demoMode) throw new Error("demo");
        await updateDoc(doc(db, "contracts", contractId), update);
        toast("Отчёт отправлен на проверку", "ok");
        closeModal();
      } catch {
        const idx = currentContracts.findIndex(x => x.id === contractId);
        if (idx >= 0) {
          currentContracts[idx] = { ...currentContracts[idx], ...update, submittedAt: Date.now() };
          saveDemoContracts();
          renderAll();
        }
        toast("Отчёт отправлен (демо)", "ok");
        closeModal();
      }
    }
  });
};

// ==================== ОДОБРЕНИЕ ====================
window.__contractApprove = async function(contractId) {
  const c = currentContracts.find(x => x.id === contractId);
  if (!c || !c.submittedBy) return;

  const count = c.submittedBy.count || 1;

  // Увеличиваем счётчик контрактов у автора отчёта
  await incrementContracts(c.submittedBy.uid, count);

  const update = { status: "approved", approvedAt: Date.now() };

  try {
    if (demoMode) throw new Error("demo");
    await updateDoc(doc(db, "contracts", contractId), update);
    toast(`Одобрено: +${count} контрактов для ${c.submittedBy.login}`, "ok");
  } catch {
    const idx = currentContracts.findIndex(x => x.id === contractId);
    if (idx >= 0) {
      currentContracts[idx] = { ...currentContracts[idx], ...update };
      saveDemoContracts();
      renderAll();
    }
    toast(`Одобрено: +${count} контрактов`, "ok");
  }

  // Обновить прогресс
  const me = getCurrentUser();
  const users = await listUsers(true);
  const fullMe = users.find(u => u.uid === me.uid);
  const progressEl = document.getElementById("contractProgress");
  if (progressEl && fullMe) progressEl.innerHTML = renderMyProgress(fullMe);
};

window.__contractReject = async function(contractId) {
  const c = currentContracts.find(x => x.id === contractId);
  if (!c) return;
  if (!confirm("Отклонить отчёт?")) return;

  const update = { status: "rejected", rejectedAt: Date.now() };
  try {
    if (demoMode) throw new Error("demo");
    await updateDoc(doc(db, "contracts", contractId), update);
    toast("Отчёт отклонён", "warn");
  } catch {
    const idx = currentContracts.findIndex(x => x.id === contractId);
    if (idx >= 0) {
      currentContracts[idx] = { ...currentContracts[idx], ...update };
      saveDemoContracts();
      renderAll();
    }
    toast("Отчёт отклонён (демо)", "warn");
  }
};

// ==================== ПРОСМОТР МЕДИА ====================
window.__openMedia = function(url, type) {
  openModal({
    title: type === "video" ? "ВИДЕО" : "ФОТО",
    html: type === "video"
      ? `<video src="${url}" controls style="width:100%; border-radius:8px;"></video>`
      : `<img src="${url}" style="width:100%; border-radius:8px;">`,
    confirmText: "ЗАКРЫТЬ",
    onConfirm: () => closeModal()
  });
};

export function destroyContracts() {
  if (unsubscribe) unsubscribe();
}
