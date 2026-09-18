// js/modules/chat/chat.js
import {
  collection, addDoc, query, orderBy, limit,
  onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "../../firebase-init.js";
import { getCurrentUser } from "../../core/state.js";
import { renderMessage, renderDateSeparator, isSameDay } from "./chat-render.js";
import { setTyping, destroyPresence, setupPresence } from "./chat-presence.js";
import { toggleReaction } from "./chat-reactions.js";
import { toast, openModal, closeModal } from "../../core/utils.js";
import { addDashEvent } from "../../core/dashboard.js";
import { notifyNewMessage, resetUnread, initChatNotifications } from "./chat-notifications.js";

const CHATS = {
  residents: {
    containerId: "chatMessages",
    inputId: "chatInput",
    sendId: "chatSend",
    emojiBtnId: "emojiBtn",
    emojiPickerId: "emojiPicker",
    newBtnId: "chatNewBtn",
    replyBarId: "chatReplyBar",
    replyNameId: "replyToName",
    replyTextId: "replyToText",
    badgeId: "chatBadge",
    themePickerId: "chatThemePicker",
    panelId: "chat",
    pinBarId: "chatPinBar",
    pinAuthorId: "chatPinAuthor",
    pinTextId: "chatPinText"
  },
  allies: {
    containerId: "chatAlliesMessages",
    inputId: "chatAlliesInput",
    sendId: "chatAlliesSend",
    emojiBtnId: "chatAlliesEmojiBtn",
    emojiPickerId: "chatAlliesEmojiPicker",
    newBtnId: "chatAlliesNewBtn",
    replyBarId: "chatAlliesReplyBar",
    replyNameId: "chatAlliesReplyToName",
    replyTextId: "chatAlliesReplyToText",
    badgeId: "chatAlliesBadge",
    themePickerId: "chatAlliesThemePicker",
    panelId: "chat-allies",
    pinBarId: "chatAlliesPinBar",
    pinAuthorId: "chatAlliesPinAuthor",
    pinTextId: "chatAlliesPinText"
  }
};

const unsubscribers = { residents: null, allies: null };
const lastMessageId = { residents: null, allies: null };
const firstLoad = { residents: true, allies: true };
const autoScroll = { residents: true, allies: true };
const hiddenMessages = { residents: new Set(), allies: new Set() };

let demoMode = false;
let notificationsInited = false;

const EMOJIS = [
  "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃",
  "😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙",
  "😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔",
  "😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔",
  "😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥵","🥶",
  "😵","🤯","🤠","🥳","😎","🤓","🧐","😕","😟","🙁",
  "😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥",
  "😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱",
  "😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡",
  "👹","👺","👻","👽","👾","🤖","🎃","😺","😸","😹",
  "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔",
  "❣️","💕","💞","💓","💗","💖","💘","💝","💟","🔥",
  "⭐","🌟","✨","💫","⚡","💥","💢","💦","💨","🕳️",
  "👍","👎","👌","✌️","🤞","🤟","🤘","🤙","👈","👉",
  "👆","👇","☝️","✋","🤚","🖐️","🖖","👋","🤝","🙏",
  "⚔️","🛡️","🏆","🎯","💰","💎","⚠️","☣️","🧬","🩸",
  "🧟","🌑","❄️","🎮","🎲","🃏","🎰","🎨","🎭","🎪"
];

export function initChat() {
  const user = getCurrentUser();
  if (!user) return;

  const isAlly = user.role === "ally";

  if (isAlly) {
    initOneChat("allies");
  } else {
    initOneChat("residents");
    initOneChat("allies");
  }

  try { setupPresence(); } catch (e) { console.warn("Presence failed:", e); }

  if (!notificationsInited) {
    notificationsInited = true;
    initChatNotifications();
  }

  window.addEventListener("tabChange", (e) => {
    if (e.detail.tab === "chat" || e.detail.tab === "chat-allies") {
      resetUnread(e.detail.tab);
    }
  });
}

function initOneChat(chatId) {
  const cfg = CHATS[chatId];
  if (!cfg) return;

  const container = document.getElementById(cfg.containerId);
  if (!container) return;

  setupInputForChat(chatId);
  setupScrollForChat(chatId);
  initThemeForChat(chatId);
  loadPinned(chatId);

  const msgsRef = collection(db, "chats", chatId, "messages");
  const q = query(msgsRef, orderBy("createdAt", "asc"), limit(200));

  try {
    unsubscribers[chatId] = onSnapshot(q, (
