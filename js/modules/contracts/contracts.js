// js/modules/contracts/contracts.js
import { db } from "../../firebase-init.js";
import {
  collection, addDoc, getDocs, query, orderBy, doc, updateDoc, deleteDoc, getDoc, setDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getCurrentUser } from "../../core/state.js";
import { listUsers, incrementContracts } from "../../core/auth.js";
import { toast, openModal, closeModal, escapeHtml, formatDate } from "../../core/utils.js";
import { playSound } from "../../core/sounds.js";
import { addDashEvent } from "../../core/dashboard-events.js";
import { uploadMedia } from "./contracts-upload.js";
import { getNextReward, getEarnedRewards } from "./contracts-rewards.js";

const SETTINGS_KEY = "re_contracts_settings";
const DEMO_KEY = "re_demo_contracts_v2";

let currentContracts = [];
let demoMode = false;
let unsub = null;
let settings = { resetHour: 0, resetMinute: 0 };
let resetTimer = null;

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
export async function initContracts() {
  const grid = document.getElementById("contractsGrid");
  if (!grid) return;

  if (unsub) {
    try { unsub(); } catch (e) {}
    unsub = null;
  }

  loadSettings();
  scheduleReset();

  const me = getCurrentUser();
  const isAdmin = me && ["emperor", "lord"].includes(me.role);

  const toolbar = document.querySelector("#contracts .contracts-head");
  if (toolbar && !toolbar.__bound) {
    toolbar.__bound = true;
    toolbar.innerHTML = '<h2>Контракты семьи</h2>' +
      (isAdmin ? '<button class="btn" id="createContractBtn">+ Создать контракт</button>' +
                  '<button class="btn secondary" id="contractsSettingsBtn" style="margin-left:8px;">⚙ Настройки</button>' : '');
    const cb = document.getElementById("createContractBtn");
    if (cb) cb.addEventListener("click", openCreateContract);
    const sb = document.getElementById("contractsSettingsBtn");
    if (sb) sb.addEventListener("click", openSettingsModal);
  }

  const progressEl = document.getElementById("contractProgress");
  if (progressEl && me) {
    const users = await listUsers();
    const fullMe = users.find(u => u.uid === me.uid);
    progressEl.innerHTML = renderProgress(fullMe || me);
  }

  try {
    const q = query(collection(db, "contracts"), orderBy("createdAt", "desc"));
    unsub = onSnapshot(q, (snap) => {
      currentContracts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAll();
    }, (err) => {
      console.warn("Contracts offline:", err);
      enableDemo();
    });
  } catch (e) {
    enableDemo();
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) settings = JSON.parse(raw);
  } catch (e) {}
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function enableDemo() {
  demoMode = true;
  try {
    currentContracts = JSON.parse(localStorage.getItem(DEMO_KEY) || "[]");
  } catch (e) {
    currentContracts = [];
  }
  renderAll();
}

function saveDemo() {
  localStorage.setItem(DEMO_KEY, JSON.stringify(currentContracts));
}

