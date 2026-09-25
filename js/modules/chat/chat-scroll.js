// js/modules/chat/chat-scroll.js
// Управление скроллом чата: автоскролл, кнопка «новые сообщения», разделитель.

const scrollState = {
  residents: { autoScroll: true, unreadCount: 0, lastReadId: null },
  allies:    { autoScroll: true, unreadCount: 0, lastReadId: null }
};

// ==================== НАСТРОЙКА ====================
/**
 * Настраивает скролл для чата.
 * @param {string} chatId — "residents" | "allies"
 */
export function setupScrollForChat(chatId) {
  const cfg = getChatConfig(chatId);
  if (!cfg) return;

  const container = document.getElementById(cfg.containerId);
  const newBtn = document.getElementById(cfg.newBtnId);
  if (!container) return;

  // Не навешиваем повторно
  if (container.__scrollBound) return;
  container.__scrollBound = true;

  // Отслеживаем скролл
  container.addEventListener("scroll", () => {
    const atBottom = isAtBottom(container);

    if (atBottom) {
      scrollState[chatId].autoScroll = true;
      scrollState[chatId].unreadCount = 0;
      hideNewButton(chatId);
      removeNewSeparator(chatId);
    } else {
      scrollState[chatId].autoScroll = false;
    }
  });

  // Клик по кнопке «Новые сообщения»
  if (newBtn) {
    newBtn.addEventListener("click", () => {
      scrollToBottom(chatId, true);
      flashNewMessages(chatId);
    });
  }
}

// ==================== СКРОЛЛ ====================
/**
 * Прокрутка вниз (если autoScroll или force).
 */
export function scrollToBottom(chatId, force = false) {
  const cfg = getChatConfig(chatId);
  if (!cfg) return;

  const container = document.getElementById(cfg.containerId);
  if (!container) return;

  if (scrollState[chatId].autoScroll || force) {
    // Плавно, если force; мгновенно, если autoScroll
    container.scrollTo({
      top: container.scrollHeight,
      behavior: force ? "smooth" : "instant"
    });

    scrollState[chatId].autoScroll = true;
    scrollState[chatId].unreadCount = 0;
    hideNewButton(chatId);

    if (force) {
      // Убираем разделитель через небольшую задержку
      setTimeout(() => removeNewSeparator(chatId), 500);
    }
  }
}

/**
 * Прокрутка к конкретному сообщению.
 */
export function scrollToMessage(chatId, msgId) {
  const cfg = getChatConfig(chatId);
  if (!cfg) return;

  const container = document.getElementById(cfg.containerId);
  if (!container) return;

  const el = container.querySelector('[data-id="' + msgId + '"]');
  if (!el) return;

  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("msg-highlight");
  setTimeout(() => el.classList.remove("msg-highlight"), 1500);
}

/**
 * Проверка: пользователь внизу?
 */
function isAtBottom(container, threshold = 80) {
  return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
}

// ==================== СЧЁТЧИК НЕПРОЧИТАННЫХ ====================
/**
 * Увеличить счётчик непрочитанных (когда пришло новое сообщение, а юзер не внизу).
 */
export function incrementUnread(chatId) {
  scrollState[chatId].unreadCount++;
  showNewButton(chatId, scrollState[chatId].unreadCount);
}

/**
 * Сбросить счётчик.
 */
export function resetUnread(chatId) {
  scrollState[chatId].unreadCount = 0;
  hideNewButton(chatId);
}

/**
 * Показать кнопку «↓ Новые сообщения (N)».
 */
function showNewButton(chatId, count) {
  const cfg = getChatConfig(chatId);
  if (!cfg) return;

  const newBtn = document.getElementById(cfg.newBtnId);
  if (!newBtn) return;

  newBtn.classList.add("show");
  newBtn.innerHTML = '↓ Новых сообщений: <span class="new-count">' + count + '</span>';
}

