// js/core/sounds-panel.js
// Плашка «Настройки звука» — открывается по клику на 🔔 в шапке.

import { openModal, closeModal, toast } from "./utils.js";
import {
  getSoundSettings, saveSoundSettings, playSound
} from "./sounds.js";

export function openSoundSettings() {
  const s = getSoundSettings();

  openModal({
    title: "🔔 НАСТРОЙКИ ЗВУКА",
    html: `
      <div class="form-grid" style="grid-template-columns:1fr;">
        <div class="form-field">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
            <input type="checkbox" id="sndEnabled" ${s.enabled ? "checked" : ""}>
            <span>Звук включён</span>
          </label>
        </div>

        <div class="form-field">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
            <input type="checkbox" id="sndChat" ${s.chat ? "checked" : ""}>
            <span>💬 Чат</span>
          </label>
        </div>

        <div class="form-field">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
            <input type="checkbox" id="sndContract" ${s.contract ? "checked" : ""}>
            <span>📜 Контракты</span>
          </label>
        </div>

        <div class="form-field">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
            <input type="checkbox" id="sndApplication" ${s.application ? "checked" : ""}>
            <span>📥 Заявки</span>
          </label>
        </div>

        <div class="form-field">
          <label>Громкость</label>
          <input type="range" id="sndVolume" min="0" max="100" value="${Math.round(s.volume * 100)}">
          <div class="form-hint" id="sndVolumeVal">${Math.round(s.volume * 100)}%</div>
        </div>

        <div class="form-field" style="flex-direction:row;gap:8px;">
          <button class="btn secondary" id="sndTestChat" type="button">▶ Чат</button>
          <button class="btn secondary" id="sndTestContract" type="button">▶ Контракт</button>
          <button class="btn secondary" id="sndTestApplication" type="button">▶ Заявка</button>
        </div>
      </div>
    `,
    confirmText: "СОХРАНИТЬ",
    onConfirm: () => {
      saveSoundSettings({
        enabled:     document.getElementById("sndEnabled").checked,
        chat:        document.getElementById("sndChat").checked,
        contract:    document.getElementById("sndContract").checked,
        application: document.getElementById("sndApplication").checked,
        volume:      parseInt(document.getElementById("sndVolume").value) / 100
      });
      toast("Настройки звука сохранены", "ok");
      closeModal();
    }
  });

  // Живые обновления в модалке
  setTimeout(() => {
    const vol = document.getElementById("sndVolume");
    const volVal = document.getElementById("sndVolumeVal");
    if (vol) {
      vol.addEventListener("input", () => {
        volVal.textContent = vol.value + "%";
        saveSoundSettings({ volume: parseInt(vol.value) / 100 });
      });
    }

    const map = {
      sndEnabled: "enabled",
      sndChat: "chat",
      sndContract: "contract",
      sndApplication: "application"
    };
    Object.entries(map).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", () => {
        saveSoundSettings({ [key]: el.checked });
      });
    });

    document.getElementById("sndTestChat")?.addEventListener("click", () => playSound("chat"));
    document.getElementById("sndTestContract")?.addEventListener("click", () => playSound("contract"));
    document.getElementById("sndTestApplication")?.addEventListener("click", () => playSound("application"));
  }, 80);
}

// Кнопка в шапке
export function setupSoundButton() {
  const header = document.querySelector("header .header-status");
  if (!header || document.getElementById("soundBtn")) return;

  const btn = document.createElement("button");
  btn.id = "soundBtn";
  btn.className = "logout-btn";
  btn.style.marginRight = "8px";
  btn.title = "Настройки звука";
  btn.textContent = "🔔";
  btn.addEventListener("click", openSoundSettings);

  header.insertBefore(btn, header.firstChild);
}
