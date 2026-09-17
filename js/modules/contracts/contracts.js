// js/modules/contracts/contracts.js
import { getCurrentUser } from "../../core/state.js";
import { listUsers, incrementContracts } from "../../core/auth.js";
import { toast, openModal, closeModal } from "../../core/utils.js";
import { uploadMedia } from "./contracts-upload.js";
import { getNextReward, getEarnedRewards } from "./contracts-rewards.js";

const DEMO_KEY = "re_demo_contracts";
let demoMode = false;
let currentContracts = [];

export async function initContracts() {
  const grid = document.getElementById("contractsGrid");
  const progressEl = document.getElementById("contractProgress");
  if (!grid) return;

  const me = getCurrentUser();
  if (progressEl && me) {
    const users = await listUsers();
    const fullMe = users.find(u => u.uid === me.uid);
    progressEl.innerHTML = renderProgress(fullMe || me);
  }

  demoMode = true;
  currentContracts = getDemoContracts();
  renderAll();

  const createBtn = document.getElementById("createContractBtn");
  if (createBtn && !createBtn.__bound) {
    createBtn.__bound = true;
    createBtn.addEventListener("click", openCreateContract);
  }
}

function getDemoContracts() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); }
  catch { return []; }
}

function saveDemoContracts() {
  localStorage.setItem(DEMO_KEY, JSON.stringify(currentContracts));
}

function renderProgress(user) {
  const done = user.contracts || 0;
  const next = getNextReward(done);
  const earned = getEarnedRewards(done);

  return `
    <div class="contract-progress">
      <div class="contract-progress-head">
        <div>
          <div class="contract-progress-title">Твой прогресс контрактов</div>
          <div class="contract-progress-sub">${done} выполнено</div>
        </div>
        ${next.done ? `<div class="contract-progress-max">🏆 МАКСИМУМ</div>`
                    : `<div class="contract-progress-next">До «${next.label}»: ${next.target - done} шт.</div>`}
      </div>
      ${!next.done ? `<div class="bar"><span style="width:${next.progress}%"></span></div>
                      <div class="contract-progress-hint">Награда: ${next.reward}</div>` : ""}
      ${earned.length ? `<div class="contract-earned">${earned.map(e => `<span class="contract-badge">🏅 ${e.label} — ${e.reward}</span>`).join("")}</div>` : ""}
    </div>
  `;
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
    .map(c => renderCard(c, users, me))
    .join("");
}

