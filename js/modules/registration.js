// js/modules/registration.js
import { db } from "../firebase-init.js";
import {
  collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { createUser } from "../core/auth.js";

const DEMO_KEY = "re_demo_registration_requests";

export async function submitRegistrationRequest(nick, pin, type = "resident") {
  if (!/^[A-Za-z0-9_]{3,32}$/.test(nick)) throw new Error("Ник: латиница, цифры, _ (3-32)");
  if (!/^[0-9]{4,8}$/.test(pin)) throw new Error("PIN: 4-8 цифр");
  if (!["ally", "resident"].includes(type)) type = "resident";

  try {
    const usersSnap = await getDocs(query(collection(db, "users"), where("login", "==", nick)));
    if (!usersSnap.empty) throw new Error("Такой ник уже занят");
  } catch (e) { if (e.message === "Такой ник уже занят") throw e; }

  try {
    const reqSnap = await getDocs(query(collection(db, "registration_requests"), where("nick", "==", nick)));
    let hasPending = false;
    reqSnap.forEach(d => { if (d.data().status === "pending") hasPending = true; });
    if (hasPending) throw new Error("Заявка с таким ником уже на рассмотрении");
  } catch (e) { if (e.message === "Заявка с таким ником уже на рассмотрении") throw e; }

  const data = { nick, pin, type, status: "pending", createdAt: Date.now() };

  try {
    const ref = await addDoc(collection(db, "registration_requests"), data);
    return { id: ref.id, ...data };
  } catch (e) {
    const demo = JSON.parse(localStorage.getItem(DEMO_KEY) || "[]");
    const req = { id: "demo-reg-" + Date.now(), ...data };
    demo.push(req);
    localStorage.setItem(DEMO_KEY, JSON.stringify(demo));
    return req;
  }
}

export async function listRegistrationRequests() {
  try {
    const snap = await getDocs(collection(db, "registration_requests"));
    const requests = snap.docs.map(d => ({ id: d.id, ...d.data(), source: "firebase" }));
    requests.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return requests;
  } catch (e) {
    return getDemoRequests();
  }
}

function getDemoRequests() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); } catch { return []; }
}
function saveDemoRequests(list) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(list));
}

export async function approveRegistration(reqId) {
  const requests = await listRegistrationRequests();
  const req = requests.find(r => r.id === reqId);
  if (!req) throw new Error("Заявка не найдена");

  const role = req.type === "ally" ? "ally" : "soul";

  await createUser({ login: req.nick, pin: req.pin, role, division: null });

  try {
    await updateDoc(doc(db, "registration_requests", reqId), { status: "approved", approvedAt: Date.now() });
  } catch (e) {
    const demo = getDemoRequests();
    const idx = demo.findIndex(r => r.id === reqId);
    if (idx >= 0) { demo[idx].status = "approved"; demo[idx].approvedAt = Date.now(); saveDemoRequests(demo); }
  }
  return req;
}

export async function rejectRegistration(reqId, reason = "") {
  try {
    await updateDoc(doc(db, "registration_requests", reqId), { status: "rejected", rejectedAt: Date.now(), reason: reason });
  } catch (e) {
    const demo = getDemoRequests();
    const idx = demo.findIndex(r => r.id === reqId);
    if (idx >= 0) { demo[idx].status = "rejected"; demo[idx].rejectedAt = Date.now(); demo[idx].reason = reason; saveDemoRequests(demo); }
  }
}

export async function deleteRegistration(reqId) {
  try { await deleteDoc(doc(db, "registration_requests", reqId)); } catch (e) {
    const demo = getDemoRequests().filter(r => r.id !== reqId);
    saveDemoRequests(demo);
  }
}
