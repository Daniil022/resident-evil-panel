// js/core/dashboard.js
import { getCurrentUser } from "./state.js";
import { getRoleColor, getRoleName, getDivisionColor, getDivisionName } from "./colorize.js";
import { db } from "../firebase-init.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { addDashEvent, loadDashEvents } from "./dashboard-events.js";

let clockInterval = null;

export async function initDashboard() {
  const user = getCurrentUser();
  if (!user) return;

  const dashUser = document.getElementById("dashUser");
  const dashRole = document.getElementById("dashRole");
  const dashAvatar = document.getElementById("dashAvatar");

  if (dashUser) dashUser.textContent = user.login;

  if (dashRole) {
    const roleName = getRoleName(user.role);
    const divName = user.division ? getDivisionName(user.division) : null;
    const roleColor = getRoleColor(user.role);
    dashRole.textContent = divName ? (roleName + " · " + divName) : roleName;
    dashRole.className = "dash-role";
    dashRole.style.color = roleColor;
  }

  if (dashAvatar) {
    if (user.avatar) {
      dashAvatar.innerHTML = '<img src="' + user.avatar + '" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
      dashAvatar.style.padding = "0";
      dashAvatar.style.overflow = "hidden";
      dashAvatar.style.background = "transparent";
    } else {
      dashAvatar.textContent = user.login.charAt(0).toUpperCase();
    }
  }

  if (clockInterval) clearInterval(clockInterval);
  updateClock();
  clockInterval = setInterval(updateClock, 1000);

  await loadRealStats();
  await loadFeed();
}

// ==================== СТАТИСТИКА ====================
async function loadRealStats() {
  // ✅ Кэш на 5 минут (было 1 минута)
  const lastLoad = window.__lastStatsLoad || 0;
  if (Date.now() - lastLoad < 300000) return;
  window.__lastStatsLoad = Date.now();

  try {
    const [usersRes, presenceRes, contractsRes, alliesRes, resMsgs, alliesMsgs] = await Promise.all([
      getDocs(collection(db, "users")).catch(() => null),
      getDocs(collection(db, "presence")).catch(() => null),
      getDocs(collection(db, "contracts")).catch(() => null),
      getDocs(collection(db, "allies")).catch(() => null),
      getDocs(collection(db, "chats", "residents", "messages")).catch(() => null),
      getDocs(collection(db, "chats", "allies", "messages")).catch(() => null)
    ]);

    setCounter("dashMembers", usersRes ? usersRes.size : 0);

    let onlineCount = 0;
    if (presenceRes) {
      presenceRes.forEach(d => { if (d.data().online) onlineCount++; });
    }
    setCounter("dashOnline", onlineCount);

    let treasury = 0;
    let contractsCount = 0;
    if (contractsRes) {
      contractsCount = contractsRes.size;
      contractsRes.forEach(d => {
        const c = d.data();
        if (c.status === "approved") treasury += (c.reward || 0);
      });
    }
    setCounter("dashTreasury", treasury.toLocaleString("ru-RU"));
    setCounter("dashContracts", contractsCount);

    let wars = 0;
    if (alliesRes) {
      alliesRes.forEach(d => { if (d.data().status === "war") wars++; });
    }
    setCounter("dashWars", wars);

    // ✅ FIX: реальные сообщения из обоих чатов
    const totalMessages = (resMsgs?.size || 0) + (alliesMsgs?.size || 0);
    setCounter("dashMessages", totalMessages);

  } catch (e) {
    console.warn("Stats load failed, demo mode");
    loadDemoStats();
  }
}

function loadDemoStats() {
  try {
    const demoUsers = JSON.parse(localStorage.getItem("re_panel_demo_users") || "[]");
    setCounter("dashMembers", demoUsers.length);

    const demoContracts = JSON.parse(localStorage.getItem("re_demo_contracts_v2") || "[]");
    setCounter("dashContracts", demoContracts.length);
    const treasury = demoContracts
      .filter(c => c.status === "approved")
      .reduce((sum, c) => sum + (c.reward || 0), 0);
    setCounter("dashTreasury", treasury.toLocaleString("ru-RU"));

    const demoAllies = JSON.parse(localStorage.getItem("re_demo_allies") || "[]");
    setCounter("dashWars", demoAllies.filter(a => a.status === "war").length);

    setCounter("dashMessages", 0);
  } catch (e) {}
}

function setCounter(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ==================== ЧАСЫ ====================
function updateClock() {
  const el = document.getElementById("dashClock");
  if (!el) return;
  const d = new Date();
  el.textContent =
    String(d.getHours()).padStart(2, "0") + ":" +
    String(d.getMinutes()).padStart(2, "0") + ":" +
    String(d.getSeconds()).padStart(2, "0");
}

// ==================== ЛЕНТА СОБЫТИЙ ====================
async function loadFeed() {
  const feed = document.getElementById("dashFeed");
  if (!feed) return;

  feed.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;">Загрузка...</div>';

  let events = [];
  try {
    events = await loadDashEvents(30);
  } catch (e) {
    events = [];
  }

  if (events.length === 0) {
    feed.innerHTML = '<div class="dash-event" style="opacity: 0.5;">' +
      '<span class="dash-event-icon">⏳</span>' +
      '<span class="dash-event-time">—</span>' +
      '<span class="dash-event-text">Событий пока нет</span>' +
      '</div>';
    return;
  }

  feed.innerHTML = events.map(ev => {
    const time = formatEventTime(ev.at);
    return '<div class="dash-event">' +
      '<span class="dash-event-icon">' + (ev.icon || "•") + '</span>' +
      '<span class="dash-event-time">' + time + '</span>' +
      '<span class="dash-event-text">' + escapeHtml(ev.text || "") + '</span>' +
      '</div>';
  }).join("");
}

function formatEventTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;

  if (diff < 60 * 1000) return "только что";
  if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + " мин назад";

  const sameDay = d.getFullYear() === now.getFullYear() &&
                  d.getMonth() === now.getMonth() &&
                  d.getDate() === now.getDate();

  if (sameDay) {
    return String(d.getHours()).padStart(2, "0") + ":" +
           String(d.getMinutes()).padStart(2, "0");
  }

  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) + " " +
         String(d.getHours()).padStart(2, "0") + ":" +
         String(d.getMinutes()).padStart(2, "0");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ==================== ЭКСПОРТ ДЛЯ ДРУГИХ МОДУЛЕЙ ====================
export { addDashEvent };

// Обновить ленту при переключении на дашборд
window.addEventListener("tabChange", (e) => {
  if (e.detail.tab === "dashboard") {
    loadFeed().catch(() => {});
  }
});
