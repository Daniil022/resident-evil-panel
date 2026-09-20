// js/modules/user-stats.js
// Статистика по участнику: контракты, последнее сообщение, онлайн.

import { db } from "../firebase-init.js";
import {
  collection, getDocs, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/**
 * Считает контракты пользователя.
 * @returns {{submitted:number, approved:number, rejected:number, total:number}}
 */
export async function getContractStats(uid) {
  try {
    const snap = await getDocs(collection(db, "contracts"));
    let submitted = 0, approved = 0, rejected = 0;

    snap.forEach(d => {
      const c = d.data();
      if (c.submittedBy && c.submittedBy.uid === uid) {
        submitted++;
        if (c.status === "approved") approved++;
        if (c.status === "rejected") rejected++;
      }
    });

    return { submitted, approved, rejected, total: snap.size };
  } catch (e) {
    return { submitted: 0, approved: 0, rejected: 0, total: 0 };
  }
}

/**
 * Получает последнее сообщение пользователя в чатах.
 * @returns {{text:string, chatId:string, at:number}|null}
 */
export async function getLastMessage(uid) {
  const chatIds = ["residents", "allies"];

  let latest = null;

  for (const chatId of chatIds) {
    try {
      const msgsRef = collection(db, "chats", chatId, "messages");
      const q = query(msgsRef, orderBy("createdAt", "desc"), limit(50));
      const snap = await getDocs(q);

      snap.forEach(d => {
        const m = d.data();
        if (m.authorId !== uid) return;
        const t = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate().getTime() : 0;
        if (!latest || t > latest.at) {
          latest = {
            text: m.text || (m.type === "voice" ? "🎤 Голосовое" : "—"),
            chatId,
            at: t
          };
        }
      });
    } catch (e) {}
  }

  return latest;
}

/**
 * Получает онлайн-статус пользователя из presence.
 * @returns {{online:boolean, lastSeen:number|null}}
 */
export async function getPresence(uid) {
  try {
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await getDoc(doc(db, "presence", uid));
    if (!snap.exists()) return { online: false, lastSeen: null };
    const data = snap.data();
    return {
      online: !!data.online,
      lastSeen: data.lastSeen || null
    };
  } catch (e) {
    return { online: false, lastSeen: null };
  }
}

/**
 * Собирает всю статистику одним вызовом.
 */
export async function getUserStats(uid) {
  const [contracts, lastMessage, presence] = await Promise.all([
    getContractStats(uid),
    getLastMessage(uid),
    getPresence(uid)
  ]);
  return { contracts, lastMessage, presence };
}
