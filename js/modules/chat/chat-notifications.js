// js/modules/chat/chat-notifications.js

let originalTitle = "LIVE RUSSIA // Панель семьи RESIDENT EVIL";
let titleInterval = null;

function getLastReadAt(chatId) {
  const key = "chat_last_read_" + chatId;
  const raw = localStorage.getItem(key);
  return raw ? parseInt(raw) : 0;
}

function setLastReadAt(chatId, timestamp) {
  const key = "chat_last_read_" + chatId;
  localStorage.setItem(key, timestamp.toString());
}

export function updateUnreadBadge(chatId, allMessages) {
  const badgeId = chatId === "allies" ? "chatAlliesBadge" : "chatBadge";
  const panelId = chatId === "allies" ? "chat-allies" : "chat";
  const badge = document.getElementById(badgeId);
  const panel = document.getElementById(panelId);

  if (!badge) return;

  const isOpen = panel && panel.classList.contains("active");
  if (isOpen) {
    badge.style.display = "none";
    return;
  }

  const lastRead = getLastReadAt(chatId);
  let unreadCount = 0;

  if (lastRead === 0) {
    unreadCount = allMessages.length;
  } else {
    allMessages.forEach(m => {
      const time = m.createdAt && m.createdAt.toDate
        ? m.createdAt.toDate().getTime()
        : (typeof m.createdAt === "number" ? m.createdAt : 0);
      if (time > lastRead) unreadCount++;
    });
  }

  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? "99+" : unreadCount;
    badge.style.display = "inline-block";
  } else {
    badge.style.display = "none";
  }
}

export function markChatAsRead(chatId) {
  setLastReadAt(chatId, Date.now());

  const badgeId = chatId === "allies" ? "chatAlliesBadge" : "chatBadge";
  const badge = document.getElementById(badgeId);
  if (badge) badge.style.display = "none";
}

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

export function hasUnread() {
  const residentsUnread = hasUnreadForChat("residents");
  const alliesUnread = hasUnreadForChat("allies");
  return residentsUnread || alliesUnread;
}

function hasUnreadForChat(chatId) {
  const badgeId = chatId === "allies" ? "chatAlliesBadge" : "chatBadge";
  const badge = document.getElementById(badgeId);
  if (!badge) return false;
  return badge.style.display !== "none" && badge.textContent !== "0";
}

export function notifyNewMessage(msg, isOwnMessage, chatId) {
  if (isOwnMessage) return;

  const panelId = chatId === "allies" ? "chat-allies" : "chat";
  const panel = document.getElementById(panelId);
  const isOpen = panel && panel.classList.contains("active");

  if (isOpen) {
    markChatAsRead(chatId);
    return;
  }

  playNotificationSound();

  if (!hasUnread()) {
    startTitleBlink();
  }
}

export function resetUnread(tab) {
  if (tab === "chat") {
    markChatAsRead("residents");
  }
  if (tab === "chat-allies") {
    markChatAsRead("allies");
  }

  if (!hasUnread()) {
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
