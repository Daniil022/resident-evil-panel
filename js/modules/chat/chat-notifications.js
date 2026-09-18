// js/modules/chat/chat-notifications.js

let unreadCount = { residents: 0, allies: 0 };
let originalTitle = "LIVE RUSSIA // Панель семьи RESIDENT EVIL";
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
  } catch (e) {}
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

export function notifyNewMessage(msg, isOwnMessage, chatId = "residents") {
  if (isOwnMessage) return;

  const panelId = chatId === "allies" ? "chat-allies" : "chat";
  const panel = document.getElementById(panelId);
  const isOpen = panel && panel.classList.contains("active");

  if (isOpen) return;

  playNotificationSound();

  const totalUnread = unreadCount.residents + unreadCount.allies;
  if (totalUnread === 0) startTitleBlink();

  unreadCount[chatId]++;
}

export function resetUnread(tab) {
  if (tab === "chat") unreadCount.residents = 0;
  if (tab === "chat-allies") unreadCount.allies = 0;

  if (unreadCount.residents + unreadCount.allies === 0) {
    stopTitleBlink();
  }
}

export function initChatNotifications() {
  window.addEventListener("tabChange", (e) => {
    if (e.detail.tab === "chat" || e.detail.tab === "chat-allies") {
      resetUnread(e.detail.tab);
    }
  });
}
