// js/modules/chat/chat.js
import {
  collection, addDoc, query, orderBy, limit,
  onSnapshot, serverTimestamp, doc, getDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "../../firebase-init.js";
import { getCurrentUser } from "../../core/state.js";
import { renderMessage, renderDateSeparator, isSameDay } from "./chat-render.js";
import { setupInput, setReplyTo, clearReply } from "./chat-input.js";
import { setupPresence, setTyping, destroyPresence } from "./chat-presence.js";
import { scrollToBottom, setupScroll, scrollToMessage } from "./chat-scroll.js";
import { toggleReaction } from "./chat-reactions.js";
import { toast, openModal, closeModal } from "../../core/utils.js";
import { addDashEvent } from "../../core/dashboard.js";
import { notifyNewMessage, resetUnread, initChatNotifications } from "./chat-notifications.js";

const CHAT_ID = "main";
let unsubscribeMessages = null;
let demoMode = false;
let demoMessages = [];
let lastMessageId = null;
let firstLoad = true;
let notificationsInited = false;

export function initChat() {
  const container = document.getElementById("chatMessages");
  if (!container) return;

  setupInput(sendMessage, onTyping);
  setupPresence();
  setupScroll();
  initChatTheme();

  if (!notificationsInited) {
    notificationsInited = true;
    initChatNotifications();
  }

  const msgsRef = collection(db, "chats", CHAT_ID, "messages");
  const q = query(msgsRef, orderBy("createdAt", "asc"), limit(200));

  try {
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
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
          onReply: (m) => setReplyTo(m),
          onReact: (id, emoji) => toggleReaction(id, emoji),
          onEdit: (m) => openEditModal(m),
          onDelete: (m) => deleteMessage(m)
        }, user.uid));

        lastAuthor = msg.authorId;
      });

      if (newestMsg && !firstLoad && newestMsg.id !== lastMessageId) {
        const isOwn = newestMsg.authorId === getCurrentUser().uid;
        notifyNewMessage(newestMsg, isOwn);
      }

      if (newestMsg) lastMessageId = newestMsg.id;
      firstLoad = false;

      scrollToBottom();
      updateBadge(count);
      window.dispatchEvent(new CustomEvent("chatMessageCount", { detail: { count } }));
    }, (err) => {
      console.warn("Firebase offline, демо-режим");
      enableDemoMode();
    });
  } catch (e) {
    enableDemoMode();
  }

  window.addEventListener("tabChange", (e) => {
    if (e.detail.tab === "chat") resetUnread();
  });
}

export function destroyChat() {
  if (unsubscribeMessages) unsubscribeMessages();
  destroyPresence();
}

function openEditModal(msg) {
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
        const m = demoMessages.find(x => x.id === msg.id);
        if (m) { m.text = newText; m.editedAt = Date.now(); }
        localStorage.setItem("re_demo_messages", JSON.stringify(demoMessages));
        renderDemo();
        closeModal();
        return;
      }

      try {
        await updateDoc(doc(db, "chats", CHAT_ID, "messages", msg.id), {
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
  const raw = localStorage.getItem("re_demo_messages");
  demoMessages = raw ? JSON.parse(raw) : [
    { id: "d1", text: "Добро пожаловать в беседу семьи RESIDENT EVIL.",
      authorLogin: "Emperor", authorRole: "emperor", authorId: "demo-emperor",
      createdAt: Date.now() - 3600000, reactions: {} },
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
      onEdit: (m) => openEditModal(m),
      onDelete: (m) => demoDelete(m.id)
    }, user.uid));
  });

  scrollToBottom(true);
  window.dispatchEvent(new CustomEvent("chatMessageCount", { detail: { count: demoMessages.length } }));
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
    addDashEvent("💬", user.login + ": " + text.substring(0, 40));
    return;
  }

  try {
    await addDoc(collection(db, "chats", CHAT_ID, "messages"), newMsg);
    clearReply();
    addDashEvent("💬", user.login + ": " + text.substring(0, 40));
  } catch (e) {
    toast("Не удалось отправить сообщение", "warn");
  }
}

async function deleteMessage(msg) {
  const user = getCurrentUser();
  if (!user) return;
  const isAdmin = ["emperor", "lord"].includes(user.role);
  if (msg.authorId !== user.uid && !isAdmin) {
    toast("Нет прав на удаление", "warn");
    return;
  }
  if (!confirm("Удалить сообщение?")) return;

  if (demoMode) { demoDelete(msg.id); return; }

  try {
    await deleteDoc(doc(db, "chats", CHAT_ID, "messages", msg.id));
    addDashEvent("🗑", user.login + " удалил сообщение");
  } catch (e) {
    toast("Не удалось удалить", "warn");
  }
}

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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function initChatTheme() {
  const saved = localStorage.getItem("chat_theme") || "default";
  document.body.setAttribute("data-chat-theme", saved);

  const picker = document.getElementById("chatThemePicker");
  if (!picker) return;

  picker.querySelectorAll(".chat-theme-btn").forEach(btn => {
    if (btn.dataset.theme === saved) btn.classList.add("active");
    btn.addEventListener("click", () => {
      const theme = btn.dataset.theme;
      document.body.setAttribute("data-chat-theme", theme);
      localStorage.setItem("chat_theme", theme);
      picker.querySelectorAll(".chat-theme-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      toast("Тема чата изменена", "ok");
    });
  });
}
