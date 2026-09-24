// js/modules/registration.js
import { db } from "../firebase-init.js";
import {
  collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { createUser } from "../core/auth.js";
import { safeFirestore } from "../core/utils.js";

const DEMO_KEY = "re_demo_registration_requests";

// ==================== ПОДАЧА ЗАЯВКИ ====================
export async function submitRegistrationRequest(nick, pin, type = "resident") {
  if (!/^[A-Za-z0-9_]{3,32}$/.test(nick)) throw new Error("Ник: латиница, цифры, _ (3-32)");
  if (!/^[0-9]{4,8}$/.test(pin)) throw new Error("PIN: 4-8 цифр");
  if (!["ally", "resident"].includes(type)) type = "resident";

  // Проверка: не занят ли ник
  const usersSnap = await safeFirestore(
    getDocs(query(collection(db, "users"), where("login", "==", nick))),
    null,
    4000,
    "reg-check-users"
  );
  if (usersSnap && !usersSnap.empty) throw new Error("Такой ник уже занят");

  // Проверка: нет ли pending-заявки
  const reqSnap = await safeFirestore(
    getDocs(query(collection(db, "registration_requests"), where("nick", "==", nick))),
    null,
    4000,
    "reg-check-requests"
  );
  if (reqSnap) {
    let hasPending = false;
    reqSnap.forEach(d => { if (d.data().status === "pending") hasPending = true; });
    if (hasPending) throw new Error("Заявка с таким ником уже на рассмотрении");
  }

  const data = { nick, pin, type, status: "pending", createdAt: Date.now() };

  const ref = await safeFirestore(
    addDoc(collection(db, "registration_requests"), data),
    null,
    5000,
    "reg-submit"
  );

  if (ref) return { id: ref.id, ...data };

  // Демо
  const demo = JSON.parse(localStorage.getItem(DEMO_KEY) || "[]");
  const req = { id: "demo-reg-" + Date.now(), ...data };
  demo.push(req);
  localStorage.setItem(DEMO_KEY, JSON.stringify(demo));
  return req;
}

// ==================== СПИСОК (одноразово) ====================
export async function listRegistrationRequests() {
  const snap = await safeFirestore(
    getDocs(collection(db, "registration_requests")),
    null,
    5000,
    "reg-list"
  );

  if (snap) {
    const requests = snap.docs.map(d => ({ id: d.id, ...d.data(), source: "firebase" }));
    requests.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return requests;
  }

  console.warn("Firestore failed, demo mode");
  return getDemoRequests();
}

function getDemoRequests() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); }
  catch { return []; }
}
function saveDemoRequests(list) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(list));
}

// ==================== LIVE-ПОДПИСКА ====================
let unsubRequests = null;

export function subscribeToRequests(callback) {
  if (unsubRequests) {
    unsubRequests();
    unsubRequests = null;
  }

  try {
    const q = collection(db, "registration_requests");

    unsubRequests = onSnapshot(q, (snap) => {
      const requests = snap.docs.map(d => ({ id: d.id, ...d.data(), source: "firebase" }));
      requests.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      saveDemoRequests(requests);
      if (typeof callback === "function") callback(requests);
    }, (err) => {
      console.warn("[Registration] Live subscribe failed:", err.message);
      const demo = getDemoRequests();
      if (typeof callback === "function") callback(demo);
    });
  } catch (e) {
    console.warn("[Registration] Subscribe error:", e.message);
    const demo = getDemoRequests();
    if (typeof callback === "function") callback(demo);
  }

  return () => {
    if (unsubRequests) {
      unsubRequests();
      unsubRequests = null;
    }
  };
}

// ==================== ОДОБРЕНИЕ ====================
export async function approveRegistration(reqId) {
  const requests = await listRegistrationRequests();
  const req = requests.find(r => r.id === reqId);
  if (!req) throw new Error("Заявка не найдена");

  const role = req.type === "ally" ? "ally" : "soul";

  await createUser({ login: req.nick, pin: req.pin, role, division: null });

  const result = await safeFirestore(
    updateDoc(doc(db, "registration_requests", reqId), {
      status: "approved",
      approvedAt: Date.now()
    }),
    null,
    4000,
    "reg-approve"
  );

  if (result === null) {
    const demo = getDemoRequests();
    const idx = demo.findIndex(r => r.id === reqId);
    if (idx >= 0) {
      demo[idx].status = "approved";
      demo[idx].approvedAt = Date.now();
      saveDemoRequests(demo);
    }
  }

  return req;
}

// ==================== ОТКЛОНЕНИЕ ====================
export async function rejectRegistration(reqId, reason = "") {
  const result = await safeFirestore(
    updateDoc(doc(db, "registration_requests", reqId), {
      status: "rejected",
      rejectedAt: Date.now(),
      reason: reason
    }),
    null,
    4000,
    "reg-reject"
  );

  if (result === null) {
    const demo = getDemoRequests();
    const idx = demo.findIndex(r => r.id === reqId);
    if (idx >= 0) {
      demo[idx].status = "rejected";
      demo[idx].rejectedAt = Date.now();
      demo[idx].reason = reason;
      saveDemoRequests(demo);
    }
  }
}

// ==================== УДАЛЕНИЕ ====================
export async function deleteRegistration(reqId) {
  const result = await safeFirestore(
    deleteDoc(doc(db, "registration_requests", reqId)),
    null,
    4000,
    "reg-delete"
  );

  if (result === null) {
    const demo = getDemoRequests().filter(r => r.id !== reqId);
    saveDemoRequests(demo);
  }
}
