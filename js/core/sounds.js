// js/core/sounds.js
// Аудио-уведомления: разные звуки для чата / контрактов / заявок.
// Генерируются через WebAudio — без внешних файлов.

const SETTINGS_KEY = "re_panel_sound_settings";

const DEFAULTS = {
  enabled: true,        // общий выключатель
  volume: 0.5,          // 0..1
  chat: true,           // звук чата
  contract: true,       // звук контрактов
  application: true     // звук заявок
};

let settings = { ...DEFAULTS };
let audioCtx = null;

// ==================== НАСТРОЙКИ ====================
export function loadSoundSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) settings = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) {}
  return settings;
}

export function saveSoundSettings(patch) {
  settings = { ...settings, ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("soundSettingsChange", { detail: settings }));
  return settings;
}

export function getSoundSettings() {
  return { ...settings };
}

// ==================== ЯДРО ====================
function getCtx() {
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioCtx = new AudioCtx();
  }
  // Браузеры блокируют звук до первого клика — пробуем разбудить
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Проиграть один тон.
 * @param {number} freq    — частота (Гц)
 * @param {number} start   — задержка старта (сек)
 * @param {number} dur     — длительность (сек)
 * @param {string} type    — sine / square / triangle / sawtooth
 * @param {number} gain    — множитель громкости тона (0..1)
 */
function tone(freq, start, dur, type = "sine", gain = 1) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;

  const t0 = ctx.currentTime + start;
  const vol = Math.max(0, Math.min(1, settings.volume)) * gain * 0.25;

  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// ==================== ПАТТЕРНЫ ====================
// Чат — короткий «дзынь» вверх (как сообщение)
function playChat() {
  tone(880, 0,    0.10, "sine", 1);
  tone(1175, 0.08, 0.14, "sine", 0.9);
}

// Контракт — уверенный двойной «бас-бит» (как награда)
function playContract() {
  tone(330, 0,    0.12, "triangle", 1);
  tone(440, 0.10, 0.16, "triangle", 0.9);
  tone(660, 0.22, 0.22, "triangle", 0.7);
}

// Заявка — мягкий «колокольчик» (как запрос)
function playApplication() {
  tone(660, 0,    0.18, "sine", 0.9);
  tone(990, 0.14, 0.28, "sine", 0.6);
}

// ==================== ПУБЛИЧНОЕ API ====================
export function playSound(kind) {
  if (!settings.enabled) return;
  if (kind === "chat" && !settings.chat) return;
  if (kind === "contract" && !settings.contract) return;
  if (kind === "application" && !settings.application) return;

  switch (kind) {
    case "chat":        playChat();        break;
    case "contract":    playContract();    break;
    case "application": playApplication(); break;
    default:            playChat();
  }
}

// Разбудить аудио-контекст после первого клика пользователя
export function unlockAudio() {
  getCtx();
  document.removeEventListener("click", unlockAudio);
  document.removeEventListener("touchstart", unlockAudio);
}

export function initSounds() {
  loadSoundSettings();
  document.addEventListener("click", unlockAudio, { once: false });
  document.addEventListener("touchstart", unlockAudio, { once: false });
}
