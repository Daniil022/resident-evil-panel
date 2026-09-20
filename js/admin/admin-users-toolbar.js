// js/admin/admin-users-toolbar.js
// Toolbar над таблицей участников: поиск, фильтры, сортировка.

let state = {
  search: "",
  role: "",
  division: "",
  onlyWarn: false,
  onlyBanned: false,
  sortBy: "login",   // login | role | division | warn | lastSeen
  sortDir: "asc"     // asc | desc
};

let onChange = null;

export function getFilterState() {
  return { ...state };
}

export function setupUsersToolbar(callback) {
  onChange = callback;
  const el = document.getElementById("usersToolbar");
  if (!el) return;

  renderToolbar();
}

function renderToolbar() {
  const el = document.getElementById("usersToolbar");
  if (!el) return;

  el.innerHTML =
    '<div class="users-toolbar-row">' +
      '<input type="text" id="usersSearch" class="users-search" placeholder="🔍 Поиск по нику..." value="' + escapeAttr(state.search) + '">' +
      '<select id="usersFilterRole" class="users-filter"><option value="">Все роли</option></select>' +
      '<select id="usersFilterDivision" class="users-filter"><option value="">Все отряды</option></select>' +
      '<label class="users-check"><input type="checkbox" id="usersOnlyWarn" ' + (state.onlyWarn ? "checked" : "") + '> Только с warn</label>' +
      '<label class="users-check"><input type="checkbox" id="usersOnlyBanned" ' + (state.onlyBanned ? "checked" : "") + '> Только забаненные</label>' +
      '<button class="btn secondary btn-reset" id="usersResetFilters">Сбросить</button>' +
    '</div>' +
    '<div class="users-toolbar-row users-bulk-row" id="usersBulkRow" style="display:none;">' +
      '<span class="users-selected-info" id="usersSelectedInfo">Выделено: 0</span>' +
      '<button class="btn small" id="bulkWarnBtn">⚠ Warn</button>' +
      '<button class="btn small secondary" id="bulkUnwarnBtn">↻ Снять warn</button>' +
      '<button class="btn small secondary" id="bulkDivisionBtn">🎯 Отряд</button>' +
      '<button class="btn small secondary" id="bulkExportBtn">📥 Экспорт</button>' +
      '<button class="btn small danger" id="bulkDeleteBtn">🗑 Удалить</button>' +
    '</div>';

  // Заполняем селекты ролей и подразделений
  populateSelects();

  // Навешиваем обработчики
  const search = document.getElementById("usersSearch");
  if (search) {
    let t = null;
    search.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.search = search.value.trim();
        triggerChange();
      }, 200);
    });
  }

  document.getElementById("usersFilterRole").addEventListener("change", (e) => {
    state.role = e.target.value;
    triggerChange();
  });

  document.getElementById("usersFilterDivision").addEventListener("change", (e) => {
    state.division = e.target.value;
    triggerChange();
  });

  document.getElementById("usersOnlyWarn").addEventListener("change", (e) => {
    state.onlyWarn = e.target.checked;
    triggerChange();
  });

  document.getElementById("usersOnlyBanned").addEventListener("change", (e) => {
    state.onlyBanned = e.target.checked;
    triggerChange();
  });

  document.getElementById("usersResetFilters").addEventListener("click", () => {
    state = {
      search: "", role: "", division: "",
      onlyWarn: false, onlyBanned: false,
      sortBy: "login", sortDir: "asc"
    };
    renderToolbar();
    triggerChange();
  });
}

async function populateSelects() {
  const { listRoles } = await import("../core/roles.js");
  const { listDivisions } = await import("../core/divisions.js");
  try {
    const [roles, divisions] = await Promise.all([listRoles(), listDivisions()]);
    const roleSel = document.getElementById("usersFilterRole");
    const divSel = document.getElementById("usersFilterDivision");
    if (roleSel) {
      roleSel.innerHTML = '<option value="">Все роли</option>' +
        roles.map(r => '<option value="' + r.id + '"' + (state.role === r.id ? " selected" : "") + '>' + escapeHtml(r.name) + '</option>').join("");
    }
    if (divSel) {
      divSel.innerHTML = '<option value="">Все отряды</option>' +
        divisions.map(d => '<option value="' + d.id + '"' + (state.division === d.id ? " selected" : "") + '>' + escapeHtml(d.name) + '</option>').join("");
    }
  } catch (e) {}
}

function triggerChange() {
  if (typeof onChange === "function") onChange(getFilterState());
}

export function updateBulkRow(selectedCount) {
  const row = document.getElementById("usersBulkRow");
  const info = document.getElementById("usersSelectedInfo");
  if (!row || !info) return;
  if (selectedCount > 0) {
    row.style.display = "flex";
    info.textContent = "Выделено: " + selectedCount;
  } else {
    row.style.display = "none";
  }
}

export function applyFilters(users) {
  let result = users.slice();

  if (state.search) {
    const q = state.search.toLowerCase();
    result = result.filter(u => (u.login || "").toLowerCase().includes(q));
  }
  if (state.role) {
    result = result.filter(u => u.role === state.role);
  }
  if (state.division) {
    result = result.filter(u => u.division === state.division);
  }
  if (state.onlyWarn) {
    result = result.filter(u => (u.warn || 0) > 0);
  }
  if (state.onlyBanned) {
    result = result.filter(u => u.banned || (u.warn || 0) >= 3);
  }

  // Сортировка
  result.sort((a, b) => {
    let va = a[state.sortBy];
    let vb = b[state.sortBy];
    if (state.sortBy === "warn") { va = va || 0; vb = vb || 0; }
    if (state.sortBy === "lastSeen") { va = va || 0; vb = vb || 0; }
    if (va == null) va = "";
    if (vb == null) vb = "";

    let cmp;
    if (typeof va === "number" && typeof vb === "number") {
      cmp = va - vb;
    } else {
      cmp = String(va).localeCompare(String(vb), "ru");
    }
    return state.sortDir === "asc" ? cmp : -cmp;
  });

  return result;
}

export function toggleSort(field) {
  if (state.sortBy === field) {
    state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
  } else {
    state.sortBy = field;
    state.sortDir = "asc";
  }
  triggerChange();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) {
  return String(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
