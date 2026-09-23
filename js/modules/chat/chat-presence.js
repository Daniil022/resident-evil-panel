// js/modules/chat/chat-presence.js
import { doc, setDoc, onSnapshot, collection }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "../../firebase-init.js";
import { getCurrentUser } from "../../core/state.js";

let presenceUnsub = null;
let heartbeatTimer = null;

export function setupPresence() {
  const user = getCurrentUser();
  if (!user) return;

  const presenceRef = doc(db, "presence", user.uid);

  setDoc(presenceRef, {
    login: user.login,
    role: user.role,
    online: true,
    typing: false,
    lastSeen: Date.now()
  }, { merge: true }).catch(() => {});

  // Heartbeat раз в 60 секунд (было 30)
  heartbeatTimer = setInterval(() => {
    setDoc(presenceRef, { lastSeen: Date.now(), online: true }, { merge: true }).catch(() => {});
  }, 60000);

  window.addEventListener("beforeunload", () => {
    setDoc(presenceRef, { online: false, typing: false }, { merge: true }).catch(() => {});
  });

  try {
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
    console.warn("Presence failed:", e);
  }
}

export async function setTyping(isTyping) {
  const user = getCurrentUser();
  if (!user) return;
  try {
    await setDoc(doc(db, "presence", user.uid),
      { typing: isTyping }, { merge: true });
  } catch (e) {}
}

function renderTyping(typers) {
  const el = document.getElementById("chatTyping");
  const elAllies = document.getElementById("chatAlliesTyping");
  const text = typers.length === 0 ? "" :
    (typers.length === 1 ? typers[0] + " печатает<span class='dots'></span>"
                        : typers.slice(0, 2).join(", ") + " печатают<span class='dots'></span>");
  if (el) el.innerHTML = text;
  if (elAllies) elAllies.innerHTML = text;
}

export function destroyPresence() {
  const user = getCurrentUser();
  if (user) {
    try {
      setDoc(doc(db, "presence", user.uid), { online: false, typing: false }, { merge: true });
    } catch (e) {}
  }
  if (presenceUnsub) presenceUnsub();
  if (heartbeatTimer) clearInterval(heartbeatTimer);
}