function hideNewButton(chatId) {
  const cfg = getChatConfig(chatId);
  if (!cfg) return;

  const newBtn = document.getElementById(cfg.newBtnId);
  if (!newBtn) return;

  newBtn.classList.remove("show");
  newBtn.innerHTML = "↓ Новые сообщения";
}

// ==================== РАЗДЕЛИТЕЛЬ «НОВЫЕ СООБЩЕНИЯ» ====================
/**
 * Добавить разделитель перед первым новым сообщением.
 */
export function addNewSeparator(chatId) {
  const cfg = getChatConfig(chatId);
  if (!cfg) return;

  const container = document.getElementById(cfg.containerId);
  if (!container) return;

  // Убираем старый разделитель
  removeNewSeparator(chatId);

  const messages = container.querySelectorAll(".msg");
  if (messages.length === 0) return;

  // Находим последнее прочитанное сообщение
  const lastReadId = scrollState[chatId].lastReadId;
  let targetMsg = null;

  if (lastReadId) {
    for (const m of messages) {
      if (m.dataset.id === lastReadId) {
        targetMsg = m;
        break;
      }
    }
  }

  // Если не нашли — ставим перед последним сообщением
  if (!targetMsg) {
    targetMsg = messages[messages.length - 1];
  }

  // Создаём разделитель
  const sep = document.createElement("div");
  sep.className = "chat-new-separator";
  sep.id = "chatNewSeparator-" + chatId;
  sep.innerHTML = '<span>Новые сообщения</span>';

  // Вставляем перед targetMsg
  targetMsg.parentNode.insertBefore(sep, targetMsg);
}

function removeNewSeparator(chatId) {
  const sep = document.getElementById("chatNewSeparator-" + chatId);
  if (sep) sep.remove();
}

// ==================== ПОДСВЕТКА ====================
/**
 * Подсветить новые сообщения (после клика «Новые»).
 */
function flashNewMessages(chatId) {
  const cfg = getChatConfig(chatId);
  if (!cfg) return;

  const container = document.getElementById(cfg.containerId);
  if (!container) return;

  const messages = container.querySelectorAll(".msg");
  const lastReadId = scrollState[chatId].lastReadId;

  let foundRead = !lastReadId;
  let delay = 0;

  messages.forEach((m) => {
    if (!foundRead) {
      if (m.dataset.id === lastReadId) {
        foundRead = true;
      }
      return;
    }

    // Подсвечиваем с задержкой
    setTimeout(() => {
      m.classList.add("msg-flash");
      setTimeout(() => m.classList.remove("msg-flash"), 1200);
    }, delay);
    delay += 80;
  });
}

// ==================== СОХРАНЕНИЕ «ПРОЧИТАНО ДО» ====================
/**
 * Запомнить последнее прочитанное сообщение.
 */
export function setLastRead(chatId, msgId) {
  scrollState[chatId].lastReadId = msgId;
  // Сохраняем в localStorage
  try {
    localStorage.setItem("chat_last_read_id_" + chatId, msgId || "");
  } catch (e) {}
}

/**
 * Восстановить последнее прочитанное сообщение.
 */
export function restoreLastRead(chatId) {
  try {
    const saved = localStorage.getItem("chat_last_read_id_" + chatId);
    if (saved) scrollState[chatId].lastReadId = saved;
  } catch (e) {}
}

// ==================== ХЕЛПЕРЫ ====================
function getChatConfig(chatId) {
  // Импортируем лениво — избегаем цикличности
  if (chatId === "residents") {
    return {
      containerId: "chatMessages",
      newBtnId: "chatNewBtn"
    };
  }
  if (chatId === "allies") {
    return {
      containerId: "chatAlliesMessages",
      newBtnId: "chatAlliesNewBtn"
    };
  }
  return null;
}

/**
 * Экспорт состояния (для отладки).
 */
export function getScrollState(chatId) {
  return { ...scrollState[chatId] };
}