function renderCard(c, users, me) {
  const author = users.find(u => u.uid === c.authorId);
  const isAdmin = ["Император", "Лорд Тьмы"].includes(me.role);

  const statusMap = {
    open: { text: "Открыт", cls: "green" },
    review: { text: "На проверке", cls: "gold" },
    approved: { text: "Выполнен", cls: "blue" },
    rejected: { text: "Отклонён", cls: "red" }
  };
  const status = statusMap[c.status] || statusMap.open;

  return `
    <div class="card contract-card" data-id="${c.id}">
      <div class="contract-head">
        <div>
          <div class="name">${escapeHtml(c.title)}</div>
          <div class="role">Награда: <span class="val">${c.reward} ₽</span></div>
        </div>
        <span class="contract-status ${status.cls}">${status.text}</span>
      </div>
      <div class="stat">${escapeHtml(c.description || "Без описания")}</div>
      <div class="contract-meta">
        <span>👤 Автор: <b>${escapeHtml(author?.login || "—")}</b></span>
        <span>📅 ${formatDate(c.createdAt)}</span>
      </div>
      ${c.media && c.media.length ? `
        <div class="contract-media">
          ${c.media.map(m => m.type === "image"
            ? `<img src="${m.url}" onclick="window.__openMedia('${m.url}','image')">`
            : `<div style="padding:8px;background:#000;color:#0f0;font-size:11px;border-radius:6px;">📹 ${m.name}</div>`).join("")}
        </div>
      ` : ""}
      ${c.status === "open" ? `<button class="btn small" onclick="window.__contractSubmit('${c.id}')">Сдать отчёт</button>` : ""}
      ${c.status === "review" && isAdmin ? `
        <div class="contract-review-actions">
          <button class="btn small" onclick="window.__contractApprove('${c.id}')">✓ Одобрить</button>
          <button class="btn small secondary" onclick="window.__contractReject('${c.id}')">✕ Отклонить</button>
        </div>
      ` : ""}
      ${isAdmin ? `<button class="btn small danger" style="margin-top:8px;" onclick="window.__contractDelete('${c.id}')">🗑 Удалить контракт</button>` : ""}
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// ==================== СОЗДАНИЕ ====================
export function openCreateContract() {
  const me = getCurrentUser();
  if (!["Император", "Лорд Тьмы"].includes(me.role)) {
    return toast("Только Император и Лорд Тьмы могут создавать", "warn");
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
      <div id="cError" style="color:var(--red);font-size:12px;display:none;"></div>
    `,
    confirmText: "СОЗДАТЬ",
    onConfirm: async () => {
      const title = document.getElementById("cTitle").value.trim();
      const reward = parseInt(document.getElementById("cReward").value) || 0;
      const description = document.getElementById("cDesc").value.trim();
      const err = document.getElementById("cError");

      if (!title) { err.textContent = "Введите название"; err.style.display = "block"; return; }

      const contract = {
        id: "demo-c-" + Date.now(),
        title, reward, description,
        authorId: me.uid, authorLogin: me.login,
        status: "open", media: [],
        createdAt: Date.now()
      };

      currentContracts.unshift(contract);
      saveDemoContracts();
      await renderAll();
      toast("Контракт создан", "ok");
      closeModal();
    }
  });
  setTimeout(() => document.getElementById("cTitle")?.focus(), 80);
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
      <div id="rError" style="color:var(--red);font-size:12px;display:none;"></div>
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
      err.textContent = "Загрузка...";
      err.style.display = "block";
      err.style.color = "var(--cyan)";

      const media = [];
      for (const file of Array.from(files).slice(0, 5)) {
        try {
          const result = await uploadMedia(file, contractId, nick);
          media.push(result);
        } catch (e) {
          err.textContent = e.message;
          err.style.color = "var(--red)";
          return;
        }
      }

      const idx = currentContracts.findIndex(x => x.id === contractId);
      if (idx >= 0) {
        currentContracts[idx].status = "review";
        currentContracts[idx].submittedBy = { uid: getCurrentUser().uid, login: nick, count, comment };
        currentContracts[idx].media = media;
        currentContracts[idx].submittedAt = Date.now();
        saveDemoContracts();
        await renderAll();
      }
      toast("Отчёт отправлен на проверку", "ok");
      closeModal();
    }
  });
};

// ==================== ОДОБРЕНИЕ ====================
window.__contractApprove = async function(contractId) {
  const c = currentContracts.find(x => x.id === contractId);
  if (!c || !c.submittedBy) return;
  const count = c.submittedBy.count || 1;
  await incrementContracts(c.submittedBy.uid, count);

  const idx = currentContracts.findIndex(x => x.id === contractId);
  if (idx >= 0) {
    currentContracts[idx].status = "approved";
    currentContracts[idx].approvedAt = Date.now();
    saveDemoContracts();
    await renderAll();
  }

  const me = getCurrentUser();
  const users = await listUsers(true);
  const fullMe = users.find(u => u.uid === me.uid);
  const progressEl = document.getElementById("contractProgress");
  if (progressEl && fullMe) progressEl.innerHTML = renderProgress(fullMe);

  toast(`Одобрено: +${count} контрактов для ${c.submittedBy.login}`, "ok");
};

window.__contractReject = async function(contractId) {
  if (!confirm("Отклонить отчёт?")) return;
  const idx = currentContracts.findIndex(x => x.id === contractId);
  if (idx >= 0) {
    currentContracts[idx].status = "rejected";
    currentContracts[idx].rejectedAt = Date.now();
    saveDemoContracts();
    await renderAll();
  }
  toast("Отчёт отклонён", "warn");
};

window.__contractDelete = async function(contractId) {
  if (!confirm("Удалить контракт?")) return;
  currentContracts = currentContracts.filter(c => c.id !== contractId);
  saveDemoContracts();
  await renderAll();
  toast("Контракт удалён", "ok");
};

window.__openMedia = function(url, type) {
  openModal({
    title: type === "video" ? "ВИДЕО" : "ФОТО",
    html: type === "video"
      ? `<video src="${url}" controls style="width:100%;border-radius:8px;"></video>`
      : `<img src="${url}" style="width:100%;border-radius:8px;">`,
    confirmText: "ЗАКРЫТЬ",
    onConfirm: () => closeModal()
  });
};

export function destroyContracts() {}
