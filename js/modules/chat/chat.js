// js/modules/chat/chat.js
import {
  collection, addDoc, query, orderBy, limit,
  onSnapshot, serverTimestamp, doc, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "../../firebase-init.js";
import { getCurrentUser } from "../../core/state.js";
import { renderMessage, renderDateSeparator, isSameDay } from "./chat-render.js";
import { setupInput, setReplyTo, clearReply } from "./chat-input.js";
import { setupPresence, setTyping, destroyPresence } from "./chat-presence.js";
import { scrollToBottom, setupScroll } from "./chat-scroll.js";
import { toggleReaction } from "./chat-reactions.js";
import { toast } from "../../core/utils.js";
import { addDashEvent } from "../../core/dashboard.js";

const CHAT_ID = "main";
let unsubscribeMessages = null;
let demoMode = false;
let demoMessages = [];

export function initChat() {
  const container = document.getElementById("chatMessages");
  if (!container) return;

  setupInput(sendMessage, onTyping);
  setupPresence();
  setupScroll();

  const msgsRef = collection(db, "chats", CHAT_ID, "messages");
  const q = query(msgsRef, orderBy("createdAt", "asc"), limit(200));

  try {
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
      container.innerHTML = "";
      let lastDate = null;
      let lastAuthor = null;
      const user = getCurrentUser();
      let count = 0;

      snapshot.forEach((docSnap) => {
        const msg = { id: docSnap.id, ...docSnap.data() };
        if (!msg.createdAt) return;
        count++;

        const msgDate = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date();

        if (!lastDate || !isSameDay(lastDate, msgDate)) {
          container.appendChild(renderDateSeparator(msgDate));
          lastDate = msgDate;
          lastAuthor = null;
        }

        const grouped = lastAuthor === msg.authorId &&
          (msgDate - (lastDate || 0)) < 5 * 60 * 1000;

        container.appendChild(renderMessage(msg, grouped, {
          onReply: (m) => setReplyTo(m),
          onReact: (id, emoji) => toggleReaction(id, emoji),
          onDelete: (m) => deleteMessage(m)
        }, user.uid));

        lastAuthor = msg.authorId;
      });

      scrollToBottom();
      updateBadge(count);
      window.dispatchEvent(new CustomEvent("chatMessageCount", {
        detail: { count }
      }));
    }, (err) => {
      console.warn("Firebase offline, включаем демо-режим чата");
      enableDemoMode();
    });
  } catch (e) {
    enableDemoMode();
  }

  // Отметка «прочитано» при открытии вкладки чата
  window.addEventListener("tabChange", (e) => {
    if (e.detail.tab === "chat") {
      const badge = document.getElementById("chatBadge");
      if (badge) badge.style.display = "none";
    }
  });
}

export function destroyChat() {
  if (unsubscribeMessages) unsubscribeMessages();
  destroyPresence();
}

// ==================== ДЕМО-РЕЖИМ ====================
function enableDemoMode() {
  demoMode = true;
  const container = document.getElementById("chatMessages");
  if (!container) return;

  // Загружаем демо-сообщения
  const raw = localStorage.getItem("re_demo_messages");
  demoMessages = raw ? JSON.parse(raw) : [
    { id: "d1", text: "Добро пожаловать в беседу симьи RESIDENT EVIL.",
      authorLogin: "Emperor", authorRole: "Император", authorId: "demo-emperor",
      createdAt: Date.now() - 3600000, reactions: {} },
    { id: "d2", text: "Сегодня в 20:00 общий сбор на нефтезаводе.",
      authorLogin: "Lord_Darkness", authorRole: "Лорд Тьмы", authorId: "demo-lord",
      createdAt: Date.now() - 1800000, reactions: { "🔥": ["demo-emperor"] } },
    { id: "d3", text: "Принял. Буду с отрядом.",
      authorLogin: "Death_Knight", authorRole: "Рыцарь Смерти", authorId: "demo-knight",
      createdAt: Date.now() - 600000, reactions: {} }
  ];

  renderDemo();
}

