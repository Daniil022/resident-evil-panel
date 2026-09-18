// js/modules/chat/chat.js
import {
  collection, addDoc, query, orderBy, limit,
  onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc
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
    panelId: "chat"
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
    panelId: "chat-allies"
  }
};

const unsubscribers = { residents: null, allies: null };
const lastMessageId = { residents: null, allies: null };
const firstLoad = { residents: true, allies: true };
const autoScroll = { residents: true, allies: true };

let demoMode = false;
let demoMessages = { residents: [], allies: [] };
let notificationsInited = false;

export function initChat() {
  const user = getCurrentUser();
  if (!user) return;

  const isAlly = user.role === "ally";

  // Союзник видит только чат союзников
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
  if (!container) {
    console.warn("Container not found for chat:", chatId, cfg.containerId);
    return;
  }

  setupInputForChat(chatId);
  setupScrollForChat(chatId);
  initThemeForChat(chatId);

  const msgsRef = collection(db, "chats", chatId, "messages");
  const q = query(msgsRef, orderBy("createdAt", "asc"), limit(200));

  try {
    unsubscribers[chatId] = onSnapshot(q, (snapshot) => {
      container.innerHTML = "";
      let lastDate = null;
      let lastAuthor = null;
      const user = getCurrentUser();
      let count = 0;
      let newestMsg = null;

      snapshot.forEach((docSnap) => {
        const msg = { id: docSnap.id, ...docSnap.data() };
        if (!msg.createdAt) return;
        count++;
        newestMsg = msg;

        const msgDate = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date();

        if (!lastDate || !isSameDay(lastDate, msgDate)) {
          container.appendChild(renderDateSeparator(msgDate));
          lastDate = msgDate;
          lastAuthor = null;
        }

        const grouped = lastAuthor === msg.authorId &&
          (msgDate - (lastDate || 0)) < 5 * 60 * 1000;

        container.appendChild(renderMessage(msg, grouped, {
          onReply: (m) => setReplyToChat(chatId, m),
          onReact: (id, emoji) => toggleReaction(id, emoji, chatId),
          onEdit: (m) => openEditModal(m, chatId),
          onDelete: (m) => deleteMessage(m, chatId)
        }, user.uid));

        lastAuthor = msg.authorId;
      });

      if (count === 0) {
        const emptyMsg = chatId === "allies"
          ? "Беседа союзников пуста. Будьте первым!"
          : "Беседа резидентов пуста. Будьте первым!";
        container.innerHTML = '<div style="text-align:center;color:var(--muted);padding:40px;font-size:12px;">' + emptyMsg + '</div>';
      }

      if (newestMsg && !firstLoad[chatId] && newestMsg.id !== lastMessageId[chatId]) {
        const isOwn = newestMsg.authorId === getCurrentUser().uid;
        notifyNewMessage(newestMsg, isOwn, chatId);
      }

      if (newestMsg) lastMessageId[chatId] = newestMsg.id;
      firstLoad[chatId] = false;

      scrollToBottomForChat(chatId);
      updateBadgeForChat(chatId, count);
    }, (err) => {
      console.warn("Firebase offline для " + chatId, err);
    });
  } catch (e) {
    console.warn("Init chat failed for " + chatId, e);
  }
}

export function destroyChat() {
  for (const id of Object.keys(unsubscribers)) {
    if (unsubscribers[id]) unsubscribers[id]();
  }
  try { destroyPresence(); } catch (e) {}
}

function openEditModal(msg, chatId) {
  if (!msg) return;
  openModal({
    title: "РЕДАКТИРОВАТЬ СООБЩЕНИЕ",
    html: '<div class="form-field"><label>Новый текст</label><textarea id="editText" style="min-height:100px;">' + escapeHtml(msg.text) + '</textarea></div>' +
          '<div id="editError" style="color:var(--red);font-size:12px;display:none;"></div>',
    confirmText: "СОХРАНИТЬ",
    onConfirm: async () => {
      const newText = document.getElementById("editText").value.trim();
      const err = document.getElementById("editError");
      if (!newText) { err.textContent = "Введите текст"; err.style.display = "block"; return; }

      if (demoMode) {
        const arr = demoMessages[chatId];
        const m = arr.find(x => x.id === msg.id);
        if (m) { m.text = newText; m.editedAt = Date.now(); }
        saveDemoMessages();
        renderDemoForChat(chatId);
        closeModal();
        return;
      }

      try {
        await updateDoc(doc(db, "chats", chatId, "messages", msg.id), {
          text: newText,
          editedAt: Date.now()
        });
        toast("Сообщение изменено", "ok");
        closeModal();
      } catch (e) {
        toast("Ошибка: " + e.message, "warn");
      }
    }
  });
  setTimeout(() => document.getElementById("editText")?.focus(), 80);
}

