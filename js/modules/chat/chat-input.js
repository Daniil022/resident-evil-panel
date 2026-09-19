// js/modules/chat/chat-input.js
import {
  isVoiceSupported, startRecording, stopRecording, cancelRecording,
  formatDuration
} from "./chat-voice.js";

let onSend = null;
let onTyping = null;
let onSendVoice = null;   // колбэк для отправки голосового
let currentReply = null;
let isRecording = false;

const EMOJI_LIST = [
  "😀","😂","🤣","😊","😎","🤔","😴","😡","🥶","🤯",
  "❤️","🔥","💀","⚔️","🛡️","🏆","🎯","💰","💎","⚠️",
  "👍","👎","👏","🙏","💪","✊","🤝","🖕","✌️","👀",
  "☣️","🧬","🩸","🧟","👻","🎃","🌑","⚡","❄️","☠️"
];

export function setupInput(sendFn, typingFn, voiceFn) {
  onSend = sendFn;
  onTyping = typingFn;
  onSendVoice = voiceFn || null;

  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSend");
  const emojiBtn = document.getElementById("emojiBtn");
  const emojiPicker = document.getElementById("emojiPicker");
  const replyBar = document.getElementById("chatReplyBar");

  if (!input || !sendBtn) return;

  // Отправка текста
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

  // ==================== ГОЛОСОВЫЕ ====================
  setupVoiceButton();
}

function setupVoiceButton() {
  if (!isVoiceSupported()) return;

  const inputWrap = document.querySelector("#chat .chat-input");
  if (!inputWrap || document.getElementById("voiceBtn")) return;

  const btn = document.createElement("button");
  btn.id = "voiceBtn";
  btn.className = "emoji-btn voice-btn";
  btn.type = "button";
  btn.title = "Удерживай для записи голосового";
  btn.textContent = "🎤";

  const sendBtn = document.getElementById("chatSend");
  inputWrap.insertBefore(btn, sendBtn);

  // Превью-бар (скрыт по умолчанию)
  const preview = document.createElement("div");
  preview.id = "voicePreview";
  preview.className = "voice-preview";
  preview.style.display = "none";
  preview.innerHTML =
    '<span class="vp-dot"></span>' +
    '<span class="vp-time" id="voiceTime">0:00</span>' +
    '<span class="vp-hint">Отпусти — отправить, свайп влево — отменить</span>' +
    '<button class="vp-cancel" id="voiceCancel" type="button">✕</button>';
  inputWrap.parentElement.insertBefore(preview, inputWrap);

  let pointerStartX = 0;
  let pointerMoved = false;

  const begin = async (e) => {
    if (isRecording) return;
    e.preventDefault();
    pointerStartX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    pointerMoved = false;

    const ok = await startRecording({
      onTick: (ms) => {
        const t = document.getElementById("voiceTime");
        if (t) t.textContent = formatDuration(ms);
      },
      onStop: async ({ blob, durationMs }) => {
        hidePreview();
        isRecording = false;
        btn.classList.remove("recording");

        if (durationMs < 800) {
          // слишком короткое — не отправляем
          return;
        }
        if (pointerMoved) {
          // отменено свайпом
          return;
        }
        if (onSendVoice) {
          try { await onSendVoice(blob, durationMs); }
          catch (err) { console.warn("Voice send failed:", err); }
        }
      },
      onError: (msg) => {
        hidePreview();
        isRecording = false;
        btn.classList.remove("recording");
        console.warn(msg);
      }
    });

    if (ok) {
      isRecording = true;
      btn.classList.add("recording");
      showPreview();
    }
  };

  const move = (e) => {
    if (!isRecording) return;
    const x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    if (pointerStartX - x > 80) {
      pointerMoved = true;
      const p = document.getElementById("voicePreview");
      if (p) p.classList.add("cancel");
    } else {
      const p = document.getElementById("voicePreview");
      if (p) p.classList.remove("cancel");
    }
  };

  const end = (e) => {
    if (!isRecording) return;
    stopRecording();
  };

  btn.addEventListener("mousedown", begin);
  btn.addEventListener("touchstart", begin, { passive: false });
  document.addEventListener("mousemove", move);
  document.addEventListener("touchmove", move, { passive: true });
  document.addEventListener("mouseup", end);
  document.addEventListener("touchend", end);

  const cancelBtn = document.getElementById("voiceCancel");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      pointerMoved = true;
      cancelRecording();
      hidePreview();
      isRecording = false;
      btn.classList.remove("recording");
    });
  }
}

function showPreview() {
  const p = document.getElementById("voicePreview");
  const t = document.getElementById("voiceTime");
  if (p) { p.style.display = "flex"; p.classList.remove("cancel"); }
  if (t) t.textContent = "0:00";
}
function hidePreview() {
  const p = document.getElementById("voicePreview");
  if (p) { p.style.display = "none"; p.classList.remove("cancel"); }
}

export function setReplyTo(msg) {
  currentReply = msg;
  window.__currentReply = msg;

  const bar = document.getElementById("chatReplyBar");
  const name = document.getElementById("replyToName");
  const txt = document.getElementById("replyToText");

  if (name) name.textContent = msg.authorLogin;
  if (txt) txt.textContent = msg.text ? msg.text.substring(0, 80) : "🎤 Голосовое";
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
