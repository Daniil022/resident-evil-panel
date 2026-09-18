// js/modules/chat/chat-notifications.js

let unreadCount = 0;
let originalTitle = "LIVE RUSSIA // Панель симьи RESIDENT EVIL";
let titleInterval = null;

export function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn("Sound not supported:", e.message);
  }
}

export function updateChatBadge(count) {
  const badge = document.getElementById("chatBadge");
  if (!badge) return;

  const chatPanel = document.getElementById("chat");
  const isChatOpen = chatPanel && chatPanel.classList.contains("active");

  if (count <= 0 || isChatOpen) {
    badge.style.display = "none";
    unreadCount = 0;
    stopTitleBlink();
    return;
  }

  badge.textContent = count > 99 ? "99+" : count;
  badge.style.display = "inline-block";
  unreadCount = count;
}

function startTitleBlink() {
  if (titleInterval) return;
  let on = false;
  titleInterval = setInterval(() => {
    document.title = on ? originalTitle : "🔴 Новое сообщение!";
    on = !on;
  }, 1000);
}

function stopTitleBlink() {
  if (titleInterval) {
    clearInterval(titleInterval);
    titleInterval = null;
  }
  document.title = originalTitle;
}

export function notifyNewMessage(msg, isOwnMessage) {
  const chatPanel = document.getElementById("chat");
  const isChatOpen = chatPanel && chatPanel.classList.contains("active");

  if (isOwnMessage) return;
  if (isChatOpen) return;

  playNotificationSound();

  if (unreadCount === 0) {
    startTitleBlink();
  }

  unreadCount++;
  updateChatBadge(unreadCount);
}

export function resetUnread() {
  unreadCount = 0;
  updateChatBadge(0);
  stopTitleBlink();
}

export function initChatNotifications() {
  window.addEventListener("tabChange", (e) => {
    if (e.detail.tab === "chat") {
      resetUnread();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      const chatPanel = document.getElementById("chat");
      const isChatOpen = chatPanel && chatPanel.classList.contains("active");
      if (isChatOpen) {
        resetUnread();
      }
    }
  });
}