function enableDemoMode() {
  demoMode = true;
  const raw = localStorage.getItem("re_demo_messages_multi");
  if (raw) {
    try { demoMessages = JSON.parse(raw); } catch {}
  } else {
    demoMessages = { residents: [], allies: [] };
    saveDemoMessages();
  }
  renderDemoForChat("residents");
  renderDemoForChat("allies");
}

function saveDemoMessages() {
  localStorage.setItem("re_demo_messages_multi", JSON.stringify(demoMessages));
}

function renderDemoForChat(chatId) {
  const cfg = CHATS[chatId];
  if (!cfg) return;
  const container = document.getElementById(cfg.containerId);
  if (!container) return;
  container.innerHTML = "";
  const user = getCurrentUser();
  let lastDate = null;
  const arr = demoMessages[chatId] || [];

  if (arr.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--muted);padding:40px;font-size:12px;">Нет сообщений</div>';
    return;
  }

  arr.forEach(msg => {
    const msgDate = new Date(msg.createdAt);
    if (!lastDate || !isSameDay(lastDate, msgDate)) {
      container.appendChild(renderDateSeparator(msgDate));
      lastDate = msgDate;
    }
    container.appendChild(renderMessage(msg, false, {
      onReply: (m) => setReplyToChat(chatId, m),
      onReact: (id, emoji) => demoReact(chatId, id, emoji),
      onEdit: (m) => openEditModal(m, chatId),
      onDelete: (m) => demoDelete(chatId, m.id)
    }, user.uid));
  });

  scrollToBottomForChat(chatId);
  updateBadgeForChat(chatId, arr.length);
}

function demoReact(chatId, id, emoji) {
  const arr = demoMessages[chatId] || [];
  const msg = arr.find(m => m.id === id);
  if (!msg) return;
  msg.reactions = msg.reactions || {};
  msg.reactions[emoji] = msg.reactions[emoji] || [];
  const user = getCurrentUser();
  const idx = msg.reactions[emoji].indexOf(user.uid);
  if (idx >= 0) msg.reactions[emoji].splice(idx, 1);
  else msg.reactions[emoji].push(user.uid);
  saveDemoMessages();
  renderDemoForChat(chatId);
}

function demoDelete(chatId, id) {
  if (!confirm("Удалить сообщение?")) return;
  demoMessages[chatId] = demoMessages[chatId].filter(m => m.id !== id);
  saveDemoMessages();
  renderDemoForChat(chatId);
}

async function sendMessageTo(chatId, text) {
  const user = getCurrentUser();
  if (!user || !text.trim()) return;

  console.log("Отправка:", { chatId, role: user.role, text });

  if (user.role === "ally" && chatId === "residents") {
    toast("Союзники не могут писать в беседу резидентов", "warn");
    return;
  }

  const reply = window.__currentReplies && window.__currentReplies[chatId];

  const newMsg = {
    text: text.trim(),
    authorId: user.uid,
    authorLogin: user.login,
    authorRole: user.role,
    replyTo: reply ? {
      id: reply.id,
      author: reply.authorLogin,
      text: reply.text.substring(0, 80)
    } : null,
    reactions: {},
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "chats", chatId, "messages"), newMsg);
    console.log("Сообщение отправлено в", chatId);
    clearReplyForChat(chatId);
    addDashEvent("💬", user.login + ": " + text.substring(0, 40));
  } catch (e) {
    console.error("Ошибка отправки:", e);
    toast("Ошибка: " + e.message, "warn");
  }
}

async function deleteMessage(msg, chatId) {
  const user = getCurrentUser();
  if (!user) return;
  const isAdmin = ["emperor", "lord"].includes(user.role);
  if (msg.authorId !== user.uid && !isAdmin) {
    toast("Нет прав на удаление", "warn");
    return;
  }
  if (!confirm("Удалить сообщение?")) return;

  try {
    await deleteDoc(doc(db, "chats", chatId, "messages", msg.id));
    addDashEvent("🗑", user.login + " удалил сообщение");
  } catch (e) {
    toast("Не удалось удалить", "warn");
  }
}

