// js/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA181DPjF83z-f0petYl4wNCSi_rB01-HU",
  authDomain: "resident-evil-panel.firebaseapp.com",
  projectId: "resident-evil-panel",
  storageBucket: "resident-evil-panel.firebasestorage.app",
  messagingSenderId: "835247361154",
  appId: "1:835247361154:web:4a2e2cbe57ed3ce091389b"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
