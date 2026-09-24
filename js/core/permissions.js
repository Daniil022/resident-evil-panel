// js/core/permissions.js
// Система прав: список прав + проверка у текущего юзера.

import { getCurrentUser } from "./state.js";
import { getRolePermissionsCache, getDivisionPermissionsCache } from "./permissions-cache.js";

// ==================== РЕЕСТР ПРАВ ====================
export const PERMISSIONS = {
  // Вкладки
  "tab.dashboard":    { group: "Вкладки", label: "Дашборд" },
  "tab.nicks":        { group: "Вкладки", label: "Игровые ники" },
  "tab.ranks":        { group: "Вкладки", label: "Ранги" },
  "tab.contracts":    { group: "Вкладки", label: "Контракты" },
  "tab.news":         { group: "Вкладки", label: "Новости" },
  "tab.premiums":     { group: "Вкладки", label: "Премии" },
  "tab.allies":       { group: "Вкладки", label: "Союз семьи" },
  "tab.music":        { group: "Вкладки", label: "Музыка" },
  "tab.rules":        { group: "Вкладки", label: "Правила" },
  "tab.album":        { group: "Вкладки", label: "Фото" },
  "tab.chat":         { group: "Вкладки", label: "Общение резидентов" },
  "tab.chat_allies":  { group: "Вкладки", label: "Союз чат" },
  "tab.online":       { group: "Вкладки", label: "Онлайн" },
  "tab.applications": { group: "Вкладки", label: "Заявки" },
  "tab.admin":        { group: "Вкладки", label: "ADMIN" },

  // Контракты
  "contracts.create":  { group: "Контракты", label: "Создавать" },
  "contracts.approve": { group: "Контракты", label: "Одобрять отчёты" },
  "contracts.submit":  { group: "Контракты", label: "Сдавать отчёты" },
  "contracts.delete":  { group: "Контракты", label: "Удалять" },

  // Новости
  "news.create":  { group: "Новости", label: "Добавлять" },
  "news.edit":    { group: "Новости", label: "Редактировать" },
  "news.delete":  { group: "Новости", label: "Удалять" },

  // Премии
  "premiums.give":   { group: "Премии", label: "Выдавать" },
  "premiums.delete": { group: "Премии", label: "Удалять" },

  // Союз
  "allies.edit":   { group: "Союз", label: "Редактировать" },
  "allies.delete": { group: "Союз", label: "Удалять" },

  // Музыка
  "music.add":    { group: "Музыка", label: "Добавлять треки" },
  "music.delete": { group: "Музыка", label: "Удалять треки" },

  // Правила
  "rules.edit": { group: "Правила", label: "Редактировать" },

  // Альбом
  "album.create":  { group: "Фотоальбом", label: "Создавать альбомы" },
  "album.upload":  { group: "Фотоальбом", label: "Загружать фото" },
  "album.delete":  { group: "Фотоальбом", label: "Удалять фото" },

  // Чат
  "chat.write":      { group: "Чат", label: "Писать" },
  "chat.voice":      { group: "Чат", label: "Голосовые" },
  "chat.files":      { group: "Чат", label: "Файлы" },
  "chat.polls":      { group: "Чат", label: "Опросы" },
  "chat.pin":        { group: "Чат", label: "Закреплять" },
  "chat.delete_all": { group: "Чат", label: "Удалять чужие" },

  // ADMIN
  "admin.users":        { group: "ADMIN", label: "Управление участниками" },
  "admin.roles":        { group: "ADMIN", label: "Редактор ролей" },
  "admin.divisions":    { group: "ADMIN", label: "Редактор подразделений" },
  "admin.registry":     { group: "ADMIN", label: "Реестр участников" },
  "admin.logs":         { group: "ADMIN", label: "Логи" },
  "admin.backups":      { group: "ADMIN", label: "Бэкапы" },
  "admin.applications": { group: "ADMIN", label: "Заявки" }
};

// ==================== ПРАВА ПО УМОЛЧАНИЮ ====================
// Что даётся роли, если в Firestore нет field "permissions"
export const DEFAULT_ROLE_PERMS = {
  emperor: "*",
  lord: "*",
  knight: [
    "tab.dashboard", "tab.nicks", "tab.ranks", "tab.contracts",
    "tab.news", "tab.premiums", "tab.allies", "tab.music",
    "tab.rules", "tab.album", "tab.chat", "tab.chat_allies",
    "tab.online",
    "contracts.submit",
    "chat.write", "chat.voice", "chat.files", "chat.polls"
  ],
  skeleton: [
    "tab.dashboard", "tab.nicks", "tab.ranks", "tab.contracts",
    "tab.news", "tab.premiums", "tab.allies", "tab.music",
    "tab.rules", "tab.album", "tab.chat", "tab.chat_allies",
    "tab.online",
    "contracts.submit",
    "chat.write", "chat.voice", "chat.files", "chat.polls"
  ],
  soul: [
    "tab.dashboard", "tab.nicks", "tab.ranks", "tab.contracts",
    "tab.news", "tab.premiums", "tab.allies", "tab.music",
    "tab.rules", "tab.album", "tab.chat", "tab.chat_allies",
    "tab.online",
    "contracts.submit",
    "chat.write", "chat.voice", "chat.files", "chat.polls"
  ],
  ally: [
    "tab.chat_allies",
    "tab.online",
    "chat.write"
  ]
};

// ==================== ПРОВЕРКА ====================
/**
 * Проверяет, есть ли у текущего юзера право.
 * @param {string} perm — например "contracts.create"
 * @returns {boolean}
 */
export function can(perm) {
  const me = getCurrentUser();
  if (!me) return false;

  // Собираем все права: от роли + от подразделения
  const rolePerms = getRolePermissionsCache(me.role);
  const divPerms = me.division ? getDivisionPermissionsCache(me.division) : null;

  // Если явно не задано в Firestore — используем DEFAULT_ROLE_PERMS
  const effectiveRolePerms = rolePerms !== null && rolePerms !== undefined
    ? rolePerms
    : (DEFAULT_ROLE_PERMS[me.role] || []);

  // "*" — разрешено всё
  if (effectiveRolePerms === "*" || divPerms === "*") return true;

  // Массивы
  const roleArr = Array.isArray(effectiveRolePerms) ? effectiveRolePerms : [];
  const divArr = Array.isArray(divPerms) ? divPerms : [];

  if (roleArr.includes("*") || divArr.includes("*")) return true;

  return roleArr.includes(perm) || divArr.includes(perm);
}

/**
 * Проверяет любое из прав.
 */
export function canAny(...perms) {
  return perms.some(p => can(p));
}

/**
 * Проверяет все права.
 */
export function canAll(...perms) {
  return perms.every(p => can(p));
}

/**
 * Хелперы для старых вызовов.
 */
export function isAdmin() {
  return can("tab.admin");
}
