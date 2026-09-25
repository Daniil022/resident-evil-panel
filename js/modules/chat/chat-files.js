// js/modules/chat/chat-files.js
// Отправка файлов в чат (фото, видео, документы).

import { db } from "../../firebase-init.js";
import { collection, addDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getCurrentUser } from "../../core/state.js";
import { toast } from "../../core/utils.js";
import { uploadMedia } from "../contracts/contracts-upload.js";
import { addDashEvent } from "../../core/dashboard-events.js";
import { compressImage } from "../../core/image-compress.js";

const MAX_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 5;

export function setupFileButton(chatId, onSent) {
  const panelId = chatId === "allies" ? "chat-allies" : "chat";
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const inputWrap = panel.querySelector(".chat-input");
  if (!inputWrap) return;

  const btnId = "fileBtn-" + chatId;
  if (document.getElementById(btnId)) return;

  const btn = document.createElement("button");
  btn.id = btnId;
  btn.className = "emoji-btn file-btn";
  btn.type = "button";
  btn.title = "Прикрепить файл";
  btn.textContent = "📎";

  const sendBtn = inputWrap.querySelector(".send-btn");
  inputWrap.insertBefore(btn, sendBtn);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.multiple = true;
  fileInput.accept = "image/*,video/*,audio/*,.pdf,.doc,.docx,.zip,.rar,.txt";
  fileInput.style.display = "none";
  fileInput.id = "fileInput-" + chatId;
  panel.appendChild(fileInput);

  btn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const files = Array.from(fileInput.files || []);
    fileInput.value = "";
    if (files.length === 0) return;
    await sendFiles(chatId, files, onSent);
  });
}

async function sendFiles(chatId, files, onSent) {
  const user = getCurrentUser();
  if (!user) return;

  const isMuted = user.muted && (!user.mutedUntil || Date.now() < user.mutedUntil);
  if (isMuted) {
    const left = user.mutedUntil ? Math.max(0, user.mutedUntil - Date.now()) : 0;
    toast("Вы в муте" + (left ? " ещё " + formatDuration(left) : ""), "warn", 4000);
    return;
  }

  if (user.role === "ally" && chatId === "residents") {
    toast("Союзники не могут писать в беседу резидентов", "warn");
    return;
  }

  if (files.length > MAX_FILES) {
    toast("Максимум " + MAX_FILES + " файлов за раз", "warn");
    return;
  }

  for (const file of files) {
    if (file.size > MAX_SIZE) {
      toast("Файл «" + file.name + "» больше 50 МБ", "warn");
      return;
    }
  }

  toast("Загрузка файлов...", "info", 2000);

  const attachments = [];

  for (const file of files) {
    try {
      let processedFile = file;
      if (file.type.startsWith("image/")) {
        try {
          processedFile = await compressImage(file);
        } catch (e) {
          console.warn("Compress failed:", e);
          processedFile = file;
        }
      }

      const media = await uploadMedia(
        processedFile,
        chatId,
        user.login,
        "📎 " + file.name,
        "chat"
      );

      const type = processedFile.type.startsWith("image") ? "image"
                 : processedFile.type.startsWith("video") ? "video"
                 : processedFile.type.startsWith("audio") ? "audio"
                 : "file";

      attachments.push({
        url: media.url || media.vk_link,
        vk_link: media.vk_link,
        name: file.name,
        size: processedFile.size,
        mime: processedFile.type,
        type
      });
    } catch (e) {
      toast("Ошибка загрузки «" + file.name + "»: " + e.message, "warn");
    }
  }

  if (attachments.length === 0) return;

  const reply = window.__currentReplies && window.__currentReplies[chatId];

  const newMsg = {
    type: "attachments",
    text: "📎 " + attachments.map(a => a.name).join(", "),
    attachments,
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
    await addDoc(collection(db, "chats", chatId, "messages"), newMsg);
    if (onSent) onSent();
    addDashEvent("📎", user.login + ": " + attachments.length + " файл(ов)", { type: "chat" });
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
}

function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  if (m > 0) return m + " мин";
  return (total % 60) + " сек";
}
