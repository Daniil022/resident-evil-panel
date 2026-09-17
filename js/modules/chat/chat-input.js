// js/modules/chat/chat-input.js

let onSend = null;
let onTyping = null;
let currentReply = null;

const EMOJI_LIST = [
  "😀","😂","🤣","😊","😎","🤔","😴","😡","🥶","🤯",
  "❤️","🔥","💀","⚔️","🛡️","🏆","🎯","💰","💎","⚠️",
  "👍","👎","👏","🙏","💪","✊","🤝","🖕","✌️","👀",
  "☣️","🧬","🩸","🧟","👻","🎃","🌑","⚡","❄️","☠️"
];

export function setupInput(sendFn, typingFn) {
  onSend = sendFn;
  onTyping = typingFn;

  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSend");
  const emojiBtn = document.getElementById("emojiBtn");
  const emojiPicker = document.getElementById("emojiPicker");
  const replyBar = document.getElementById("chatReplyBar");

  if (!input || !sendBtn) return;

  // Отправка
  sendBtn.addEventListener("click", () => doSend());
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });

  // Индикатор «печатает»
  let typingSent = false;
  input.addEventListener("input", () => {
    if (!typingSent) {
      typingSent = true;
      if (onTyping) onTyping();
      setTimeout(() => { typingSent = false; }, 2000);
    }
  });

  // Эмодзи-пикер
  if (emojiBtn && emojiPicker) {
    emojiPicker.innerHTML = EMOJI_LIST.map(e =>
      `<button type="button">${e}</button>`
    ).join("");
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

  // Reply clear
  window.__clearReply = () => {
    currentReply = null;
    if (replyBar) replyBar.classList.remove("active");
  };

  // Reply по клику на цитату внутри сообщения
  document.addEventListener("click", (e) => {
    const reply = e.target.closest(".msg-reply");
    if (!reply) return;
    const msgId = reply.dataset.replyId;
    if (msgId) {
      // прокрутка к оригиналу
      import("./chat-scroll.js").then(m => m.scrollToMessage(msgId));
    }
  });

  async function doSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    await onSend(text);
    window.__clearReply();
  }
}

export function setReplyTo(msg) {
  currentReply = msg;
  window.__currentReply = msg;

  const bar = document.getElementById("chatReplyBar");
  const name = document.getElementById("replyToName");
  const txt = document.getElementById("replyToText");

  if (name) name.textContent = msg.authorLogin;
  if (txt) txt.textContent = msg.text.substring(0, 80);
  if (bar) bar.classList.add("active");

  const input = document.getElementById("chatInput");
  if (input) input.focus();
}

export function clearReply() {
  currentReply = null;
  window.__currentReply = null;
  const bar = document.getElementById("chatReplyBar");
  if (bar) bar.classList.remove("active");
}
