// js/core/dashboard.js
import { getCurrentUser } from "./state.js";

export function initDashboard() {
  const user = getCurrentUser();
  if (!user) return;

  // Приветствие
  const dashUser = document.getElementById("dashUser");
  const dashRole = document.getElementById("dashRole");
  const dashAvatar = document.getElementById("dashAvatar");

  if (dashUser) dashUser.textContent = user.login;
  if (dashRole) {
    dashRole.textContent = user.role;
    dashRole.className = "dash-role";
    if (user.role === "Император") dashRole.classList.add("gold");
  }
  if (dashAvatar) {
    dashAvatar.textContent = user.login.charAt(0).toUpperCase();
    if (user.role === "Император") {
      dashAvatar.style.borderColor = "var(--gold)";
      dashAvatar.style.boxShadow = "0 0 25px rgba(255,179,71,0.5)";
    }
  }

  // Часы
  updateClock();
  setInterval(updateClock, 1000);

  // Топ участников (демо)
  renderTop();

  // Счётчик сообщений — обновляется из chat.js через событие
  window.addEventListener("chatMessageCount", (e) => {
    const el = document.getElementById("dashMessages");
    if (el) el.textContent = e.detail.count;
  });

  // Онлайн — из presence
  window.addEventListener("presenceUpdate", (e) => {
    const el = document.getElementById("dashOnline");
    if (el) el.textContent = e.detail.online;
    const membersEl = document.getElementById("dashMembers");
    if (membersEl) membersEl.textContent = e.detail.total;
  });
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

function renderTop() {
  const el = document.getElementById("dashTop");
  if (!el) return;
  const top = [
    { rank: 1, nick: "Emperor", role: "Император", val: "120 000 ₽" },
    { rank: 2, nick: "Lord_Darkness", role: "Лорд Тьмы", val: "85 000 ₽" },
    { rank: 3, nick: "Death_Knight", role: "Рыцарь Смерти", val: "42 000 ₽" }
  ];
  el.innerHTML = top.map(t => `
    <div class="dash-top-item">
      <div class="rank">#${t.rank}</div>
      <div class="who">
        <div class="nick">${t.nick}</div>
        <div class="role">${t.role}</div>
      </div>
      <div class="val">${t.val}</div>
    </div>
  `).join("");
}

export function addDashEvent(icon, text) {
  const feed = document.getElementById("dashFeed");
  if (!feed) return;
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
  // Держим максимум 30 событий
  while (feed.children.length > 30) feed.removeChild(feed.lastChild);
}
