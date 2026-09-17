// js/modules/chat/chat-reactions.js
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "../../firebase-init.js";
import { getCurrentUser } from "../../core/state.js";

const CHAT_ID = "main";

export async function toggleReaction(msgId, emoji) {
  const user = getCurrentUser();
  if (!user) return;

  try {
    const msgRef = doc(db, "chats", CHAT_ID, "messages", msgId);
    const snap = await getDoc(msgRef);
    if (!snap.exists()) return;

    const reactions = snap.data().reactions || {};
    const users = reactions[emoji] || [];

    if (users.includes(user.uid)) {
      await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayRemove(user.uid) });
    } else {
      await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(user.uid) });
    }
  } catch (e) {
    console.warn("Не удалось обновить реакцию (демо-режим):", e.message);
    // Демо-режим — обновим локально
    const el = document.querySelector(`[data-id="${msgId}"]`);
    if (el) {
      // мини-визуальный отклик
      el.style.background = "rgba(193,18,31,0.3)";
      setTimeout(() => { el.style.background = ""; }, 400);
    }
  }
}