// ==================== АВТООБНОВЛЕНИЕ ====================
function scheduleReset() {
  if (resetTimer) clearTimeout(resetTimer);

  const now = new Date();
  const next = new Date();
  next.setHours(settings.resetHour, settings.resetMinute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  const msUntil = next - now;
  resetTimer = setTimeout(async () => {
    await resetCompletedContracts();
    scheduleReset();
  }, msUntil);
}

async function resetCompletedContracts() {
  const toReset = currentContracts.filter(c => c.status === "approved" || c.status === "review");

  for (const c of toReset) {
    try {
      if (!demoMode) {
        await updateDoc(doc(db, "contracts", c.id), {
          status: "open",
          submittedBy: null,
          media: [],
          resetAt: Date.now()
        });
      } else {
        const idx = currentContracts.findIndex(x => x.id === c.id);
        if (idx >= 0) {
          currentContracts[idx].status = "open";
          currentContracts[idx].submittedBy = null;
          currentContracts[idx].media = [];
          currentContracts[idx].resetAt = Date.now();
        }
      }
    } catch (e) {}
  }

  if (demoMode) saveDemo();
  if (toReset.length > 0) {
    addDashEvent("🔄", "Контракты обновлены (" + toReset.length + " шт.)", { type: "contract" }).catch(() => {});
  }
  toast("Контракты обновлены", "ok");
}

// ==================== НАСТРОЙКИ ====================
function openSettingsModal() {
  const me = getCurrentUser();
  if (!me || !["emperor", "lord"].includes(me.role)) {
    toast("Только лидер и зам могут настраивать", "warn");
    return;
  }

  openModal({
    title: "⚙ НАСТРОЙКИ КОНТРАКТОВ",
    html: '<div class="form-grid">' +
      '<div class="form-field">' +
        '<label>Час автообновления</label>' +
        '<input type="number" id="setHour" value="' + settings.resetHour + '" min="0" max="23">' +
        '<div class="form-hint">0-23 (0 = полночь)</div>' +
      '</div>' +
      '<div class="form-field">' +
        '<label>Минута</label>' +
        '<input type="number" id="setMinute" value="' + settings.resetMinute + '" min="0" max="59">' +
      '</div>' +
      '</div>' +
      '<p style="color:var(--muted);font-size:12px;margin-top:8px;">Каждый день в это время все выполненные и проверяемые контракты вернутся в статус «Открыт»</p>' +
      '<div id="setError" style="color:var(--red);font-size:12px;display:none;"></div>',
    confirmText: "СОХРАНИТЬ",
    onConfirm: () => {
      const h = parseInt(document.getElementById("setHour").value) || 0;
      const m = parseInt(document.getElementById("setMinute").value) || 0;
      const err = document.getElementById("setError");

      if (h < 0 || h > 23 || m < 0 || m > 59) {
        err.textContent = "Неверное время";
        err.style.display = "block";
        return;
      }

      settings.resetHour = h;
      settings.resetMinute = m;
      saveSettings();
      scheduleReset();
      toast("Настройки сохранены", "ok");
      closeModal();
    }
  });
}

// ==================== ОТРИСОВКА ====================
function renderProgress(user) {
  const done = user.contracts || 0;
  const next = getNextReward(done);
  const earned = getEarnedRewards(done);

  return '<div class="contract-progress">' +
    '<div class="contract-progress-head">' +
      '<div>' +
        '<div class="contract-progress-title">Твой прогресс контрактов</div>' +
        '<div class="contract-progress-sub">' + done + ' выполнено</div>' +
      '</div>' +
      (next.done ? '<div class="contract-progress-max">🏆 МАКСИМУМ</div>'
                 : '<div class="contract-progress-next">До «' + next.label + '»: ' + (next.target - done) + ' шт.</div>') +
    '</div>' +
    (!next.done ? '<div class="bar"><span style="width:' + next.progress + '%"></span></div>' +
                   '<div class="contract-progress-hint">Награда: ' + next.reward + '</div>' : '') +
    (earned.length ? '<div class="contract-earned">' + earned.map(e => '<span class="contract-badge">🏅 ' + e.label + ' — ' + e.reward + '</span>').join("") + '</div>' : '') +
  '</div>';
}

async function renderAll() {
  const grid = document.getElementById("contractsGrid");
  if (!grid) return;

  if (currentContracts.length === 0) {
    grid.innerHTML = '<div class="contracts-empty" style="grid-column:1/-1;">' +
      '<div class="contracts-empty-icon">📜</div>' +
      '<div class="contracts-empty-text">Контрактов пока нет</div>' +
      '<div class="contracts-empty-sub">Лидер или зам может создать первый контракт</div>' +
      '</div>';
    return;
  }

  const users = await listUsers();
  const me = getCurrentUser();

  grid.innerHTML = currentContracts.map(c => renderCard(c, users, me)).join("");
}

function renderCard(c, users, me) {
  const author = users.find(u => u.uid === c.authorId);
  const isAdmin = me && ["emperor", "lord"].includes(me.role);
  const isApproved = c.status === "approved";

  const statusMap = {
    open: { text: "Открыт", cls: "green" },
    review: { text: "На проверке", cls: "gold" },
    approved: { text: "ВЫПОЛНЕНО", cls: "blue" },
    rejected: { text: "Отклонён", cls: "red" }
  };
  const status = statusMap[c.status] || statusMap.open;

  return '<div class="card contract-card' + (isApproved ? ' contract-approved' : '') + '" data-id="' + c.id + '">' +
    (isApproved ? '<div class="contract-approved-stamp">ВЫПОЛНЕНО</div>' : '') +
    '<div class="contract-head">' +
      '<div>' +
        '<div class="name">' + escapeHtml(c.title) + '</div>' +
        '<div class="role">Награда: <span class="val">' + c.reward + ' ₽</span></div>' +
      '</div>' +
      '<span class="contract-status ' + status.cls + '">' + status.text + '</span>' +
    '</div>' +
    '<div class="stat">' + escapeHtml(c.description || "Без описания") + '</div>' +
    '<div class="contract-meta">' +
      '<span>👤 Автор: <b>' + escapeHtml(author ? author.login : "—") + '</b></span>' +
      '<span>📅 ' + formatDate(c.createdAt, "short") + '</span>' +
    '</div>' +
    (c.submittedBy ? '<div class="contract-meta" style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px;">' +
      '<span>📤 Сдал: <b>' + escapeHtml(c.submittedBy.login) + '</b></span>' +
      '<span>Кол-во: <b>' + c.submittedBy.count + '</b></span>' +
    '</div>' : '') +
    (c.media && c.media.length ? '<div class="contract-media">' +
      c.media.map(m => m.type === "image"
        ? '<img src="' + m.url + '" onclick="window.__openMedia(\'' + m.url + '\',\'image\')">'
        : '<div style="padding:8px;background:#000;color:#0f0;font-size:11px;border-radius:6px;">📹 ' + escapeHtml(m.name) + '</div>').join("") +
    '</div>' : '') +
    (c.status === "open" ? '<button class="btn small" onclick="window.__contractSubmit(\'' + c.id + '\')">Сдать отчёт</button>' : '') +
    (c.status === "review" && isAdmin ? '<div class="contract-review-actions">' +
      '<button class="btn small" onclick="window.__contractApprove(\'' + c.id + '\')">✓ Одобрить</button>' +
      '<button class="btn small secondary" onclick="window.__contractReject(\'' + c.id + '\')">✕ Отклонить</button>' +
    '</div>' : '') +
    (isAdmin && c.status !== "approved" ? '<div style="display:flex;gap:6px;margin-top:8px;">' +
      '<button class="btn small secondary" onclick="window.__contractEdit(\'' + c.id + '\')">✏️ Редактировать</button>' +
      '<button class="btn small danger" onclick="window.__contractDelete(\'' + c.id + '\')">🗑 Удалить</button>' +
    '</div>' : '') +
  '</div>';
}

// ==================== СОЗДАНИЕ ====================
export function openCreateContract() {
  const me = getCurrentUser();
  if (!me || !["emperor", "lord"].includes(me.role)) {
    toast("Только Император и Лорд Тьмы могут создавать", "warn");
    return;
  }

  openModal({
    title: "СОЗДАТЬ КОНТРАКТ",
    html: '<div class="form-grid">' +
      '<div class="form-field"><label>Название</label><input type="text" id="cTitle" placeholder="Зачистка нефтезавода" autocomplete="off"></div>' +
      '<div class="form-field"><label>Награда, ₽</label><input type="number" id="cReward" placeholder="50000" min="0"></div>' +
      '<div class="form-field" style="grid-column:1/-1;"><label>Описание</label><textarea id="cDesc" placeholder="Что нужно сделать..."></textarea></div>' +
      '</div>' +
      '<div id="cError" style="color:var(--red);font-size:12px;display:none;"></div>',
    confirmText: "СОЗДАТЬ",
    onConfirm: async () => {
      const title = document.getElementById("cTitle").value.trim();
      const reward = parseInt(document.getElementById("cReward").value) || 0;
      const description = document.getElementById("cDesc").value.trim();
      const err = document.getElementById("cError");

      if (!title) { err.textContent = "Введите название"; err.style.display = "block"; return; }

      const contract = {
        title: title,
        reward: reward,
        description: description,
        authorId: me.uid,
        authorLogin: me.login,
        status: "open",
        media: [],
        submittedBy: null,
        createdAt: Date.now()
      };

      try {
        if (demoMode) throw new Error("demo");
        await addDoc(collection(db, "contracts"), contract);
        playSound("contract");
        addDashEvent("📜", me.login + " создал контракт: " + title, { type: "contract" }).catch(() => {});
        toast("Контракт создан", "ok");
        closeModal();
      } catch (e) {
        contract.id = "demo-c-" + Date.now();
        currentContracts.unshift(contract);
        saveDemo();
        renderAll();
        playSound("contract");
        addDashEvent("📜", me.login + " создал контракт: " + title, { type: "contract" }).catch(() => {});
        toast("Контракт создан", "ok");
        closeModal();
      }
    }
  });
  setTimeout(() => document.getElementById("cTitle")?.focus(), 80);
}

// ==================== РЕДАКТИРОВАНИЕ ====================
window.__contractEdit = function(contractId) {
  const c = currentContracts.find(x => x.id === contractId);
  if (!c) return;
  const me = getCurrentUser();
  if (!me || !["emperor", "lord"].includes(me.role)) return toast("Нет прав", "warn");

  openModal({
    title: "РЕДАКТИРОВАТЬ КОНТРАКТ",
    html: '<div class="form-grid">' +
      '<div class="form-field"><label>Название</label><input type="text" id="ceTitle" value="' + escapeHtml(c.title) + '"></div>' +
      '<div class="form-field"><label>Награда, ₽</label><input type="number" id="ceReward" value="' + c.reward + '" min="0"></div>' +
      '<div class="form-field" style="grid-column:1/-1;"><label>Описание</label><textarea id="ceDesc">' + escapeHtml(c.description || "") + '</textarea></div>' +
      '<div class="form-field"><label>Статус</label><select id="ceStatus" class="role-select">' +
        '<option value="open"' + (c.status === "open" ? " selected" : "") + '>Открыт</option>' +
        '<option value="review"' + (c.status === "review" ? " selected" : "") + '>На проверке</option>' +
        '<option value="approved"' + (c.status === "approved" ? " selected" : "") + '>Выполнен</option>' +
        '<option value="rejected"' + (c.status === "rejected" ? " selected" : "") + '>Отклонён</option>' +
      '</select></div>' +
      '</div>' +
      '<div id="ceError" style="color:var(--red);font-size:12px;display:none;"></div>',
    confirmText: "СОХРАНИТЬ",
    onConfirm: async () => {
      const title = document.getElementById("ceTitle").value.trim();
      const reward = parseInt(document.getElementById("ceReward").value) || 0;
      const description = document.getElementById("ceDesc").value.trim();
      const status = document.getElementById("ceStatus").value;
      const err = document.getElementById("ceError");
      if (!title) { err.textContent = "Введите название"; err.style.display = "block"; return; }

      try {
        if (!demoMode) {
          await updateDoc(doc(db, "contracts", contractId), {
            title, reward, description, status, editedAt: Date.now()
          });
        }
      } catch (e) {}

      const idx = currentContracts.findIndex(x => x.id === contractId);
      if (idx >= 0) {
        currentContracts[idx].title = title;
        currentContracts[idx].reward = reward;
        currentContracts[idx].description = description;
        currentContracts[idx].status = status;
        currentContracts[idx].editedAt = Date.now();
        if (demoMode) saveDemo();
        renderAll();
      }
      toast("Контракт обновлён", "ok");
      closeModal();
    }
  });
};

// ==================== ОТЧЁТ ====================
window.__contractSubmit = function(contractId) {
  const c = currentContracts.find(x => x.id === contractId);
  if (!c) return;

  openModal({
    title: "СДАТЬ ОТЧЁТ",
    html: '<div class="form-grid">' +
      '<div class="form-field"><label>Твой ник</label><input type="text" id="rNick" value="' + getCurrentUser().login + '" readonly></div>' +
      '<div class="form-field"><label>Сколько контрактов выполнил</label><input type="number" id="rCount" value="1" min="1" max="100"></div>' +
      '<div class="form-field" style="grid-column:1/-1;"><label>Фото/видео доказательство</label><input type="file" id="rMedia" accept="image/*,video/*" multiple>' +
      '<div class="form-hint">До 50 МБ. JPG/PNG/WEBP/GIF или MP4/WEBM/MOV.</div></div>' +
      '<div class="form-field" style="grid-column:1/-1;"><label>Комментарий</label><textarea id="rComment" placeholder="Кратко о выполнении..."></textarea></div>' +
      '</div>' +
      '<div id="rError" style="color:var(--red);font-size:12px;display:none;"></div>',
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
      err.style.color = "var(--accent)";

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

      const update = {
        status: "review",
        submittedBy: { uid: getCurrentUser().uid, login: nick, count: count, comment: comment },
        media: media,
        submittedAt: Date.now()
      };

      try {
        if (!demoMode) {
          await updateDoc(doc(db, "contracts", contractId), update);
        }
      } catch (e) {}

      const idx = currentContracts.findIndex(x => x.id === contractId);
      if (idx >= 0) {
        Object.assign(currentContracts[idx], update);
        if (demoMode) saveDemo();
        renderAll();
      }
      playSound("contract");
      addDashEvent("📤", nick + " сдал отчёт по контракту: " + c.title, { type: "contract" }).catch(() => {});
      toast("Отчёт отправлен на проверку", "ok");
      closeModal();
    }
  });
};

