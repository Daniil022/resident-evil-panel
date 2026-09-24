// js/modules/chat/chat-polls.js
// Создание опросов и голосование.

import { db } from "../../firebase-init.js";
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getCurrentUser } from "../../core/state.js";
import { openModal, closeModal, toast } from "../../core/utils.js";

export function setupPollButton(chatId, onSent) {
  const panelId = chatId === "allies" ? "chat-allies" : "chat";
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const inputWrap = panel.querySelector(".chat-input");
  if (!inputWrap) return;

  const btnId = "pollBtn-" + chatId;
  if (document.getElementById(btnId)) return;

  const btn = document.createElement("button");
  btn.id = btnId;
  btn.className = "emoji-btn poll-btn";
  btn.type = "button";
  btn.title = "Создать опрос";
  btn.textContent = "📊";

  const sendBtn = inputWrap.querySelector(".send-btn");
  inputWrap.insertBefore(btn, sendBtn);

  btn.addEventListener("click", () => openPollModal(chatId, onSent));
}

function openPollModal(chatId, onSent) {
  openModal({
    title: "СОЗДАТЬ ОПРОС",
    html:
      '<div class="form-grid">' +
        '<div class="form-field" style="grid-column:1/-1;">' +
          '<label>Вопрос</label>' +
          '<input type="text" id="pollQuestion" placeholder="Идём на ивент в 20:00?" autocomplete="off" maxlength="200">' +
        '</div>' +
        '<div class="form-field" style="grid-column:1/-1;">' +
          '<label>Варианты (от 2 до 6)</label>' +
          '<div id="pollOptions">' +
            '<input type="text" class="poll-option-input" placeholder="Вариант 1" maxlength="80" style="margin-bottom:6px;width:100%;">' +
            '<input type="text" class="poll-option-input" placeholder="Вариант 2" maxlength="80" style="margin-bottom:6px;width:100%;">' +
          '</div>' +
          '<button type="button" class="btn small secondary" id="addPollOption" style="margin-top:6px;">+ Ещё вариант</button>' +
        '</div>' +
        '<div class="form-field" style="grid-column:1/-1;">' +
          '<label><input type="checkbox" id="pollMulti"> Разрешить несколько ответов</label>' +
        '</div>' +
      '</div>' +
      '<div id="pollError" style="color:var(--red);font-size:12px;display:none;"></div>',
    confirmText: "СОЗДАТЬ",
    onConfirm: () => savePoll(chatId, onSent)
  });

  setTimeout(() => {
    document.getElementById("pollQuestion")?.focus();
    document.getElementById("addPollOption")?.addEventListener("click", () => {
      const container = document.getElementById("pollOptions");
      const count = container.querySelectorAll(".poll-option-input").length;
      if (count >= 6) return toast("Максимум 6 вариантов", "warn");
      const input = document.createElement("input");
      input.type = "text";
      input.className = "poll-option-input";
      input.placeholder = "Вариант " + (count + 1);
      input.maxLength = 80;
      input.style.marginBottom = "6px";
      input.style.width = "100%";
      container.appendChild(input);
      input.focus();
    });
  }, 80);
}

async function savePoll(chatId, onSent) {
  const user = getCurrentUser();
  if (!user) return;

  const question = document.getElementById("pollQuestion").value.trim();
  const multi = document.getElementById("pollMulti").checked;
  const options = Array.from(document.querySelectorAll(".poll-option-input"))
    .map(i => i.value.trim())
    .filter(v => v.length > 0);

  const err = document.getElementById("pollError");

  if (!question) { err.textContent = "Введите вопрос"; err.style.display = "block"; return; }
  if (options.length < 2) { err.textContent = "Минимум 2 варианта"; err.style.display = "block"; return; }

  // Проверка мута из кэша (без динамического импорта)
  const isMuted = user.muted && (!user.mutedUntil || Date.now() < user.mutedUntil);
  if (isMuted) {
    toast("Вы в муте", "warn");
    return;
  }

  const newMsg = {
    type: "poll",
    text: "📊 " + question,
    poll: {
      question,
      options: options.map((label, idx) => ({ id: "opt-" + idx, label, votes: [] })),
      multi,
      closed: false
    },
    authorId: user.uid,
    authorLogin: user.login,
    authorRole: user.role,
    authorAvatar: user.avatar || null,
    reactions: {},
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "chats", chatId, "messages"), newMsg);
    if (onSent) onSent();
    closeModal();
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
}

export async function votePoll(chatId, msgId, optionId) {
  const user = getCurrentUser();
  if (!user) return;

  try {
    const msgRef = doc(db, "chats", chatId, "messages", msgId);
    const snap = await getDoc(msgRef);
    if (!snap.exists()) return;

    const data = snap.data();
    if (!data.poll) return;
    if (data.poll.closed) {
      toast("Опрос закрыт", "warn");
      return;
    }

    const options = data.poll.options.map(o => ({ ...o, votes: o.votes.slice() }));
    const multi = data.poll.multi;

    for (const opt of options) {
      const idx = opt.votes.indexOf(user.uid);

      if (opt.id === optionId) {
        if (idx >= 0) opt.votes.splice(idx, 1);
        else opt.votes.push(user.uid);
      } else if (!multi && idx >= 0) {
        opt.votes.splice(idx, 1);
      }
    }

    await updateDoc(msgRef, { "poll.options": options });
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
}

export async function closePoll(chatId, msgId) {
  const user = getCurrentUser();
  if (!user) return;

  try {
    const msgRef = doc(db, "chats", chatId, "messages", msgId);
    const snap = await getDoc(msgRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const isAdmin = ["emperor", "lord"].includes(user.role);
    if (data.authorId !== user.uid && !isAdmin) {
      toast("Только автор или админ", "warn");
      return;
    }

    await updateDoc(msgRef, { "poll.closed": true });
    toast("Опрос закрыт", "ok");
  } catch (e) {
    toast("Ошибка: " + e.message, "warn");
  }
}
