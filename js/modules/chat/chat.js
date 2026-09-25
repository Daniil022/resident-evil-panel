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
import { addDashEvent } from "../../core/dashboard-events.js";
import { isMuted, getMuteRemaining } from "../../core/punishments.js";
import {
  setupScrollForChat,
  scrollToBottom,
  scrollToMessage,
  incrementUnread,
  resetUnread,
  setLastRead,
  restoreLastRead
} from "./chat-scroll.js";
import {
  notifyNewMessage,
  resetUnread as resetChatUnread,
  initChatNotifications,
  updateUnreadBadge,
  markChatAsRead
} from "./chat-notifications.js";

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
const hiddenMessages = { residents: new Set(), allies: new Set() };
const currentMessages = { residents: [], allies: [] };

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
    if (e.detail.tab === "chat") {
      markChatAsRead("residents");
      resetChatUnread("chat");
      scrollToBottom("residents", true);
    }
    if (e.detail.tab === "chat-allies") {
      markChatAsRead("allies");
      resetChatUnread("chat-allies");
      scrollToBottom("allies", true);
    }
  });
}

function initOneChat(chatId) {
  const cfg = CHATS[chatId];
  if (!cfg) return;

  const container = document.getElementById(cfg.containerId);
  if (!container) return;

  setupInputForChat(chatId);
  setupScroll(chatId);
  initThemeForChat(chatId);
  loadPinned(chatId);

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
      currentMessages[chatId] = [];

      snapshot.forEach((docSnap) => {
        const msg = { id: docSnap.id, ...docSnap.data() };
        if (!msg.createdAt) return;
        count++;
        newestMsg = msg;
        currentMessages[chatId].push(msg);

        if (hiddenMessages[chatId].has(msg.id)) return;

        const msgDate = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date();

        if (!lastDate || !isSameDay(lastDate, msgDate)) {
          container.appendChild(renderDateSeparator(msgDate));
          lastDate = msgDate;
          lastAuthor = null;
        }

        const grouped = lastAuthor === msg.authorId &&
          (msgDate - (lastDate || 0)) < 5 * 60 * 1000;

        msg.chatId = chatId;

        const msgEl = renderMessage(msg, grouped, {
          chatId,
          onReply: (m) => setReplyToChat(chatId, m),
          onReact: (id, emoji) => toggleReaction(id, emoji, chatId),
          onEdit: (m) => openEditModal(m, chatId),
          onDelete: (m) => openDeleteModal(m, chatId),
          onPin: (m) => pinMessage(chatId, m),
          onScrollToMessage: (msgId) => scrollToMessage(chatId, msgId)
        }, user.uid);

        container.appendChild(msgEl);

        import("./chat-mentions.js")
          .then(m => m.highlightIfMentioned(msg, msgEl))
          .catch(() => {});

        lastAuthor = msg.authorId;
      });

      if (count === 0) {
        const emptyMsg = chatId === "allies"
          ? "Беседа союзников пуста. Будьте первым!"
          : "Беседа резидентов пуста. Будьте первым!";
        container.innerHTML = '<div style="text-align:center;color:var(--muted);padding:40px;font-size:12px;">' + emptyMsg + '</div>';
      }

      // Проверка на новое сообщение
      if (newestMsg && !firstLoad[chatId] && newestMsg.id !== lastMessageId[chatId]) {
        const isOwn = newestMsg.authorId === getCurrentUser().uid;
        notifyNewMessage(newestMsg, isOwn, chatId);

        // Если это чужое сообщение и юзер не внизу — увеличиваем счётчик
        if (!isOwn) {
          const cont = document.getElementById(cfg.containerId);
          if (cont) {
            const atBottom = cont.scrollHeight - cont.scrollTop - cont.clientHeight < 80;
            if (!atBottom) {
              incrementUnread(chatId);
            }
          }
        }
      }

      if (newestMsg) lastMessageId[chatId] = newestMsg.id;
      firstLoad[chatId] = false;

      // Автоскролл (если юзер внизу)
      scrollToBottomForChat(chatId);

      // Обновляем «прочитано до»
      if (newestMsg && !hiddenMessages[chatId].has(newestMsg.id)) {
        setLastRead(chatId, newestMsg.id);
      }

      updateUnreadBadge(chatId, currentMessages[chatId]);
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

function openDeleteModal(msg, chatId) {
  const user = getCurrentUser();
  const isAdmin = ["emperor", "lord"].includes(user.role);
  const isOwn = msg.authorId === user.uid;
  const canDeleteForAll = isOwn || isAdmin;

  let html = '<p style="color:var(--text-2);font-size:13px;margin-bottom:14px;">Что сделать с сообщением?</p>' +
    '<div class="delete-modal-options">';

  html += '<button class="delete-option" onclick="window.__deleteForMe(\'' + chatId + '\',\'' + msg.id + '\')">' +
    '<span class="delete-icon">👤</span>' +
    '<div class="delete-body">' +
      '<div class="delete-title">Удалить у себя</div>' +
      '<div class="delete-desc">Сообщение исчезнет только для тебя</div>' +
    '</div>' +
  '</button>';

  if (canDeleteForAll) {
    html += '<button class="delete-option danger" onclick="window.__deleteForAll(\'' + chatId + '\',\'' + msg.id + '\')">' +
      '<span class="delete-icon">🗑</span>' +
      '<div class="delete-body">' +
        '<div class="delete-title">Удалить для всех</div>' +
        '<div class="delete-desc">Сообщение исчезнет у всех участников</div>' +
      '</div>' +
    '</button>';
  }

  html += '</div>';

  openModal({
    title: "УДАЛИТЬ СООБЩЕНИЕ",
    html: html,
    confirmText: "",
    hideConfirm: true
  });
}

window.__deleteForMe = function(chatId, msgId) {
  hiddenMessages[chatId].add(msgId);
  const el = document.querySelector('[data-id="' + msgId + '"]');
  if (el) el.classList.add("msg-hidden");
  toast("Скрыто для тебя", "ok");
  closeModal();
};

window.__deleteForAll = async function(chatId, msgId) {
  try {
    await deleteDoc(doc(db, "chats", chatId, "messages", msgId));
    toast("Удалено для всех", "ok");
    closeModal();
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
};

async function pinMessage(chatId, msg) {
  const user = getCurrentUser();
  const isAdmin = ["emperor", "lord"].includes(user.role);
  if (!isAdmin) {
    toast("Только лидер и зам могут закреплять", "warn");
    return;
  }

  try {
    const pinRef = doc(db, "chats", chatId, "meta", "pin");
    await setDoc(pinRef, {
      msgId: msg.id,
      author: msg.authorLogin,
      text: (msg.text || "").substring(0, 100),
      fullText: msg.text || "",
      pinnedBy: user.login,
      pinnedAt: Date.now()
    });
    toast("Сообщение закреплено", "ok");
    updatePinBar(chatId, msg);
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
}

async function unpinMessage(chatId) {
  const user = getCurrentUser();
  const isAdmin = ["emperor", "lord"].includes(user.role);
  if (!isAdmin) {
    toast("Только лидер и зам могут откреплять", "warn");
    return;
  }

  try {
    const pinRef = doc(db, "chats", chatId, "meta", "pin");
    await deleteDoc(pinRef);
    toast("Сообщение откреплено", "ok");
    const bar = document.getElementById(CHATS[chatId].pinBarId);
    if (bar) bar.classList.remove("active");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
}

window.__chatUnpin = function(chatId) {
  unpinMessage(chatId);
};

async function loadPinned(chatId) {
  try {
    const pinRef = doc(db, "chats", chatId, "meta", "pin");
    const snap = await getDoc(pinRef);
    if (snap.exists()) {
      updatePinBar(chatId, snap.data());
    } else {
      const bar = document.getElementById(CHATS[chatId].pinBarId);
      if (bar) bar.classList.remove("active");
    }
  } catch (e) {
    console.warn("Pin load failed:", e);
  }
}

function updatePinBar(chatId, pinData) {
  const cfg = CHATS[chatId];
  if (!cfg) return;

  const bar = document.getElementById(cfg.pinBarId);
  const author = document.getElementById(cfg.pinAuthorId);
  const text = document.getElementById(cfg.pinTextId);

  if (!bar || !author || !text) return;

  author.textContent = pinData.author + (pinData.pinnedBy ? ' (закрепил ' + pinData.pinnedBy + ')' : '');
  text.textContent = pinData.fullText || pinData.text;
  bar.classList.add("active");

  bar.onclick = (e) => {
    if (e.target.classList.contains("pin-close")) return;
    scrollToMessage(chatId, pinData.msgId);
  };
}

// ==================== ПРОВЕРКА МУТА ====================
async function checkMutedFresh(user) {
  if (isMuted(user)) {
    const left = getMuteRemaining(user);
    toast("Вы в муте" + (left ? " ещё " + formatDuration(left) : "") + (user.mutedReason ? ". Причина: " + user.mutedReason : ""), "warn", 4000);
    return true;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return false;

    const fresh = snap.data();

    if (fresh.muted || fresh.mutedUntil || fresh.mutedReason) {
      const { setCurrentUser } = await import("../../core/state.js");
      const updated = {
        ...user,
        muted: fresh.muted || false,
        mutedUntil: fresh.mutedUntil || null,
        mutedReason: fresh.mutedReason || ""
      };
      setCurrentUser(updated);

      if (isMuted(updated)) {
        const left = getMuteRemaining(updated);
        toast("Вы в муте" + (left ? " ещё " + formatDuration(left) : "") + (updated.mutedReason ? ". Причина: " + updated.mutedReason : ""), "warn", 4000);
        return true;
      }
    }
  } catch (e) {
    console.warn("checkMutedFresh failed:", e);
  }

  return false;
}

// ==================== ОТПРАВКА ТЕКСТА ====================
async function sendMessageTo(chatId, text) {
  const user = getCurrentUser();
  if (!user || !text.trim()) return;

  const muted = await checkMutedFresh(user);
  if (muted) return;

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
    authorAvatar: user.avatar || null,
    replyTo: reply ? {
      id: reply.id,
      author: reply.authorLogin,
      text: (reply.text || "").substring(0, 80)
    } : null,
    reactions: {},
    createdAt: serverTimestamp()
  };

  try {
    const ref = await addDoc(collection(db, "chats", chatId, "messages"), newMsg);
    clearReplyForChat(chatId);
    markChatAsRead(chatId);

    // Своё сообщение — «прочитано»
    if (ref && ref.id) setLastRead(chatId, ref.id);

    const chatLabel = chatId === "allies" ? "Союз-чат" : "Чат";
    addDashEvent("💬", user.login + " (" + chatLabel + "): " + text.substring(0, 60), { type: "chat" })
      .catch(() => {});
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
}

// ==================== ОТПРАВКА ГОЛОСОВОГО ====================
async function sendVoiceTo(chatId, blob, durationMs, mime) {
  const user = getCurrentUser();
  if (!user) return;

  const muted = await checkMutedFresh(user);
  if (muted) return;

  if (user.role === "ally" && chatId === "residents") {
    toast("Союзники не могут писать в беседу резидентов", "warn");
    return;
  }

  const ext = (mime && mime.includes("ogg")) ? "ogg"
            : (mime && mime.includes("webm")) ? "webm"
            : (mime && mime.includes("mp4")) ? "m4a"
            : "webm";

  let url;
  try {
    const { uploadMedia } = await import("../contracts/contracts-upload.js");
    const file = new File([blob], "voice-" + Date.now() + "." + ext, { type: mime || "audio/webm" });
    const media = await uploadMedia(file, chatId, user.login, "🎤 Голосовое", "voice");
    url = media.url || media.vk_link;
    if (!url) throw new Error("Пустая ссылка на голосовое");
  } catch (e) {
    toast("Не удалось загрузить голосовое: " + e.message, "warn");
    return;
  }

  const reply = window.__currentReplies && window.__currentReplies[chatId];

  const newMsg = {
    type: "voice",
    text: "🎤 Голосовое сообщение",
    voiceUrl: url,
    voiceDuration: durationMs,
    authorId: user.uid,
    authorLogin: user.login,
    authorRole: user.role,
    authorAvatar: user.avatar || null,
    replyTo: reply ? {
      id: reply.id,
      author: reply.authorLogin,
      text: reply.text ? reply.text.substring(0, 80) : "🎤 Голосовое"
    } : null,
    reactions: {},
    createdAt: serverTimestamp()
  };

  try {
    const ref = await addDoc(collection(db, "chats", chatId, "messages"), newMsg);
    clearReplyForChat(chatId);
    markChatAsRead(chatId);
    if (ref && ref.id) setLastRead(chatId, ref.id);
    addDashEvent("🎤", user.login + ": голосовое " + Math.round(durationMs / 1000) + "с", { type: "chat" })
      .catch(() => {});
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
}

function setupInputForChat(chatId) {
  const cfg = CHATS[chatId];
  if (!cfg) return;

  const input = document.getElementById(cfg.inputId);
  const sendBtn = document.getElementById(cfg.sendId);
  const emojiBtn = document.getElementById(cfg.emojiBtnId);
  const emojiPicker = document.getElementById(cfg.emojiPickerId);

  if (!input || !sendBtn) return;

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
    try {
      setTyping(true);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => setTyping(false), 3000);
    } catch (e) {}
  });

  if (emojiBtn && emojiPicker) {
    emojiPicker.innerHTML = EMOJIS.map(e => '<button type="button">' + e + '</button>').join("");

    emojiPicker.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        input.value += btn.textContent;
        input.focus();
      });
    });

    emojiBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      emojiPicker.classList.toggle("active");
    });

    document.addEventListener("click", (e) => {
      if (emojiPicker.classList.contains("active") &&
          !emojiPicker.contains(e.target) &&
          e.target !== emojiBtn) {
        emojiPicker.classList.remove("active");
      }
    });
  }

  import("./chat-voice-ui.js")
    .then(m => m.setupVoiceForChat(chatId, sendVoiceTo))
    .catch(err => console.warn("Voice UI init failed:", err));

  import("./chat-files.js")
    .then(m => m.setupFileButton(chatId, () => {}))
    .catch(err => console.warn("File btn init failed:", err));

  import("./chat-polls.js")
    .then(m => m.setupPollButton(chatId, () => {}))
    .catch(err => console.warn("Poll btn init failed:", err));
}

// ==================== СКРОЛЛ ====================
function setupScroll(chatId) {
  setupScrollForChat(chatId);
  restoreLastRead(chatId);
}

function scrollToBottomForChat(chatId, force = false) {
  scrollToBottom(chatId, force);
}

// ==================== REPLY ====================
function setReplyToChat(chatId, msg) {
  const cfg = CHATS[chatId];
  if (!cfg) return;

  if (!window.__currentReplies) window.__currentReplies = {};
  window.__currentReplies[chatId] = msg;

  const bar = document.getElementById(cfg.replyBarId);
  const name = document.getElementById(cfg.replyNameId);
  const txt = document.getElementById(cfg.replyTextId);

  if (name) name.textContent = msg.authorLogin;
  if (txt) txt.textContent = msg.text ? msg.text.substring(0, 80) : "🎤 Голосовое";
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

// ==================== ТЕМА ====================
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

// ==================== ХЕЛПЕРЫ ====================
function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m > 0) return m + " мин";
  return s + " сек";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
