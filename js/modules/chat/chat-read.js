// js/modules/chat/chat-read.js
import { db } from "../../firebase-init.js";
import {
  doc, setDoc, getDoc, onSnapshot, collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getCurrentUser } from "../../core/state.js";

const unsubscribers = { residents: null, allies: null };

// Отметить чат как прочитанный
export async function markChatRead(chatId) {
  const user = getCurrentUser();
  if (!user) return;

  try {
    const readRef = doc(db, "chats", chatId, "reads", user.uid);
    await setDoc(readRef, {
      lastReadAt: Date.now(),
      login: user.login
    }, { merge: true });
  } catch (e) {
    console.warn("Mark read failed:", e);
  }
}

// Подписка на прочтения других — чтобы показывать ✓✓
export function subscribeReadStatus(chatId) {
  const user = getCurrentUser();
  if (!user) return;

  // Отписываемся от старой подписки
  if (unsubscribers[chatId]) {
    unsubscribers[chatId]();
    unsubscribers[chatId] = null;
  }

  try {
    const readsRef = collection(db, "chats", chatId, "reads");
    unsubscribers[chatId] = onSnapshot(readsRef, (snap) => {
      const reads = {};
      snap.forEach(d => {
        reads[d.id] = d.data();
      });
      window.__chatReads = window.__chatReads || {};
      window.__chatReads[chatId] = reads;
      updateAllChecks(chatId, reads);
    });
  } catch (e) {
    console.warn("Subscribe reads failed:", e);
  }
}

// Обновить галочки у всех своих сообщений
function updateAllChecks(chatId, reads) {
  const user = getCurrentUser();
  if (!user) return;

  const panelId = chatId === "allies" ? "chat-allies" : "chat";
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const messages = panel.querySelectorAll(".msg-own");
  messages.forEach(el => {
    const msgId = el.dataset.id;
    if (!msgId) return;

    // Проверяем — прочитал ли кто-то (кроме нас)
    let someoneRead = false;
    for (const [uid, data] of Object.entries(reads)) {
      if (uid === user.uid) continue;
      if (data.lastReadAt) {
        // Кто-то зашёл после нас
        someoneRead = true;
        break;
      }
    }

    // Обновляем галочки
    let checks = el.querySelector(".msg-checks");
    if (!checks) {
      const time = el.querySelector(".msg-time");
      if (time) {
        checks = document.createElement("span");
        checks.className = "msg-checks";
        time.appendChild(checks);
      }
    }
    if (checks) {
      checks.textContent = someoneRead ? " ✓✓" : " ✓";
      checks.style.color = someoneRead ? "var(--green)" : "inherit";
    }
  });
}

export function destroyReadSubs() {
  for (const id of Object.keys(unsubscribers)) {
    if (unsubscribers[id]) unsubscribers[id]();
  }
}
