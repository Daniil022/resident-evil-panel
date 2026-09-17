// js/modules/chat/chat-stub.js
// Заглушка. Полный чат — в Этапе 2.

export function initChat() {
  const el = document.getElementById("chatMessages");
  if (!el) return;
  el.innerHTML = `
    <div style="padding:40px; text-align:center; color:#666; font-size:12px; letter-spacing:2px;">
      ЧАТ БУДЕТ ПОДКЛЮЧЁН НА ЭТАПЕ 2
    </div>`;
}

export function destroyChat() {}
