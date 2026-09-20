// js/modules/chat/chat-mentions.js
// Упоминания @ник в чате.

import { getCurrentUser } from "../../core/state.js";
import { playSound } from "../../core/sounds.js";

// Кэш последних упоминаний, чтобы не спамить
const lastMentionAt = {};

/**
 * Проверяет, есть ли упоминание текущего юзера в тексте.
 * @param {string} text
 * @returns {boolean}
 */
export function checkMention(text) {
  const me = getCurrentUser();
  if (!me || !text) return false;

  const regex = new RegExp("@(" + escapeRegex(me.login) + ")\\b", "i");
  return regex.test(text);
}

/**
 * Подсветить сообщение, где упомянули меня.
 */
export function highlightIfMentioned(msg, element) {
  if (!msg || !element) return;
  if (msg.authorId === getCurrentUser()?.uid) return; // сам себя не подсвечиваем
  if (!checkMention(msg.text || "")) return;

  element.classList.add("msg-mentioned");

  // Звук (не чаще раза в 30 сек)
  const me = getCurrentUser();
  if (!me) return;

  const last = lastMentionAt[me.uid] || 0;
  if (Date.now() - last < 30000) return;
  lastMentionAt[me.uid] = Date.now();

  playSound("chat");
}

/**
 * Преобразует @Nick в кликабельный span.
 * Вызывается при рендере текста.
 */
export function linkifyMentions(html) {
  return html.replace(/@([A-Za-z0-9_]{3,32})/g, (match, login) => {
    return '<span class="chat-mention" data-mention="' + login + '" onclick="window.__openProfileByName(\'' + login + '\')">@' + login + '</span>';
  });
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
