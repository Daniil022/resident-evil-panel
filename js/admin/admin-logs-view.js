// js/admin/admin-logs-view.js
// Просмотр всех логов в ADMIN с фильтрами.

import { loadLogs, LOG_TYPES } from "../core/activity-log.js";
import { escapeHtml, formatDate } from "../modules/gestion.js";

let currentFilters = { type: "", author: "", target: "" };

export async function initLogsView() {
  const container = document.getElementById("adminLogsFull");
  if (!container) return;

  renderToolbar();
  await loadAndRender();
}

function renderToolbar() {
  const toolbar = document.getElementById("adminLogsToolbar");
  if (!toolbar) return;

  toolbar.innerHTML =
    '<div class="users-toolbar-row">' +
      '<select id="logFilterType" class="users-filter">' +
        LOG_TYPES.map(t => '<option value="' + t.id + '"' + (currentFilters.type === t.id ? " selected" : "") + '>' + t.label + '</option>').join("") +
      '</select>' +
      '<input type="text" id="logFilterAuthor" class="users-search" placeholder="🔍 Автор..." value="' + escapeAttr(currentFilters.author) + '">' +
      '<input type="text" id="logFilterTarget" class="users-search" placeholder="🔍 Цель (ник)..." value="' + escapeAttr(currentFilters.target) + '">' +
      '<button class="btn secondary btn-reset" id="logResetBtn">Сбросить</button>' +
    '</div>';

  const on = (id, evt, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(evt, fn);
  };

  on("logFilterType", "change", (e) => {
    currentFilters.type = e.target.value;
    loadAndRender();
  });

  let t = null;
  on("logFilterAuthor", "input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      currentFilters.author = e.target.value.trim();
      loadAndRender();
    }, 250);
  });

  on("logFilterTarget", "input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      currentFilters.target = e.target.value.trim();
      loadAndRender();
    }, 250);
  });

  on("logResetBtn", "click", () => {
    currentFilters = { type: "", author: "", target: "" };
    renderToolbar();
    loadAndRender();
  });
}

async function loadAndRender() {
  const container = document.getElementById("adminLogsFull");
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;">Загрузка...</div>';

  const logs = await loadLogs({
    type: currentFilters.type || null,
    author: currentFilters.author || null,
    target: null,
    max: 200
  });

  const targetQ = currentFilters.target.toLowerCase();
  const filtered = targetQ
    ? logs.filter(l => (l.targetLogin || "").toLowerCase().includes(targetQ))
    : logs;

  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;">Логов не найдено</div>';
    return;
  }

  container.innerHTML = filtered.map(l =>
    '<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px dashed rgba(42,53,67,0.5);font-size:12.5px;">' +
      '<span style="flex-shrink:0;min-width:130px;color:var(--muted);font-size:11px;">' + formatDate(l.at) + '</span>' +
      '<span style="flex-shrink:0;min-width:110px;color:var(--cyan);">' + escapeHtml(l.by || '—') + '</span>' +
      '<span style="flex:1;color:#ccc;">' + escapeHtml(l.message) + '</span>' +
    '</div>'
  ).join('');
}

function escapeAttr(s) {
  return String(s || "").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