// ==================== ОДОБРЕНИЕ ====================
window.__contractApprove = async function(contractId) {
  const me = getCurrentUser();
  if (!me || !["emperor", "lord"].includes(me.role)) {
    toast("Только лидер и зам могут одобрять", "warn");
    return;
  }

  const c = currentContracts.find(x => x.id === contractId);
  if (!c || !c.submittedBy) return;
  const count = c.submittedBy.count || 1;
  await incrementContracts(c.submittedBy.uid, count);

  const update = { status: "approved", approvedAt: Date.now() };

  try {
    if (!demoMode) {
      await updateDoc(doc(db, "contracts", contractId), update);
    }
  } catch (e) {}

  const idx = currentContracts.findIndex(x => x.id === contractId);
  if (idx >= 0) {
    Object.assign(currentContracts[idx], update);
    if (demoMode) saveDemo();
    renderAll();
  }

  const users = await listUsers(true);
  const fullMe = users.find(u => u.uid === me.uid);
  const progressEl = document.getElementById("contractProgress");
  if (progressEl && fullMe) progressEl.innerHTML = renderProgress(fullMe);

  playSound("contract");
  addDashEvent("✅", me.login + " одобрил контракт " + c.submittedBy.login + " (+" + count + ")", { type: "contract" }).catch(() => {});
  toast("Одобрено: +" + count + " контрактов для " + c.submittedBy.login, "ok");
};

