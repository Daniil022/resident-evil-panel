// js/modules/chat/chat-scroll.js
let autoScroll = true;

export function setupScroll() {
  const container = document.getElementById("chatMessages");
  const newBtn = document.getElementById("chatNewBtn");
  if (!container) return;

  container.addEventListener("scroll", () => {
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    autoScroll = atBottom;
    if (autoScroll && newBtn) newBtn.classList.remove("show");
  });

  if (newBtn) {
    newBtn.addEventListener("click", () => {
      container.scrollTop = container.scrollHeight;
      autoScroll = true;
      newBtn.classList.remove("show");
    });
  }
}

export function scrollToBottom(force = false) {
  const container = document.getElementById("chatMessages");
  const newBtn = document.getElementById("chatNewBtn");
  if (!container) return;

  if (autoScroll || force) {
    container.scrollTop = container.scrollHeight;
  } else if (newBtn) {
    newBtn.classList.add("show");
  }
}

export function scrollToMessage(msgId) {
  const container = document.getElementById("chatMessages");
  if (!container) return;
  const el = container.querySelector('[data-id="' + msgId + '"]');
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("msg-highlight");
    setTimeout(() => el.classList.remove("msg-highlight"), 1500);
  }
}
