// js/modules/chat/chat-voice.js
// Запись и отправка голосовых сообщений через MediaRecorder.

const MAX_DURATION_MS = 2 * 60 * 1000; // 2 минуты
const MIME_CANDIDATES = [
  "audio/ogg;codecs=opus",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4"
];

let mediaRecorder = null;
let mediaStream = null;
let chunks = [];
let startTime = 0;
let timerInterval = null;
let autoStopTimer = null;
let onFinish = null;
let onCancel = null;
let selectedMime = "";

function pickMime() {
  if (!window.MediaRecorder) return null;
  for (const m of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

export function isVoiceSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

export function getVoiceMime() {
  return selectedMime;
}

export async function startRecording({ onTick, onStop, onError } = {}) {
  if (!isVoiceSupported()) {
    onError && onError("Запись голоса не поддерживается браузером");
    return false;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    onError && onError("Нет доступа к микрофону");
    return false;
  }

  const mime = pickMime();
  selectedMime = mime || "audio/webm";
  try {
    mediaRecorder = mime
      ? new MediaRecorder(mediaStream, { mimeType: mime })
      : new MediaRecorder(mediaStream);
  } catch (e) {
    onError && onError("Ошибка MediaRecorder: " + e.message);
    cleanupStream();
    return false;
  }

  chunks = [];
  startTime = Date.now();
  onFinish = onStop || null;

  mediaRecorder.addEventListener("dataavailable", (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  });

  mediaRecorder.addEventListener("stop", () => {
    const durationMs = Date.now() - startTime;
    const blob = new Blob(chunks, { type: selectedMime || "audio/webm" });
    cleanupStream();
    clearTimers();
    if (onFinish) onFinish({ blob, durationMs, mime: selectedMime });
  });

  mediaRecorder.start();

  timerInterval = setInterval(() => {
    const ms = Date.now() - startTime;
    onTick && onTick(ms);
  }, 100);

  autoStopTimer = setTimeout(() => {
    stopRecording();
  }, MAX_DURATION_MS);

  return true;
}

export function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    try { mediaRecorder.stop(); } catch (e) {}
  }
}

export function cancelRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    try {
      mediaRecorder.addEventListener("stop", () => {
        if (onCancel) onCancel();
      }, { once: true });
      mediaRecorder.stop();
    } catch (e) {}
  }
  cleanupStream();
  clearTimers();
}

function cleanupStream() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  mediaRecorder = null;
}

function clearTimers() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (autoStopTimer) { clearTimeout(autoStopTimer); autoStopTimer = null; }
}

export function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ":" + String(s).padStart(2, "0");
}

export const VOICE_MAX_MS = MAX_DURATION_MS;
