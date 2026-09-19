// js/modules/profile.js
import { db } from "../firebase-init.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { openModal, closeModal, toast } from "../core/utils.js";
import { uploadMedia } from "./contracts/contracts-upload.js";
import { getCurrentUser, setCurrentUser } from "../core/state.js";

export function openAvatarModal() {
  const me = getCurrentUser();
  if (!me) return;

  openModal({
    title: "ЗАГРУЗИТЬ АВАТАРКУ",
    html: '<div class="form-grid">' +
      '<div class="form-field" style="grid-column:1/-1;">' +
        '<label>Аватар</label>' +
        '<input type="file" id="avFile" accept="image/*">' +
        '<div class="form-hint">Фото уйдёт в ВК-беседу AVATARS</div>' +
      '</div>' +
      '<div class="form-field" style="grid-column:1/-1;">' +
        '<label>Или прямая ссылка</label>' +
        '<input type="text" id="avUrl" placeholder="https://..." autocomplete="off">' +
      '</div>' +
      '</div>' +
      '<div id="avError" style="color:var(--red);font-size:12px;display:none;"></div>',
    confirmText: "ЗАГРУЗИТЬ",
    onConfirm: () => saveAvatar()
  });
}

async function saveAvatar() {
  const me = getCurrentUser();
  if (!me) return;

  const file = document.getElementById("avFile").files[0];
  const urlInput = document.getElementById("avUrl").value.trim();
  const err = document.getElementById("avError");

  err.style.display = "none";

  if (!file && !urlInput) {
    err.textContent = "Выберите файл или вставьте ссылку";
    err.style.display = "block";
    return;
  }

  let avatarUrl = urlInput;

  if (file) {
    err.textContent = "Загрузка в ВК...";
    err.style.color = "var(--cyan)";
    err.style.display = "block";
    try {
      const media = await uploadMedia(file, "avatar", me.login, "Аватар: " + me.login, "avatar");
      avatarUrl = media.url;
      console.log("Avatar uploaded:", avatarUrl);
    } catch (e) {
      err.textContent = e.message;
      err.style.color = "var(--red)";
      return;
    }
  }

  if (!/^https?:\/\//.test(avatarUrl)) {
    err.textContent = "Неверная ссылка";
    err.style.color = "var(--red)";
    err.style.display = "block";
    return;
  }

  try {
    await updateDoc(doc(db, "users", me.uid), { avatar: avatarUrl });
  } catch (e) {
    const demoUsers = JSON.parse(localStorage.getItem("re_panel_demo_users") || "[]");
    const idx = demoUsers.findIndex(u => u.uid === me.uid);
    if (idx >= 0) {
      demoUsers[idx].avatar = avatarUrl;
      localStorage.setItem("re_panel_demo_users", JSON.stringify(demoUsers));
    }
  }

  me.avatar = avatarUrl;
  setCurrentUser(me);

  updateHeaderAvatar(me);
  updateDashAvatar(me);

  toast("Аватар обновлён", "ok");
  closeModal();
}

export function updateHeaderAvatar(user) {
  const el = document.getElementById("userAvatar");
  if (!el) return;
  if (user.avatar) {
    el.innerHTML = '<img src="' + user.avatar + '" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
    el.style.padding = "0";
    el.style.overflow = "hidden";
  } else {
    el.textContent = user.login.charAt(0).toUpperCase();
  }
}

export function updateDashAvatar(user) {
  const el = document.getElementById("dashAvatar");
  if (!el) return;
  if (user.avatar) {
    el.innerHTML = '<img src="' + user.avatar + '" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
    el.style.padding = "0";
    el.style.overflow = "hidden";
    el.style.background = "transparent";
  }
}

export function setupAvatarClick() {
  const avatarEl = document.getElementById("userAvatar");
  const metaEl = document.getElementById("userMeta");

  if (avatarEl && !avatarEl.__bound) {
    avatarEl.__bound = true;
    avatarEl.style.cursor = "pointer";
    avatarEl.title = "Клик — загрузить аватарку";
    avatarEl.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      openAvatarModal();
    });
  }

  if (metaEl && !metaEl.__bound) {
    metaEl.__bound = true;
    metaEl.style.cursor = "pointer";
    metaEl.title = "Клик — открыть профиль";
    metaEl.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (typeof window.__openMyProfile === "function") {
        window.__openMyProfile();
      }
    });
  }
}

window.__forceOpenAvatarModal = function() {
  openAvatarModal();
};
window.__openAvatarModalReal = openAvatarModal;
