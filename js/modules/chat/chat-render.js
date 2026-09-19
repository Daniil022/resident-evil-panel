// js/modules/chat/chat-render.js
import { getCurrentUser } from "../../core/state.js";

export function renderMessage(msg, grouped, handlers, currentUid) {
  const isOwn = msg.authorId === currentUid;

  const wrap = document.createElement("div");
  wrap.className = "msg " + (isOwn ? "msg-own" : "msg-other");
  wrap.dataset.id = msg.id;

  const initial = (msg.authorLogin || "?").charAt(0).toUpperCase();
  const roleClass = roleToClass(msg.authorRole);

  const avatarHtml = msg.authorAvatar
    ? '<img src="' + msg.authorAvatar + '" alt="">'
    : initial;

  if (!grouped && !isOwn) {
    const av = document.createElement("div");
    av.className = "msg-avatar " + roleClass;
    av.innerHTML = avatarHtml;
    av.dataset.login = msg.authorLogin;
    av.addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.__openProfileByName) {
        window.__openProfileByName(msg.authorLogin);
      }
    });
    wrap.appendChild(av);
  } else if (!isOwn) {
    const spacer = document.createElement("div");
    spacer.style.width = "42px";
    spacer.style.minWidth = "42px";
    wrap.appendChild(spacer);
  }

  const body = document.createElement("div");
  body.className = "msg-body";

  if (!grouped && !isOwn) {
    const head = document.createElement("div");
    head.className = "msg-head";
    head.innerHTML =
      '<span class="msg-author ' + roleClass + '">' + escapeHtml(msg.authorLogin) + '</span>' +
      '<span class="msg-role-badge ' + roleClass + '">' + escapeHtml(msg.authorRole || "—") + '</span>';
    body.appendChild(head);
  }

  if (msg.replyTo) {
    const reply = document.createElement("div");
    reply.className = "msg-reply";
    reply.dataset.replyId = msg.replyTo.id;
    reply.title = "Перейти к сообщению";
    reply.innerHTML =
      '<div class="reply-author">' + escapeHtml(msg.replyTo.author) + '</div>' +
      '<div class="reply-text">' + escapeHtml(msg.replyTo.text || "🎤 Голосовое") + '</div>';
    reply.addEventListener("click", () => {
      const targetId = msg.replyTo.id;
      const el = document.querySelector('[data-id="' + targetId + '"]');
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("msg-highlight");
        setTimeout(() => el.classList.remove("msg-highlight"), 1500);
      }
    });
    body.appendChild(reply);
  }

  if (msg.type === "voice" && msg.voiceUrl) {
    body.appendChild(renderVoice(msg));
  } else {
    const text = document.createElement("div");
    text.className = "msg-text";
    const rendered = renderText(msg.text);
    text.innerHTML = rendered.html;
    if (rendered.isBigEmoji) text.classList.add("msg-text-big-emoji");
    body.appendChild(text);
  }

  const time = document.createElement("div");
  time.className = "msg-time";
  const editedMark = msg.editedAt ? ' <span class="msg-edited" title="Изменено">(ред.)</span>' : '';
  time.innerHTML = formatTime(msg.createdAt) + editedMark;
  body.appendChild(time);

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

  const user = getCurrentUser();
  const isAdmin = user && ["emperor", "lord"].includes(user.role);

  const actions = document.createElement("div");
  actions.className = "msg-actions";

  let actionsHTML = '<button title="Ответить">↩</button>';
  actionsHTML += '<button title="Реакция">☺</button>';
  if (isOwn) actionsHTML += '<button title="Редактировать">✏️</button>';
  if (isAdmin) actionsHTML += '<button title="Закрепить">📌</button>';
  actionsHTML += '<button title="Удалить">🗑</button>';
  actions.innerHTML = actionsHTML;

  let idx = 0;
  actions.children[idx++].onclick = () => handlers.onReply(msg);
  actions.children[idx++].onclick = () => quickReact(msg.id, handlers);
  if (isOwn) {
    actions.children[idx++].onclick = () => handlers.onEdit && handlers.onEdit(msg);
  }
  if (isAdmin) {
    actions.children[idx++].onclick = () => handlers.onPin && handlers.onPin(msg);
  }
  actions.children[idx++].onclick = () => handlers.onDelete(msg);

  body.appendChild(actions);

  wrap.appendChild(body);

  if (!grouped && isOwn) {
    const av = document.createElement("div");
    av.className = "msg-avatar " + roleClass;
    av.innerHTML = avatarHtml;
    av.dataset.login = msg.authorLogin;
    av.addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.__openProfileByName) {
        window.__openProfileByName(msg.authorLogin);
      }
    });
    wrap.appendChild(av);
  }

  return wrap;
}

