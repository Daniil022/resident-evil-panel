// js/core/dashboard.js
import { getCurrentUser } from "./state.js";
import { getRoleColor, getRoleName, getDivisionColor, getDivisionName } from "./colorize.js";
import { db } from "../firebase-init.js";
import {
  collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
    dashRole.textContent = divName ? `${roleName} · ${divName}` : roleName;
    dashRole.className = "dash-role";
    dashRole.style.color = roleColor;
  }

  if (dashAvatar) {
    if (user.avatar) {
      dashAvatar.innerHTML = `<img src="${user.avatar}" alt="avatar">`;
      dashAvatar.style.background = "transparent";
      dashAvatar.style.boxShadow = "0 0 30px rgba(0,200,212,0.4)";
    } else {
      dashAvatar.textContent = user.login.charAt(0).toUpperCase();
    }
  }

  if (clockInterval) clearInterval(clockInterval);
  updateClock();
  clockInterval = setInterval(updateClock, 1000);

  // Реальные счётчики
  loadRealStats();
}

async function loadRealStats() {
  try {
    // Участники
    const usersSnap = await getDocs(collection(db, "users"));
    const usersCount = usersSnap.size;
    setCounter("dashMembers", usersCount);

    // Онлайн
    const presenceSnap = await getDocs(collection(db, "presence"));
    let onlineCount = 0;
    presenceSnap.forEach(d => {
      if (d.data().online) onlineCount++;
    });
    setCounter("dashOnline", onlineCount);

    // Казна — сумма reward одобренных контрактов
    const contractsSnap = await getDocs(collection(db, "contracts"));
    let treasury = 0;
    let contractsCount = contractsSnap.size;
    contractsSnap.forEach(d => {
      const c = d.data();
      if (c.status === "approved") treasury += (c.reward || 0);
    });
    setCounter("dashTreasury", treasury.toLocaleString("ru-RU"));
    setCounter("dashContracts", contractsCount);

    // Активные войны
    const alliesSnap = await getDocs(collection(db, "allies"));
    let wars = 0;
    alliesSnap.forEach(d => {
      if (d.data().status === "war") wars++;
    });
    setCounter("dashWars", wars);

    // Сообщения
    try {
      const msgsSnap = await getDocs(collection(db, "chats", "main", "messages"));
      setCounter("dashMessages", msgsSnap.size);
    } catch (e) {
      setCounter("dashMessages", 0);
    }
  } catch (e) {
    console.warn("Stats load failed, using demo", e);

    // Демо-режим
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
    } catch (err) {}
  }
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
  event.innerHTML = `
    <span class="dash-event-icon">${icon}</span>
    <span class="dash-event-time">${time}</span>
    <span class="dash-event-text">${text}</span>
  `;
  feed.insertBefore(event, feed.firstChild);
  while (feed.children.length > 30) feed.removeChild(feed.lastChild);
}
