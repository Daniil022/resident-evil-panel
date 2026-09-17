// js/modules/contracts/contracts-render.js
import { getNextReward, getEarnedRewards } from "./contracts-rewards.js";

export function renderContractCard(c, users, currentUser) {
  const author = users.find(u => u.uid === c.authorId);
  const isAdmin = ["Император", "Лорд Тьмы"].includes(currentUser.role);

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
          ${c.media.slice(0, 3).map(m => `
            ${m.type === "image"
              ? `<img src="${m.url}" alt="${m.name}" onclick="window.__openMedia('${m.url}','image')">`
              : `<video src="${m.url}" onclick="window.__openMedia('${m.url}','video')"></video>`}
          `).join("")}
        </div>
      ` : ""}

      ${c.status === "open" ? `
        <button class="btn small" onclick="window.__contractSubmit('${c.id}')">
          Сдать отчёт
        </button>
      ` : ""}

      ${c.status === "review" && isAdmin ? `
        <div class="contract-review-actions">
          <button class="btn small" onclick="window.__contractApprove('${c.id}')">✓ Одобрить</button>
          <button class="btn small secondary" onclick="window.__contractReject('${c.id}')">✕ Отклонить</button>
        </div>
      ` : ""}
    </div>
  `;
}

export function renderMyProgress(user) {
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
        ${next.done
          ? `<div class="contract-progress-max">🏆 МАКСИМУМ</div>`
          : `<div class="contract-progress-next">До «${next.label}»: ${next.target - done} шт.</div>`}
      </div>

      ${!next.done ? `
        <div class="bar">
          <span style="width:${next.progress}%"></span>
        </div>
        <div class="contract-progress-hint">Награда: ${next.reward}</div>
      ` : ""}

      ${earned.length ? `
        <div class="contract-earned">
          ${earned.map(e => `<span class="contract-badge">🏅 ${e.label} — ${e.reward}</span>`).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
