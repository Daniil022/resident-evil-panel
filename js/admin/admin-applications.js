// js/admin/admin-applications.js
import { db } from "../firebase-init.js";
import {
  collection, getDocs, doc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { toast } from "../core/utils.js";
import { escapeHtml, formatDate } from "../modules/gestion.js";
import { setApplicationsCache } from "../modules/accolades.js";

export async function initAdminApplications() {
  const container = document.getElementById("applicationsList");
  if (!container) return;

  let apps = [];

  try {
    const snap = await getDocs(collection(db, "applications"));
    apps = snap.docs.map(d => ({ id: d.id, ...d.data(), source: "firebase" }));
  } catch (e) {
    apps = getDemoApplications();
  }

  if (apps.length === 0) apps = getDemoApplications();

  apps.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  setApplicationsCache(apps);

  if (apps.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--muted);padding:40px;">Заявок пока нет</div>`;
    return;
  }

  container.innerHTML = apps.map(a => {
    const statusMap = {
      pending:  { text: "На рассмотрении", cls: "gold" },
      approved: { text: "Одобрено",        cls: "green" },
      rejected: { text: "Отказано",        cls: "red" }
    };
    const st = statusMap[a.status] || statusMap.pending;

    return `
      <div class="card" style="border-left-color:${a.status === "approved" ? "var(--green)" : a.status === "rejected" ? "var(--red)" : "var(--gold)"};">
        <div class="contract-head">
          <div>
            <div class="name">👤 ${escapeHtml(a.nick)}</div>
            <div class="role">Возраст: <span class="val">${a.age}</span></div>
          </div>
          <span class="contract-status ${st.cls}">${st.text}</span>
        </div>
        <div class="stat">🎙 Голосовой чат: <b>${a.voice === "yes" ? "Да" : "Нет"}</b></div>
        <div class="stat">📅 В симье: <b>${escapeHtml(a.period)}</b></div>
        <div class="stat">⚖ Готов к наказанию: <b>${a.ready === "yes" ? "Да" : "Нет"}</b></div>
        ${a.extra ? `<div class="stat">💬 ${escapeHtml(a.extra)}</div>` : ""}
        <div class="contract-meta">
          <span>📅 ${formatDate(a.createdAt)}</span>
          <span>UID: <b>${escapeHtml(a.uid || "—")}</b></span>
        </div>
        ${a.status === "pending" ? `
          <div class="contract-review-actions" style="margin-top:12px;">
            <button class="btn small" onclick="window.__appApprove('${a.id}')">✓ Одобрить</button>
            <button class="btn small secondary" onclick="window.__appReject('${a.id}')">✕ Отказать</button>
          </div>
        ` : a.status === "approved" ? `
          <div style="margin-top:12px;color:var(--green);font-size:12px;">✓ Одобрено ${formatDate(a.approvedAt)}</div>
        ` : `
          <div style="margin-top:12px;color:var(--red);font-size:12px;">✕ Отказано ${formatDate(a.rejectedAt)}${a.reason ? ` — ${escapeHtml(a.reason)}` : ""}</div>
        `}
      </div>
    `;
  }).join("");
}

function getDemoApplications() {
  try { return JSON.parse(localStorage.getItem("re_demo_applications") || "[]"); }
  catch { return []; }
}

window.__appApprove = async function(id) {
  if (!confirm("Одобрить заявку? Участник получит 2-й ранг.")) return;
  try {
    await updateDoc(doc(db, "applications", id), {
      status: "approved",
      approvedAt: Date.now()
    });
  } catch (e) {
    const demo = getDemoApplications();
    const idx = demo.findIndex(a => a.id === id);
    if (idx >= 0) {
      demo[idx].status = "approved";
      demo[idx].approvedAt = Date.now();
      localStorage.setItem("re_demo_applications", JSON.stringify(demo));
    }
  }
  toast("Заявка одобрена", "ok");
  await initAdminApplications();
};

window.__appReject = async function(id) {
  const reason = prompt("Причина отказа (опционально):", "");
  if (reason === null) return;
  try {
    await updateDoc(doc(db, "applications", id), {
      status: "rejected",
      rejectedAt: Date.now(),
      reason: reason.trim()
    });
  } catch (e) {
    const demo = getDemoApplications();
    const idx = demo.findIndex(a => a.id === id);
    if (idx >= 0) {
      demo[idx].status = "rejected";
      demo[idx].rejectedAt = Date.now();
      demo[idx].reason = reason.trim();
      localStorage.setItem("re_demo_applications", JSON.stringify(demo));
    }
  }
  toast("Заявка отклонена", "warn");
  await initAdminApplications();
};
