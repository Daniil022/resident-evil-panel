// js/admin/admin-sections.js
// Реестр разделов панели администратора.

export const ADMIN_SECTIONS = [
  {
    id: "logs",
    icon: "📢",
    title: "Логи семьи",
    desc: "Журнал действий + ссылка на VK",
    role: "gold"
  },
  {
    id: "backup",
    icon: "💾",
    title: "Резервная копия",
    desc: "Создать, скачать, восстановить, экспорт/импорт",
    role: "gold"
  },
  {
    id: "cloud",
    icon: "📦",
    title: "Облачные бэкапы",
    desc: "Автобэкапы в Firestore, чистка старых",
    role: ""
  },
  {
    id: "users",
    icon: "⚙️",
    title: "Управление участниками",
    desc: "Создать, PIN, роль, отряд, warn, удалить",
    role: "gold"
  },
  {
    id: "roles",
    icon: "🎖",
    title: "Редактор ролей",
    desc: "Создание, редактирование, порядок",
    role: ""
  },
  {
    id: "divisions",
    icon: "🎯",
    title: "Редактор подразделений",
    desc: "Создание, редактирование, порядок",
    role: "blue"
  },
  {
    id: "registry",
    icon: "📋",
    title: "Реестр участников",
    desc: "Таблица, фильтры, массовые действия",
    role: ""
  },
  {
    id: "history",
    icon: "📜",
    title: "Полная история",
    desc: "Логи с фильтрами по автору, типу, цели",
    role: ""
  }
];

export function getSection(id) {
  return ADMIN_SECTIONS.find(s => s.id === id) || null;
}