function setupInputForChat(chatId) {
  const cfg = CHATS[chatId];
  if (!cfg) return;

  const input = document.getElementById(cfg.inputId);
  const sendBtn = document.getElementById(cfg.sendId);
  const emojiBtn = document.getElementById(cfg.emojiBtnId);
  const emojiPicker = document.getElementById(cfg.emojiPickerId);

  if (!input || !sendBtn) {
    console.warn("Input not found for chat:", chatId);
    return;
  }

  const send = () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    sendMessageTo(chatId, text);
  };

  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  let typingTimeout = null;
  input.addEventListener("input", () => {
    if (demoMode) return;
    try {
      setTyping(true);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => setTyping(false), 2000);
    } catch (e) {}
  });

  if (emojiBtn && emojiPicker) {
    const EMOJIS = ["😀","😂","🤣","😊","😎","🤔","😴","😡","🥶","🤯",
      "❤️","🔥","💀","⚔️","🛡️","🏆","🎯","💰","💎","⚠️",
      "👍","👎","👏","🙏","💪","✊","🤝","🖕","✌️","👀",
      "☣️","🧬","🩸","🧟","👻","🎃","🌑","⚡","❄️","☠️"];

    emojiPicker.innerHTML = EMOJIS.map(e => '<button type="button">' + e + '</button>').join("");
    emojiPicker.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        input.value += btn.textContent;
        input.focus();
      });
    });

    emojiBtn.addEventListener("click", () => {
      emojiPicker.classList.toggle("active");
    });
  }
}

function setReplyToChat(chatId, msg) {
  const cfg = CHATS[chatId];
  if (!cfg) return;

  if (!window.__currentReplies) window.__currentReplies = {};
  window.__currentReplies[chatId] = msg;

  const bar = document.getElementById(cfg.replyBarId);
  const name = document.getElementById(cfg.replyNameId);
  const txt = document.getElementById(cfg.replyTextId);

  if (name) name.textContent = msg.authorLogin;
  if (txt) txt.textContent = msg.text.substring(0, 80);
  if (bar) bar.classList.add("active");

  const input = document.getElementById(cfg.inputId);
  if (input) input.focus();
}

function clearReplyForChat(chatId) {
  const cfg = CHATS[chatId];
  if (!cfg) return;
  if (window.__currentReplies) window.__currentReplies[chatId] = null;
  const bar = document.getElementById(cfg.replyBarId);
  if (bar) bar.classList.remove("active");
}

window.__clearReply = function() { clearReplyForChat("residents"); };
window.__clearReplyAllies = function() { clearReplyForChat("allies"); };

function setupScrollForChat(chatId) {
  const cfg = CHATS[chatId];
  if (!cfg) return;

  const container = document.getElementById(cfg.containerId);
  const newBtn = document.getElementById(cfg.newBtnId);
  if (!container) return;

  container.addEventListener("scroll", () => {
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    autoScroll[chatId] = atBottom;
    if (autoScroll[chatId] && newBtn) newBtn.classList.remove("show");
  });

  if (newBtn) {
    newBtn.addEventListener("click", () => {
      container.scrollTop = container.scrollHeight;
      autoScroll[chatId] = true;
      newBtn.classList.remove("show");
    });
  }
}

function scrollToBottomForChat(chatId, force = false) {
  const cfg = CHATS[chatId];
  if (!cfg) return;
  const container = document.getElementById(cfg.containerId);
  const newBtn = document.getElementById(cfg.newBtnId);
  if (!container) return;

  if (autoScroll[chatId] || force) {
    container.scrollTop = container.scrollHeight;
  } else if (newBtn) {
    newBtn.classList.add("show");
  }
}

function updateBadgeForChat(chatId, count) {
  const cfg = CHATS[chatId];
  if (!cfg) return;
  const badge = document.getElementById(cfg.badgeId);
  if (!badge) return;

  const panel = document.getElementById(cfg.panelId);
  const isOpen = panel && panel.classList.contains("active");
  if (isOpen) {
    badge.style.display = "none";
    return;
  }

  badge.textContent = count;
  badge.style.display = count > 0 ? "inline-block" : "none";
}

function initThemeForChat(chatId) {
  const cfg = CHATS[chatId];
  if (!cfg) return;

  const picker = document.getElementById(cfg.themePickerId);
  if (!picker) return;

  const saved = localStorage.getItem("chat_theme_" + chatId) || "default";
  document.body.setAttribute("data-chat-theme-" + chatId, saved);

  picker.querySelectorAll(".chat-theme-btn").forEach(btn => {
    if (btn.dataset.theme === saved) btn.classList.add("active");
    btn.addEventListener("click", () => {
      const theme = btn.dataset.theme;
      document.body.setAttribute("data-chat-theme-" + chatId, theme);
      localStorage.setItem("chat_theme_" + chatId, theme);
      picker.querySelectorAll(".chat-theme-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      toast("Тема чата изменена", "ok");
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