window.__contractReject = async function(contractId) {
  const me = getCurrentUser();
  if (!me || !["emperor", "lord"].includes(me.role)) {
    toast("Только лидер и зам могут отклонять", "warn");
    return;
  }

  if (!confirm("Отклонить отчёт?")) return;

  const update = { status: "rejected", rejectedAt: Date.now() };

  try {
    if (!demoMode) {
      await updateDoc(doc(db, "contracts", contractId), update);
    }
  } catch (e) {}

  const idx = currentContracts.findIndex(x => x.id === contractId);
  if (idx >= 0) {
    Object.assign(currentContracts[idx], update);
    if (demoMode) saveDemo();
    renderAll();
  }

  const c = currentContracts.find(x => x.id === contractId);
  if (c) {
    addDashEvent("❌", me.login + " отклонил контракт " + (c.submittedBy?.login || "—"), { type: "contract" }).catch(() => {});
  }
  toast("Отчёт отклонён", "warn");
};

window.__contractDelete = async function(contractId) {
  const me = getCurrentUser();
  if (!me || !["emperor", "lord"].includes(me.role)) {
    toast("Нет прав", "warn");
    return;
  }

  if (!confirm("Удалить контракт?")) return;

  try {
    if (!demoMode) {
      await deleteDoc(doc(db, "contracts", contractId));
    }
  } catch (e) {}

  const c = currentContracts.find(x => x.id === contractId);
  currentContracts = currentContracts.filter(c => c.id !== contractId);
  if (demoMode) saveDemo();
  renderAll();

  if (c) {
    addDashEvent("🗑", me.login + " удалил контракт: " + c.title, { type: "contract" }).catch(() => {});
  }
  toast("Контракт удалён", "ok");
};

window.__openMedia = function(url, type) {
  openModal({
    title: type === "video" ? "ВИДЕО" : "ФОТО",
    html: type === "video"
      ? '<video src="' + url + '" controls style="width:100%;border-radius:8px;"></video>'
      : '<img src="' + url + '" style="width:100%;border-radius:8px;">',
    confirmText: "ЗАКРЫТЬ",
    onConfirm: () => closeModal()
  });
};

export function destroyContracts() {
  if (unsub) unsub();
  if (resetTimer) clearTimeout(resetTimer);
}
