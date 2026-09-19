// js/modules/chat/chat-voice-ui.js
import {
  isVoiceSupported, startRecording, stopRecording, cancelRecording,
  formatDuration, VOICE_MAX_MS
} from "./chat-voice.js";

// chatId -> { sendVoice } — колбэк
const senders = {};

export function setupVoiceForChat(chatId, sendVoice) {
  senders[chatId] = sendVoice;

  if (!isVoiceSupported()) return;

  const panelId = chatId === "allies" ? "chat-allies" : "chat";
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const inputWrap = panel.querySelector(".chat-input");
  if (!inputWrap) return;

  const btnId = "voiceBtn-" + chatId;
  if (document.getElementById(btnId)) return;

  const btn = document.createElement("button");
  btn.id = btnId;
  btn.className = "emoji-btn voice-btn";
  btn.type = "button";
  btn.title = "Удерживай для записи голосового";
  btn.textContent = "🎤";

  const sendBtn = inputWrap.querySelector(".send-btn");
  inputWrap.insertBefore(btn, sendBtn);

  // Превью
  const preview = document.createElement("div");
  preview.id = "voicePreview-" + chatId;
  preview.className = "voice-preview";
  preview.style.display = "none";
  preview.innerHTML =
    '<span class="vp-dot"></span>' +
    '<span class="vp-time">0:00</span>' +
    '<span class="vp-hint">Отпусти — отправить, свайп влево — отменить</span>' +
    '<button class="vp-cancel" type="button">✕</button>';
  inputWrap.parentElement.insertBefore(preview, inputWrap);

  let startX = 0;
  let cancelled = false;
  let recording = false;

  const onStart = async (e) => {
    if (recording) return;
    e.preventDefault();
    startX = (e.clientX != null) ? e.clientX : (e.touches?.[0]?.clientX ?? 0);
    cancelled = false;

    const ok = await startRecording({
      onTick: (ms) => {
        const t = preview.querySelector(".vp-time");
        if (t) t.textContent = formatDuration(ms);
      },
      onStop: async ({ blob, durationMs }) => {
        preview.style.display = "none";
        preview.classList.remove("cancel");
        recording = false;
        btn.classList.remove("recording");

        if (cancelled || durationMs < 800) return;
        const sender = senders[chatId];
        if (sender) {
          try { await sender(chatId, blob, durationMs); }
          catch (err) { console.warn("Voice send failed:", err); }
        }
      },
      onError: (msg) => {
        preview.style.display = "none";
        recording = false;
        btn.classList.remove("recording");
        console.warn(msg);
      }
    });

    if (ok) {
      recording = true;
      btn.classList.add("recording");
      preview.style.display = "flex";
      preview.classList.remove("cancel");
      const t = preview.querySelector(".vp-time");
      if (t) t.textContent = "0:00";
    }
  };

  const onMove = (e) => {
    if (!recording) return;
    const x = (e.clientX != null) ? e.clientX : (e.touches?.[0]?.clientX ?? 0);
    if (startX - x > 80) {
      cancelled = true;
      preview.classList.add("cancel");
    } else {
      cancelled = false;
      preview.classList.remove("cancel");
    }
  };

  const onEnd = () => {
    if (!recording) return;
    stopRecording();
  };

  btn.addEventListener("mousedown", onStart);
  btn.addEventListener("touchstart", onStart, { passive: false });
  document.addEventListener("mousemove", onMove);
  document.addEventListener("touchmove", onMove, { passive: true });
  document.addEventListener("mouseup", onEnd);
  document.addEventListener("touchend", onEnd);

  const cancelBtn = preview.querySelector(".vp-cancel");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      cancelled = true;
      cancelRecording();
      preview.style.display = "none";
      preview.classList.remove("cancel");
      recording = false;
      btn.classList.remove("recording");
    });
  }
}
