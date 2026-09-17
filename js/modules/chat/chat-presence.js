// js/modules/chat/chat-presence.js
import { doc, setDoc, onSnapshot, collection }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "../../firebase-init.js";
import { getCurrentUser } from "../../core/state.js";

let presenceUnsub = null;
let heartbeatTimer = null;
let demoHeartbeat = null;

export function setupPresence() {
  const user = getCurrentUser();
  if (!user) return;

  try {
    const presenceRef = doc(db, "presence", user.uid);

    setDoc(presenceRef, {
      login: user.login,
      role: user.role,
      online: true,
      typing: false,
      lastSeen: Date.now()
    }, { merge: true }).catch(() => {});

    heartbeatTimer = setInterval(() => {
      setDoc(presenceRef, { lastSeen: Date.now() }, { merge: true }).catch(() => {});
    }, 30000);

    window.addEventListener("beforeunload", () => {
      setDoc(presenceRef, { online: false, typing: false }, { merge: true }).catch(() => {});
    });

    presenceUnsub = onSnapshot(collection(db, "presence"), (snap) => {
      const typers = [];
      let onlineCount = 0;
      snap.forEach(d => {
        const data = d.data();
        if (data.online) onlineCount++;
        if (d.id !== user.uid && data.typing && data.online) {
          typers.push(data.login);
        }
      });
      renderTyping(typers);
      window.dispatchEvent(new CustomEvent("presenceUpdate", {
        detail: { online: onlineCount, total: snap.size }
      }));
    });
  } catch (e) {
    console.warn("Presence в демо-режиме");
    // Демо: локальный heartbeat
    window.dispatchEvent(new CustomEvent("presenceUpdate", {
      detail: { online: 3, total: 5 }
    }));
  }
}

export async function setTyping(isTyping) {
  const user = getCurrentUser();
  if (!user) return;
  try {
    await setDoc(doc(db, "presence", user.uid),
      { typing: isTyping }, { merge: true });
  } catch {}
}

function renderTyping(typers) {
  const el = document.getElementById("chatTyping");
  if (!el) return;
  if (typers.length === 0) { el.innerHTML = ""; return; }
  if (typers.length === 1) {
    el.innerHTML = `${typers[0]} печатает<span class="dots"></span>`;
  } else if (typers.length === 2) {
    el.innerHTML = `${typers[0]} и ${typers[1]} печатают<span class="dots"></span>`;
  } else {
    el.innerHTML = `${typers[0]} и ещё ${typers.length - 1} печатают<span class="dots"></span>`;
  }
}

export function destroyPresence() {
  if (presenceUnsub) presenceUnsub();
  if (heartbeatTimer) clearInterval(heartbeatTimer);
}
