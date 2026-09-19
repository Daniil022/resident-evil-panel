// js/admin/admin-nick-applications.js
import { db } from "../firebase-init.js";
import {
  collection, getDocs, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { toast } from "../core/utils.js";
import { playSound } from "../core/sounds.js";
import { escapeHtml, formatDate } from "../modules/gestion.js";

const DEMO_NICK_APPS = "re_demo_nick_applications";

export async function initAdminNickApplications() {
  const container = document.getElementById("nickApplicationsList");
  if (!container) return;

  let apps = [];

  try {
    const snap = await getDocs(collection(db, "applications_nicks"));
    apps = snap.docs.map(d => ({ id: d.id, ...d.data(), source: "firebase" }));
  } catch (e) {
    apps = getDemoApps();
  }

  if (apps.length === 0) apps = getDemoApps();

  apps.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (apps.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--muted);padding:40px;">
      Заявок на ники пока нет
    </div>`;
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
        <div class="stat">🎙 ГС: <b>${a.voice === "yes" ? "Да" : "Нет"}</b></div>
        <div class="stat">💬 О себе: ${escapeHtml(a.about)}</div>
        <div class="stat">🎯 Планы: ${escapeHtml(a.plans)}</div>
        <div class="contract-meta">
          <span>📅 ${formatDate(a.createdAt)}</span>
          <span>UID: <b>${escapeHtml(a.uid || "—")}</b></span>
        </div>
        ${a.status === "pending" ? `
          <div class="contract-review-actions" style="margin-top:12px;">
            <button class="btn small" onclick="window.__nickApprove('${a.id}')">✓ Одобрить</button>
            <button class="btn small secondary" onclick="window.__nickReject('${a.id}')">✕ Отклонить</button>
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

function getDemoApps() {
  try { return JSON.parse(localStorage.getItem(DEMO_NICK_APPS) || "[]"); }
  catch { return []; }
}

// ==================== ОДОБРЕНИЕ ====================
window.__nickApprove = async function(id) {
  if (!confirm("Одобрить заявку? Данные появятся в реестре ников.")) return;

  const app = await getAppById(id);
  if (!app) return;

  // Обновляем юзера: сохраняем age, voice, about, plans
  try {
    const userRef = doc(db, "users", app.uid);
    await updateDoc(userRef, {
      age: app.age,
      voice: app.voice,
      about: app.about,
      plans: app.plans,
      nickApprovedAt: Date.now()
    });
  } catch (e) {
    // демо
    const demoUsers = JSON.parse(localStorage.getItem("re_panel_demo_users") || "[]");
    const idx = demoUsers.findIndex(u => u.uid === app.uid);
    if (idx >= 0) {
      demoUsers[idx].age = app.age;
      demoUsers[idx].voice = app.voice;
      demoUsers[idx].about = app.about;
      demoUsers[idx].plans = app.plans;
      demoUsers[idx].nickApprovedAt = Date.now();
      localStorage.setItem("re_panel_demo_users", JSON.stringify(demoUsers));
    }
  }

  // Обновляем статус заявки
  try {
    await updateDoc(doc(db, "applications_nicks", id), {
      status: "approved",
      approvedAt: Date.now()
    });
  } catch (e) {
    updateDemoAppStatus(id, "approved");
  }

  playSound("application");
  toast("Заявка одобрена", "ok");
  await initAdminNickApplications();
};

window.__nickReject = async function(id) {
  const reason = prompt("Причина отказа (опционально):", "");
  if (reason === null) return;

  try {
    await updateDoc(doc(db, "applications_nicks", id), {
      status: "rejected",
      rejectedAt: Date.now(),
      reason: reason.trim()
    });
  } catch (e) {
    updateDemoAppStatus(id, "rejected", reason);
  }

  playSound("application");
  toast("Заявка отклонена", "warn");
  await initAdminNickApplications();
};

async function getAppById(id) {
  try {
    const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await getDoc(doc(db, "applications_nicks", id));
    if (snap.exists()) return { id, ...snap.data() };
  } catch (e) {}
  return getDemoApps().find(a => a.id === id);
}

function updateDemoAppStatus(id, status, reason = "") {
  const demo = getDemoApps();
  const idx = demo.findIndex(a => a.id === id);
  if (idx >= 0) {
    demo[idx].status = status;
    if (status === "approved") demo[idx].approvedAt = Date.now();
    if (status === "rejected") {
      demo[idx].rejectedAt = Date.now();
      demo[idx].reason = reason;
    }
    localStorage.setItem(DEMO_NICK_APPS, JSON.stringify(demo));
  }
}
