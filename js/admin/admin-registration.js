// js/admin/admin-registration.js
import {
  listRegistrationRequests, approveRegistration, rejectRegistration, deleteRegistration
} from "../modules/registration.js";
import { toast } from "../core/utils.js";
import { playSound } from "../core/sounds.js";
import { escapeHtml, formatDate } from "../modules/gestion.js";

export async function initAdminRegistration() {
  const container = document.getElementById("registrationList");
  if (!container) return;

  const requests = await listRegistrationRequests();

  if (requests.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--muted);padding:40px;grid-column:1/-1;">Заявок на регистрацию пока нет</div>';
    return;
  }

  container.innerHTML = requests.map(r => {
    const statusMap = {
      pending:  { text: "На рассмотрении", cls: "gold" },
      approved: { text: "Одобрено", cls: "green" },
      rejected: { text: "Отказано", cls: "red" }
    };
    const st = statusMap[r.status] || statusMap.pending;
    const isAlly = r.type === "ally";
    const borderColor = r.status === "approved" ? "var(--green)" : r.status === "rejected" ? "var(--red)" : (isAlly ? "#ff7f00" : "var(--gold)");
    const typeBadge = isAlly
      ? '<span class="role-badge role-badge-rainbow" style="margin-left:8px;">Союзник</span>'
      : '<span class="role-badge" style="background:rgba(0,200,212,0.15);color:var(--cyan);border:1px solid rgba(0,200,212,0.3);margin-left:8px;">Резидент</span>';

    let footer = "";
    if (r.status === "pending") {
      footer = '<div class="contract-review-actions" style="margin-top:12px;">' +
        '<button class="btn small" onclick="window.__regApprove(\'' + r.id + '\')">✓ Одобрить</button>' +
        '<button class="btn small secondary" onclick="window.__regReject(\'' + r.id + '\')">✕ Отклонить</button>' +
        '</div>';
    } else if (r.status === "approved") {
      footer = '<div style="margin-top:12px;color:var(--green);font-size:12px;">✓ Одобрено ' + formatDate(r.approvedAt) + '</div>';
    } else {
      footer = '<div style="margin-top:12px;color:var(--red);font-size:12px;">✕ Отказано ' + formatDate(r.rejectedAt) + (r.reason ? ' — ' + escapeHtml(r.reason) : '') + '</div>' +
        '<div style="margin-top:8px;"><button class="btn small danger" onclick="window.__regDelete(\'' + r.id + '\')">🗑 Удалить</button></div>';
    }

    return '<div class="card" style="border-left-color:' + borderColor + ';">' +
      '<div class="contract-head">' +
        '<div>' +
          '<div class="name">👤 ' + escapeHtml(r.nick) + typeBadge + '</div>' +
          '<div class="role">PIN: <span class="val">●●●●</span></div>' +
        '</div>' +
        '<span class="contract-status ' + st.cls + '">' + st.text + '</span>' +
      '</div>' +
      '<div class="contract-meta"><span>📅 ' + formatDate(r.createdAt) + '</span></div>' +
      footer +
    '</div>';
  }).join('');
}

window.__regApprove = async function(id) {
  if (!confirm("Одобрить регистрацию? Аккаунт будет создан автоматически.")) return;
  try {
    const req = await approveRegistration(id);
    playSound("application");
    toast("Аккаунт «" + req.nick + "» создан как " + (req.type === "ally" ? "Союзник" : "Резидент"), "ok");
    await initAdminRegistration();
  } catch (e) { toast(e.message, "warn"); }
};

window.__regReject = async function(id) {
  const reason = prompt("Причина отказа (опционально):", "");
  if (reason === null) return;
  try {
    await rejectRegistration(id, reason.trim());
    playSound("application");
    toast("Заявка отклонена", "warn");
    await initAdminRegistration();
  } catch (e) { toast(e.message, "warn"); }
};

window.__regDelete = async function(id) {
  if (!confirm("Удалить заявку?")) return;
  try {
    await deleteRegistration(id);
    toast("Удалено", "ok");
    await initAdminRegistration();
  } catch (e) { toast(e.message, "warn"); }
};
