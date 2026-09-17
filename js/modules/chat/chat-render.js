// js/modules/chat/chat-render.js

export function renderMessage(msg, grouped, handlers, currentUid) {
  const wrap = document.createElement("div");
  wrap.className = "msg";
  wrap.dataset.id = msg.id;

  const initial = (msg.authorLogin || "?").charAt(0).toUpperCase();
  const roleClass = roleToClass(msg.authorRole);

  if (!grouped) {
    const av = document.createElement("div");
    av.className = `msg-avatar ${roleClass}`;
    av.textContent = initial;
    wrap.appendChild(av);
  } else {
    const spacer = document.createElement("div");
    spacer.style.width = "40px";
    spacer.style.minWidth = "40px";
    wrap.appendChild(spacer);
  }

  const body = document.createElement("div");
  body.className = "msg-body";

  if (!grouped) {
    const head = document.createElement("div");
    head.className = "msg-head";
    head.innerHTML = `
      <span class="msg-author ${roleClass}">${escapeHtml(msg.authorLogin)}</span>
      <span class="msg-role-badge ${roleClass}">${escapeHtml(msg.authorRole || "—")}</span>
      <span class="msg-time">${formatTime(msg.createdAt)}</span>
    `;
    body.appendChild(head);
  }

  if (msg.replyTo) {
    const reply = document.createElement("div");
    reply.className = "msg-reply";
    reply.dataset.replyId = msg.replyTo.id;
    reply.innerHTML = `
      <div class="reply-author">${escapeHtml(msg.replyTo.author)}</div>
      <div class="reply-text">${escapeHtml(msg.replyTo.text)}</div>
    `;
    body.appendChild(reply);
  }

  const text = document.createElement("div");
  text.className = "msg-text";
  text.textContent = msg.text;
  body.appendChild(text);

  if (msg.reactions && Object.keys(msg.reactions).length) {
    const reactWrap = document.createElement("div");
    reactWrap.className = "msg-reactions";
    for (const [emoji, users] of Object.entries(msg.reactions)) {
      if (!users || !users.length) continue;
      const r = document.createElement("div");
      r.className = "reaction" + (users.includes(currentUid) ? " mine" : "");
      r.innerHTML = `${emoji} <span class="count">${users.length}</span>`;
      r.onclick = () => handlers.onReact(msg.id, emoji);
      reactWrap.appendChild(r);
    }
    body.appendChild(reactWrap);
  }

  // Быстрые реакции
  const quickWrap = document.createElement("div");
  quickWrap.style.display = "none";
  quickWrap.className = "msg-reactions";
  ["❤️","🔥","💀","⚔️"].forEach(em => {
    const r = document.createElement("div");
    r.className = "reaction";
    r.innerHTML = em;
    r.onclick = () => handlers.onReact(msg.id, em);
    quickWrap.appendChild(r);
  });
  body.appendChild(quickWrap);

  const actions = document.createElement("div");
  actions.className = "msg-actions";
  actions.innerHTML = `
    <button title="Ответить">↩</button>
    <button title="Реакция">☺</button>
    <button title="Удалить">✕</button>
  `;
  actions.children[0].onclick = () => handlers.onReply(msg);
  actions.children[1].onclick = () => {
    quickWrap.style.display = quickWrap.style.display === "none" ? "flex" : "none";
  };
  actions.children[2].onclick = () => handlers.onDelete(msg);

  body.appendChild(actions);
  wrap.appendChild(body);
  return wrap;
}

export function renderDateSeparator(date) {
  const el = document.createElement("div");
  el.className = "chat-date-sep";
  el.innerHTML = `<span>${formatDate(date)}</span>`;
  return el;
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function formatTime(ts) {
  if (!ts) return "--:--";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return String(d.getHours()).padStart(2,"0") + ":" +
         String(d.getMinutes()).padStart(2,"0");
}

function formatDate(d) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d, today)) return "Сегодня";
  if (isSameDay(d, yesterday)) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function roleToClass(role) {
  if (role === "Император") return "gold";
  if (role === "Лорд Тьмы") return "red";
  if (role === "Рыцарь Смерти" || role === "Скелет Ужаса") return "blue";
  return "";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