// ==================== ГОЛОСОВЫЕ ====================
function renderVoice(msg) {
  const wrap = document.createElement("div");
  wrap.className = "voice-msg";

  const btn = document.createElement("button");
  btn.className = "voice-play";
  btn.type = "button";
  btn.innerHTML = "▶";

  const bars = document.createElement("div");
  bars.className = "voice-bars";

  const BAR_COUNT = 28;
  const seed = String(msg.id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) || 1;
  for (let i = 0; i < BAR_COUNT; i++) {
    const bar = document.createElement("span");
    const h = 20 + ((seed * (i + 3)) % 60);
    bar.style.height = h + "%";
    bars.appendChild(bar);
  }

  const time = document.createElement("span");
  time.className = "voice-time";
  time.textContent = formatVoiceDuration(msg.voiceDuration || 0);

  const audio = document.createElement("audio");
  audio.src = msg.voiceUrl;
  audio.preload = "none";

  let playing = false;

  audio.addEventListener("timeupdate", () => {
    const progress = audio.duration ? (audio.currentTime / audio.duration) : 0;
    const spans = bars.querySelectorAll("span");
    spans.forEach((b, i) => {
      b.classList.toggle("played", i / BAR_COUNT <= progress);
    });
    time.textContent = formatVoiceDuration(audio.currentTime * 1000);
  });

  audio.addEventListener("ended", () => {
    playing = false;
    btn.innerHTML = "▶";
    bars.querySelectorAll("span").forEach(b => b.classList.remove("played"));
    time.textContent = formatVoiceDuration(msg.voiceDuration || 0);
  });

  btn.addEventListener("click", () => {
    if (playing) {
      audio.pause();
      playing = false;
      btn.innerHTML = "▶";
    } else {
      audio.play().catch(err => console.warn("Voice play failed:", err));
      playing = true;
      btn.innerHTML = "❚❚";
    }
  });

  bars.addEventListener("click", (e) => {
    if (!audio.duration) return;
    const rect = bars.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = audio.duration * ratio;
  });

  wrap.appendChild(btn);
  wrap.appendChild(bars);
  wrap.appendChild(time);
  wrap.appendChild(audio);
  return wrap;
}

function formatVoiceDuration(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ":" + String(s).padStart(2, "0");
}

// ==================== ТЕКСТ ====================
function renderText(text) {
  if (!text) return { html: "", isBigEmoji: false };

  const trimmed = text.trim();
  const emojiOnly = /^(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F0FF}]\u{FE0F}?\s*){1,3}$/u;
  const isBigEmoji = emojiOnly.test(trimmed);

  let html = escapeHtml(text);
  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>'
  );
  html = html.replace(
    /(^|\s)(www\.[^\s<]+)/g,
    '$1<a href="https://$2" target="_blank" rel="noopener noreferrer" class="chat-link">$2</a>'
  );
  html = html.replace(
    /(^|\s)(vk\.com\/[^\s<]+)/g,
    '$1<a href="https://$2" target="_blank" rel="noopener noreferrer" class="chat-link">$2</a>'
  );

  html = html.replace(
    /@([A-Za-z0-9_]{3,32})/g,
    '<span class="chat-mention" data-mention="$1">@$1</span>'
  );

  return { html, isBigEmoji };
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

function quickReact(msgId, handlers) {
  const emojis = ["❤️", "🔥", "💀", "⚔️", "😂", "👍"];
  const choice = prompt("Реакция:\n" + emojis.map((e, i) => (i + 1) + ". " + e).join("\n"), "1");
  if (!choice) return;
  const idx = parseInt(choice) - 1;
  if (idx >= 0 && idx < emojis.length) {
    handlers.onReact(msgId, emojis[idx]);
  }
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
  if (role === "ally") return "rainbow";
  return "";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
