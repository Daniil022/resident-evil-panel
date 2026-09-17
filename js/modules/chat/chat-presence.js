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
    const presenceRef = doc(db, "pres