function renderDemo() {
  const container = document.getElementById("chatMessages");
  if (!container) return;
  container.innerHTML = "";

  const user = getCurrentUser();
  let lastDate = null;

  demoMessages.forEach(msg => {
    const msgDate = new Date(msg.createdAt);
    if (!lastDate || !isSameDay(lastDate, msgDate)) {
      container.appendChild(renderDateSeparator(msgDate));
      lastDate = msgDate;
    }
    container.appendChild(renderMessage(msg, false, {
      onReply: (m) => setReplyTo(m),
      onReact: (id, emoji) => demoReact(id, emoji),
      onDelete: (m) => demoDelete(m.id)
    }, user.uid));
  });

  scrollToBottom(true);
  window.dispatchEvent(new CustomEvent("chatMessageCount", {
    detail: { count: demoMessages.length }
  }));
}

function demoReact(id, emoji) {
  const msg = demoMessages.find(m => m.id === id);
  if (!msg) return;
  msg.reactions = msg.reactions || {};
  msg.reactions[emoji] = msg.reactions[emoji] || [];
  const user = getCurrentUser();
  const idx = msg.reactions[emoji].indexOf(user.uid);
  if (idx >= 0) msg.reactions[emoji].splice(idx, 1);
  else msg.reactions[emoji].push(user.uid);
  localStorage.setItem("re_demo_messages", JSON.stringify(demoMessages));
  renderDemo();
}

function demoDelete(id) {
  if (!confirm("Удалить сообщение?")) return;
  demoMessages = demoMessages.filter(m => m.id !== id);
  localStorage.setItem("re_demo_messages", JSON.stringify(demoMessages));
  renderDemo();
}

// ==================== ОТПРАВКА ====================
async function sendMessage(text) {
  const user = getCurrentUser();
  if (!user || !text.trim()) return;

  const replyTo = window.__currentReply || null;

  const newMsg = {
    text: text.trim(),
    authorId: user.uid,
    authorLogin: user.login,
    authorRole: user.role,
    replyTo: replyTo ? {
      id: replyTo.id,
      author: replyTo.authorLogin,
      text: replyTo.text.substring(0, 80)
    } : null,
    reactions: {},
    createdAt: serverTimestamp()
  };

  if (demoMode) {
    newMsg.id = "demo-" + Date.now();
    newMsg.createdAt = Date.now();
    demoMessages.push(newMsg);
    localStorage.setItem("re_demo_messages", JSON.stringify(demoMessages));
    renderDemo();
    clearReply();
    addDashEvent("💬", `${user.login}: ${text.substring(0, 40)}`);
    return;
  }

  try {
    await addDoc(collection(db, "chats", CHAT_ID, "messages"), newMsg);
    clearReply();
    addDashEvent("💬", `${user.login}: ${text.substring(0, 40)}`);
  } catch (e) {
    toast("Не удалось отправить сообщение", "warn");
  }
}

// ==================== УДАЛЕНИЕ ====================
async function deleteMessage(msg) {
  const user = getCurrentUser();
  if (!user) return;

  const isAdmin = ["Император", "Лорд Тьмы"].includes(user.role);
  if (msg.authorId !== user.uid && !isAdmin) {
    toast("Нет прав на удаление", "warn");
    return;
  }

  if (!confirm("Удалить сообщение?")) return;

  if (demoMode) {
    demoDelete(msg.id);
    return;
  }

  try {
    await deleteDoc(doc(db, "chats", CHAT_ID, "messages", msg.id));
    addDashEvent("🗑", `${user.login} удалил сообщение`);
  } catch (e) {
    toast("Не удалось удалить", "warn");
  }
}

// ==================== ПЕЧАТАЕТ ====================
let typingTimeout = null;
function onTyping() {
  if (demoMode) return;
  const user = getCurrentUser();
  if (!user) return;
  setTyping(true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => setTyping(false), 2000);
}

function updateBadge(count) {
  const badge = document.getElementById("chatBadge");
  if (!badge) return;
  const chatPanel = document.getElementById("chat");
  const isChatOpen = chatPanel && chatPanel.classList.contains("active");
  if (isChatOpen) { badge.style.display = "none"; return; }
  badge.textContent = count;
  badge.style.display = count > 0 ? "inline-block" : "none";
}
