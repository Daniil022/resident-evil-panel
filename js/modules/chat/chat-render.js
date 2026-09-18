// js/modules/chat/chat-render.js

export function renderMessage(msg, grouped, handlers, currentUid) {
  const isOwn = msg.authorId === currentUid;

  const wrap = document.createElement("div");
  wrap.className = "msg " + (isOwn ? "msg-own" : "msg-other");
  wrap.dataset.id = msg.id;

  const initial = (msg.authorLogin || "?").charAt(0).toUpperCase();
  const roleClass = roleToClass(msg.authorRole);

  // Аватар
  if (!grouped && !isOwn) {
    const av = document.createElement("div");
    av.className = "msg-avatar " + roleClass;
    av.textContent = initial;
    wrap.appendChild(av);
  } else if (!isOwn) {
    const spacer = document.createElement("div");
    spacer.style.width = "42px";
    spacer.style.minWidth = "42px";
    wrap.appendChild(spacer);
  }

  // Тело
  const body = document.createElement("div");
  body.className = "msg-body";

  // Заголовок (только для чужих и при группировке)
  if (!grouped && !isOwn) {
    const head = document.createElement("div");
    head.className = "msg-head";
    head.innerHTML =
      '<span class="msg-author ' + roleClass + '">' + escapeHtml(msg.authorLogin) + '</span>' +
      '<span class="msg-role-badge ' + roleClass + '">' + escapeHtml(msg.authorRole || "—") + '</span>';
    body.appendChild(head);
  }

  // Ответ-цитата
  if (msg.replyTo) {
    const reply = document.createElement("div");
    reply.className = "msg-reply";
    reply.dataset.replyId = msg.replyTo.id;
    reply.innerHTML =
      '<div class="reply-author">' + escapeHtml(msg.replyTo.author) + '</div>' +
      '<div class="reply-text">' + escapeHtml(msg.replyTo.text) + '</div>';
    body.appendChild(reply);
  }

  // Текст
  const text = document.createElement("div");
  text.className = "msg-text";
  text.textContent = msg.text;
  body.appendChild(text);

  // Время
  const time = document.createElement("div");
  time.className = "msg-time";
  time.textContent = formatTime(msg.createdAt);
  body.appendChild(time);

  // Реакции
  if (msg.reactions && Object.keys(msg.reactions).length) {
    const reactWrap = document.createElement("div");
    reactWrap.className = "msg-reactions";
    for (const [emoji, users] of Object.entries(msg.reactions)) {
      if (!users || !users.length) continue;
      const r = document.createElement("div");
      r.className = "reaction" + (users.includes(currentUid) ? " mine" : "");
      r.innerHTML = emoji + ' <span class="count">' + users.length + '</span>';
      r.onclick = () => handlers.onReact(msg.id, emoji);
      reactWrap.appendChild(r);
    }
    body.appendChild(reactWrap);
  }

  // Кнопки при hover
  const actions = document.createElement("div");
  actions.className = "msg-actions";
  actions.innerHTML = '<button title="Ответить">↩</button><button title="Реакция">☺</button><button title="Удалить">✕</button>';
  actions.children[0].onclick = () => handlers.onReply(msg);
  actions.children[1].onclick = () => quickReact(msg.id, handlers);
  actions.children[2].onclick = () => handlers.onDelete(msg);
  body.appendChild(actions);

  // Аватар справа для своих
  if (!grouped && isOwn) {
    wrap.appendChild(body);
    const av = document.createElement("div");
    av.className = "msg-avatar " + roleClass;
    av.textContent = initial;
    wrap.appendChild(av);
  } else {
    wrap.appendChild(body);
  }

  return wrap;
}

function quickReact(msgId, handlers) {
  const emojis = ["❤️", "🔥", "💀", "⚔️", "😂", "👍"];
  const choice = prompt("Реакция:\n" + emojis.map((e, i) => (i + 1) + ". " + e).join("\n"), "1");
  if (!choice) return;
  const idx = parseInt(choice) - 1;
  if (idx >= 0 && idx < emojis.length) {
    handlers.onReact(msgId, emojis[idx]);
  }
}

export function renderDateSeparator(date) {
  const el = document.createElement("div");
  el.className = "chat-date-sep";
  el.innerHTML = "<span>" + formatDate(date) + "</span>";
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
  return String(d.getHours()).padStart(2, "0") + ":" +
         String(d.getMinutes()).padStart(2, "0");
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
  if (role === "emperor") return "gold";
  if (role === "lord") return "red";
  if (role === "knight" || role === "skeleton") return "blue";
  return "";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
