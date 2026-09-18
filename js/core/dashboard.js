// js/core/dashboard.js
import { getCurrentUser } from "./state.js";
import { getRoleColor, getRoleName, getDivisionColor, getDivisionName } from "./colorize.js";
import { db } from "../firebase-init.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

  loadRealStats();
}

async function loadRealStats() {
  // Кэш 60 секунд
  const lastLoad = window.__lastStatsLoad || 0;
  if (Date.now() - lastLoad < 60000) return;
  window.__lastStatsLoad = Date.now();

  try {
    // ПАРАЛЛЕЛЬНЫЕ запросы — все 4 сразу
    const [usersRes, presenceRes, contractsRes, alliesRes] = await Promise.all([
      getDocs(collection(db, "users")).catch(() => null),
      getDocs(collection(db, "presence")).catch(() => null),
      getDocs(collection(db, "contracts")).catch(() => null),
      getDocs(collection(db, "allies")).catch(() => null)
    ]);

    // Участники
    setCounter("dashMembers", usersRes ? usersRes.size : 0);

    // Онлайн
    let onlineCount = 0;
    if (presenceRes) {
      presenceRes.forEach(d => { if (d.data().online) onlineCount++; });
    }
    setCounter("dashOnline", onlineCount);

    // Казна + контракты
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

    // Войны
    let wars = 0;
    if (alliesRes) {
      alliesRes.forEach(d => { if (d.data().status === "war") wars++; });
    }
    setCounter("dashWars", wars);

    // Сообщения — отдельно (не критично)
    getDocs(collection(db, "chats", "main", "messages"))
      .then(snap => setCounter("dashMessages", snap.size))
      .catch(() => setCounter("dashMessages", 0));

  } catch (e) {
    console.warn("Stats load failed, demo mode");
    loadDemoStats();
  }
}

function loadDemoStats() {
  try {
    const demoUsers = JSON.parse(localStorage.getItem("re_panel_demo_users") || "[]");
    setCounter("dashMembers", demoUsers.length);

    const demoContracts = JSON.parse(localStorage.getItem("re_demo_contracts") || "[]");
    setCounter("dashContracts", demoContracts.length);
    const treasury = demoContracts
      .filter(c => c.status === "approved")
      .reduce((sum, c) => sum + (c.reward || 0), 0);
    setCounter("dashTreasury", treasury.toLocaleString("ru-RU"));

    const demoAllies = JSON.parse(localStorage.getItem("re_demo_allies") || "[]");
    setCounter("dashWars", demoAllies.filter(a => a.status === "war").length);
  } catch (e) {}
}

function setCounter(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function updateClock() {
  const el = document.getElementById("dashClock");
  if (!el) return;
  const d = new Date();
  el.textContent =
    String(d.getHours()).padStart(2, "0") + ":" +
    String(d.getMinutes()).padStart(2, "0") + ":" +
    String(d.getSeconds()).padStart(2, "0");
}

export function addDashEvent(icon, text) {
  const feed = document.getElementById("dashFeed");
  if (!feed) return;
  const placeholder = feed.querySelector(".dash-event[style*='opacity']");
  if (placeholder) feed.innerHTML = "";
  const now = new Date();
  const time = String(now.getHours()).padStart(2, "0") + ":" +
               String(now.getMinutes()).padStart(2, "0");
  const event = document.createElement("div");
  event.className = "dash-event";
  event.innerHTML = '<span class="dash-event-icon">' + icon + '</span>' +
    '<span class="dash-event-time">' + time + '</span>' +
    '<span class="dash-event-text">' + text + '</span>';
  feed.insertBefore(event, feed.firstChild);
  while (feed.children.length > 30) feed.removeChild(feed.lastChild);
}
