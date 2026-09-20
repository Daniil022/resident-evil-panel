# RESIDENT EVIL Panel

Веб-панель для семьи (фамы) в игре **LIVE RUSSIA**. Стиль — корпорация Umbrella из Resident Evil: тёмная тема, циан-акценты, терминальный интерфейс.

**Живая версия:** https://resident-evil-panel.vercel.app

---

## Содержание

- [Что это](#что-это)
- [Возможности](#возможности)
- [Стек](#стек)
- [Структура проекта](#структура-проекта)
- [Быстрый старт](#быстрый-старт)
- [Настройка Firebase](#настройка-firebase)
- [Настройка Vercel + VK](#настройка-vercel--vk)
- [Роли и права](#роли-и-права)
- [Как добавить новый раздел](#как-добавить-новый-раздел)
- [Демо-режим](#демо-режим)
- [Известные особенности](#известные-особенности)
- [Конвенции кода](#конвенции-кода)
- [Инструкция для команды фамы](#инструкция-для-команды-фамы)

---

## Что это

Панель управления семьёй внутри игры LIVE RUSSIA. Заменяет Discord-сервера и Google-таблицы: всё в одном месте — состав, контракты, склад, чат, заявки, роли.

**Для кого:**
- **Лидер и зам** — управляют составом, ролями, контрактами, заявками.
- **Участники** — смотрят состав, сдают контракты, общаются в чате.
- **Союзники** — доступ к общему чату союзников, ограниченный доступ к разделам.

---

## Возможности

### Для всех участников
- **Дашборд** — статистика семьи: участники, онлайн, казна, войны, контракты, сообщения.
- **Игровые ники** — реестр участников с ролями и подразделениями.
- **Ранги** — список ролей и подразделений семьи.
- **Контракты** — задания с наградой, сдача отчётов с фото/видео, автопрогресс с призами.
- **Акколада** — награды и заслуги.
- **Капты** — доска объявлений (срочные сборы, цели).
- **Союз семьи** — список союзников, врагов, нейтралов.
- **Музыка** — общий плейлист с альбомами.
- **Правила** — устав семьи.
- **Фотоальбом** — галерея с альбомами и лайтбоксом.
- **Чат резидентов** — общий чат с реакциями, ответами, редактированием, закрепом, голосовыми.
- **Чат союзников** — отдельный чат для союзников.
- **Онлайн** — кто сейчас в сети.
- **Профиль** — аватарка, возраст, ГС, статистика.

### Только для лидера и зама
- **ADMIN** — управление участниками (создание, удаление, смена PIN/роли/подразделения).
- **Warn-система** — предупреждения, при 3 = бан.
- **Редактор ролей** — создание, редактирование, перемещение, удаление ролей.
- **Редактор подразделений** — то же для подразделений.
- **Заявки** — регистрация, аттестация, ники.
- **Backup** — скачивание и восстановление всех данных.
- **Логи** — история действий.

### Аудио-уведомления
- Разные звуки для чата, контрактов, заявок.
- Настройки в шапке (кнопка 🔔): вкл/выкл, громкость, тесты.

---

## Стек

- **Frontend:** vanilla JS (ES-модули), HTML, CSS. Без фреймворков.
- **Backend (BaaS):** Firebase Firestore (данные), Firebase Auth (не используется — своя PIN-система).
- **Хостинг:** Vercel (статика + serverless-функция `api/upload.js`).
- **Загрузка файлов:** VK API (сообщения в беседы), через `api/upload.js`.
- **Хранение сессии:** localStorage (7 дней).

---

## Структура проекта

```
resident-evil-panel/
├── index.html                    # Главный HTML, всё в одном файле
├── vercel.json                   # MIME-типы для Vercel
├── README.md
├── api/
│   └── upload.js                 # Serverless: загрузка в VK
├── css/
│   ├── variables.css             # CSS-переменные (цвета, тени, радиусы)
│   ├── base.css                  # Базовые стили, toast, скроллбар
│   ├── auth.css                  # Экран входа/регистрации
│   ├── header.css                # Шапка + навигация
│   ├── panels.css                # Панели, карточки, кнопки, формы
│   ├── dashboard.css             # Дашборд
│   ├── chat.css                  # Чаты (резиденты, союзники, ЛС)
│   ├── contracts.css             # Контракты
│   ├── roles.css                 # Роли, бейджи, редактор
│   ├── music.css                 # Музыка
│   ├── album.css                 # Фотоальбом, лайтбокс
│   ├── profile.css               # Профиль, аватарки
│   └── modal.css                 # Модалка
└── js/
    ├── main.js                   # Точка входа
    ├── firebase-init.js          # Firebase-конфиг
    ├── core/                     # Ядро
    │   ├── auth.js               # Логин, CRUD юзеров, warn
    │   ├── state.js              # Сессия
    │   ├── router.js             # Переключение вкладок
    │   ├── utils.js              # Toast, модалка, формат даты
    │   ├── roles.js              # Роли (CRUD + Firestore)
    │   ├── divisions.js          # Подразделения
    │   ├── colorize.js           # Цвета ролей/подразделений
    │   ├── cache.js              # Кэш в памяти
    │   ├── dashboard.js          # Дашборд
    │   ├── perf.js               # debounce/throttle/raf
    │   ├── sounds.js             # Аудио-уведомления
    │   └── sounds-panel.js       # Плашка настроек звука
    ├── modules/
    │   ├── nicks.js              # Ники + ранги
    │   ├── contracts/            # Контракты
    │   │   ├── contracts.js
    │   │   ├── contracts-rewards.js
    │   │   └── contracts-upload.js
    │   ├── chat/                 # Чаты
    │   │   ├── chat.js           # Основной чат
    │   │   ├── chat-render.js    # Рендер сообщений
    │   │   ├── chat-voice.js     # Запись голосовых
    │   │   ├── chat-voice-ui.js  # UI кнопки записи
    │   │   ├── chat-presence.js  # Онлайн/печатает
    │   │   ├── chat-reactions.js # Реакции
    │   │   ├── chat-read.js      # Прочтения
    │   │   ├── chat-scroll.js    # Скролл
    │   │   ├── chat-notifications.js
    │   │   └── chat-input.js     # (старый, не используется)
    │   ├── accolades.js          # Акколада
    │   ├── captas.js             # Капты
    │   ├── allies.js             # Союзы
    │   ├── music.js              # Музыка
    │   ├── rules.js              # Правила
    │   ├── album.js              # Фотоальбом
    │   ├── album-lightbox.js     # Лайтбокс
    │   ├── warehouse.js          # Склад (не подключён)
    │   ├── registration.js       # Заявки на регистрацию
    │   ├── applications-page.js  # Страница заявок
    │   ├── online.js             # Онлайн
    │   ├── profile.js            # Аватарка
    │   ├── profile-view.js       # Профиль участника
    │   ├── gestion.js            # Права (canEdit/requireEdit)
    │   ├── backup.js             # Backup/restore
    │   └── theme.js              # Темы (не подключён)
    └── admin/                    # Админка
        ├── admin-panel.js        # Основная панель
        ├── admin-users.js        # Таблица юзеров
        ├── admin-roles.js        # Редактор ролей
        ├── admin-divisions.js    # Редактор подразделений
        ├── admin-applications.js # Заявки на аттестацию
        ├── admin-nick-applications.js
        ├── admin-registration.js # Заявки на регистрацию
        ├── admin-forms.js        # Формы (не используется)
        └── admin-log.js          # Логи
```

---

## Быстрый старт

### Локально

Проект — статика + serverless. Для локальной разработки:

```bash
# 1. Клонировать
git clone https://github.com/Daniil022/resident-evil-panel.git
cd resident-evil-panel

# 2. Запустить локальный сервер (ES-модули не работают через file://)
npx serve .
# или
python -m http.server 8000
```

Открыть `http://localhost:3000` (или `:8000`).

**Важно:** `getUserMedia` (голосовые) работает только на `localhost` или HTTPS. Через `file://` не заработает.

### Деплой

Проект автоматически деплоится на Vercel при пуше в `main`. Ручной деплой:

```bash
npx vercel --prod
```

---

## Настройка Firebase

### 1. Создать проект

1. Зайти на https://console.firebase.google.com
2. Создать проект `resident-evil-panel`.
3. Включить **Firestore Database** (в production mode).
4. Скопировать конфиг из **Project settings → General → Your apps → Web**.

### 2. Вставить конфиг

В `js/firebase-init.js` заменить `firebaseConfig` на свой.

### 3. Правила Firestore

Для теста можно временно открыть всё:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Для продакшена — обязательно ограничить.** Минимальные правила:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Публичное чтение, запись — только авторизованным (по своей логике)
    match /users/{uid} {
      allow read: if true;
      allow write: if true; // ограничить по своим правилам
    }

    match /roles/{roleId} { allow read, write: if true; }
    match /divisions/{divId} { allow read, write: if true; }
    match /contracts/{c} { allow read, write: if true; }
    match /albums/{a} { allow read, write: if true; }
    match /album_photos/{p} { allow read, write: if true; }
    match /music/{m} { allow read, write: if true; }
    match /music_albums/{m} { allow read, write: if true; }
    match /allies/{a} { allow read, write: if true; }
    match /rules/{r} { allow read, write: if true; }
    match /accolades/{a} { allow read, write: if true; }
    match /captas/{c} { allow read, write: if true; }
    match /warehouse/{w} { allow read, write: if true; }

    match /registration_requests/{r} { allow read, write: if true; }
    match /applications/{a} { allow read, write: if true; }
    match /applications_nicks/{a} { allow read, write: if true; }

    match /chats/{chatId}/messages/{msgId} { allow read, write: if true; }
    match /chats/{chatId}/meta/{metaId} { allow read, write: if true; }
    match /chats/{chatId}/reads/{uid} { allow read, write: if true; }

    match /presence/{uid} { allow read, write: if true; }
  }
}
```

> **Важно:** это «открытые» правила, они не защищают данные. Для настоящей безопасности нужен Firebase Auth (сейчас его нет — своя PIN-система). Если планируешь рост — переходи на Firebase Auth с кастомными токенами.

### 4. Коллекции

Firestore создаёт коллекции автоматически при первой записи. Вот что используется:

| Коллекция | Что хранит |
|-----------|------------|
| `users` | Участники: login, pin, role, division, warn, banned, contracts, avatar |
| `roles` | Роли: name, color, desc, order, system |
| `divisions` | Подразделения: name, color, desc, order |
| `contracts` | Контракты: title, reward, status, media, submittedBy |
| `albums` | Альбомы: name, cover, createdBy, createdAt |
| `album_photos` | Фото: url, title, albumId, addedBy |
| `music` | Треки: title, artist, url, albumId |
| `music_albums` | Музыкальные альбомы |
| `allies` | Союзы: name, status, note |
| `rules` | Правила: title, text |
| `accolades` | Награды |
| `captas` | Капты: title, text, status |
| `warehouse` | Склад (не подключён к UI) |
| `registration_requests` | Заявки на регистрацию |
| `applications` | Заявки на аттестацию |
| `applications_nicks` | Заявки на ники |
| `chats/{chatId}/messages` | Сообщения чатов |
| `presence` | Онлайн/печатает |

---

## Настройка Vercel + VK

### 1. VK-сообщество

1. Создать сообщество ВК (тип — беседа или группа).
2. Создать **беседу** для загрузок (можно несколько: AVATARS, ALBUM, MUSIC, основная).
3. Получить **токен доступа** с правами `messages`, `photos`, `docs`.
4. Получить **peer_id** каждой беседы.

### 2. Переменные окружения в Vercel

В настройках проекта на Vercel (**Settings → Environment Variables**) добавить:

| Переменная | Что это |
|------------|---------|
| `VK_TOKEN` | Токен доступа ВК |
| `VK_PEER_ID` | ID основной беседы (для контрактов, голосовых) |
| `VK_PEER_AVATARS` | ID беседы для аватарок |
| `VK_PEER_ALBUM` | ID беседы для фотоальбома |
| `VK_PEER_MUSIC` | ID беседы для музыки |

### 3. Как работает `api/upload.js`

- Принимает `multipart/form-data` с полями: `file`, `filename`, `message`, `mediaType`.
- `mediaType` определяет беседу: `avatar`, `album`, `music`, `contract`, `voice`, `default`.
- Загружает в ВК через `photos.getMessagesUploadServer` (фото) или `docs.getMessagesUploadServer` (видео/аудио).
- Возвращает JSON: `{ ok, url, vk_link, attachment, ... }`.
- **`url`** — прямая ссылка на файл (для `<img src="">` и `<audio src="">`).

### 4. Если VK не настроен

Панель **не сломается** — все модули уходят в демо-режим (см. ниже).

---

## Роли и права

| Роль | ID | Права |
|------|----|----|
| **Император** | `emperor` | Всё. ADMIN, создание юзеров, роли, backup, логи. |
| **Лорд Тьмы** | `lord` | То же, что Император (зам). |
| **Рыцарь Смерти** | `knight` | Обычный участник, офицер. |
| **Скелет Ужаса** | `skeleton` | Обычный участник, офицер. |
| **Тёмная душа** | `soul` | Базовый участник (по умолчанию). |
| **Союзник** | `ally` | Ограниченный доступ: чат союзников, онлайн. Не видит контракты, склад, заявки. |

**Проверка прав в коде:**
```js
import { canEdit, requireEdit } from "./modules/gestion.js";

if (canEdit()) { /* emperor или lord */ }
if (!requireEdit()) return; // показывает toast и возвращает false
```

---

## Как добавить новый раздел

Пример: добавляем раздел «Склад» (warehouse).

### 1. Создать модуль `js/modules/warehouse.js`

```js
import { db } from "../firebase-init.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { canEdit } from "./gestion.js";

export async function initWarehouse() {
  const grid = document.getElementById("warehouseGrid");
  if (!grid) return;
  // ... логика
}
```

### 2. Добавить вкладку в `index.html`

```html
<button data-tab="warehouse" id="navWarehouse">🏭 Склад</button>
```

И секцию:

```html
<section class="panel" id="warehouse">
  <h2>🏭 Склад семьи</h2>
  <div class="grid" id="warehouseGrid"></div>
</section>
```

### 3. Подключить в `main.js`

```js
import { initWarehouse } from "./modules/warehouse.js";

// в enterApp, в блок lazy-init:
if (tab === "warehouse" && !ally && !inited.warehouse) {
  inited.warehouse = true;
  try { initWarehouse(); } catch (err) { console.warn(err); }
}
```

Добавить `warehouse: false` в объект `inited`.

### 4. Добавить CSS (если нужен) в `css/panels.css`

Используй существующие классы `.grid`, `.card`, `.btn`, `.form-field` — они уже стилизованы.

### 5. Если раздел для всех — добавить в `applyRoleVisibility`

Убедиться, что для `ally` он скрыт, если не нужен.

---

## Демо-режим

Если Firebase или VK недоступны, все модули автоматически падают в **демо-режим** на localStorage. Это позволяет:
- Работать без интернета.
- Тестировать без настройки Firebase.
- Не ломать панель при сбое сети.

**Ключи localStorage:**

| Ключ | Что хранит |
|------|------------|
| `re_panel_session` | Сессия (uid, login, role, ...) |
| `re_panel_demo_users` | Юзеры (демо) |
| `re_demo_roles` | Роли (демо) |
| `re_demo_divisions` | Подразделения (демо) |
| `re_demo_contracts_v2` | Контракты (демо) |
| `re_demo_albums_v2` | Альбомы (демо) |
| `re_demo_album_photos_v2` | Фото (демо) |
| `re_demo_registration_requests` | Заявки (демо) |
| `re_demo_applications` | Аттестации (демо) |
| `re_demo_nick_applications` | Ники (демо) |
| `re_demo_rules` | Правила (демо) |
| `re_demo_allies` | Союзы (демо) |
| `re_demo_accolades` | Награды (демо) |
| `re_demo_captas` | Капты (демо) |
| `re_demo_music_albums` | Муз. альбомы (демо) |
| `re_demo_music_tracks` | Треки (демо) |
| `re_demo_warehouse` | Склад (демо) |
| `re_panel_sound_settings` | Настройки звука |
| `chat_last_read_*` | Прочтения чатов |
| `chat_theme_*` | Темы чатов |

**Сбросить демо-данные:** очистить localStorage в DevTools → Application → Local Storage.

---

## Известные особенности

### Баги и недоделки (на момент последнего коммита)

1. **`state.js` — `isAdmin()`/`isLeader()`** сверяют роль с русскими названиями, а в сессии лежат ID (`emperor`, `lord`). Не используются, но если будешь подключать — поправь на ID.
2. **`warehouse.js`** — модуль есть, но не подключён (нет вкладки, нет вызова в `main.js`).
3. **`theme.js`** — тоже не подключён.
4. **`chat-stub.js`, `chat-input.js`, `admin-forms.js`** — мёртвые файлы, не используются.
5. **`dashboard.js`** — счётчик `dashMessages` берёт из `chats/main/messages`, а чаты в `chats/residents/messages` и `chats/allies/messages`. Счётчик всегда 0.
6. **Дубли `escapeHtml`/`hexRgba`/`formatDate`** в разных файлах (utils, gestion, admin-divisions, admin-roles, contracts, nicks).
7. **Личные сообщения (ЛС)** — не реализованы. Заготовка в планах.
8. **Правила Firestore** — для теста открыты, для прода надо ограничивать.

### Ограничения

- **Нет Firebase Auth** — своя PIN-система. Не защищает от прямого доступа к Firestore по API.
- **PIN хранится в открытом виде** в Firestore. Для прода — хэшировать (bcrypt/argon2), но это требует бэкенда.
- **VK-токен** — на сервере Vercel (env), в клиент не попадает. Это ок.
- **Загрузка файлов** — до 50 МБ, зависит от лимитов VK.
- **Голосовые** — до 2 минут (автостоп), MediaRecorder.
- **Чат** — 200 последних сообщений за раз (limit). Для истории нужно пагинировать.

---

## Конвенции кода

### Именование файлов
- Модули — `kebab-case.js` (`chat-render.js`, `admin-users.js`).
- CSS — `kebab-case.css` (`chat.css`, `album.css`).

### Экспорты
- Именованные экспорты: `export function initX()`, `export async function loadY()`.
- Один модуль = одна ответственность.

### Inline-обработчики в HTML
Многие модули вешают функции на `window.__x`, чтобы их можно было вызывать из `onclick` в шаблоне:
```js
window.__contractApprove = async function(id) { ... };
```
Это не идеально, но удобно для шаблонов. Если рефакторишь — заменяй на `addEventListener` и передачу колбэков.

### Модалки
```js
import { openModal, closeModal } from "./core/utils.js";

openModal({
  title: "ЗАГОЛОВОК",
  html: "<div>...</div>",
  confirmText: "СОХРАНИТЬ",
  onConfirm: () => { /* ... */ }
});
```

### Toast
```js
import { toast } from "./core/utils.js";
toast("Сообщение", "ok");   // зелёный
toast("Сообщение", "warn"); // жёлтый
toast("Сообщение");         // по умолчанию
```

### Проверка прав
```js
import { canEdit, requireEdit } from "./modules/gestion.js";

if (canEdit()) { /* показать кнопку редактирования */ }
if (!requireEdit()) return; // покажет toast и вернёт false
```

### Firestore + демо-fallback
```js
try {
  const snap = await getDocs(collection(db, "items"));
  items = snap.docs.map(d => ({ id: d.id, ...d.data(), source: "firebase" }));
} catch (e) {
  items = getDemoItems();
}
if (items.length === 0) items = getDemoItems();
```

---

## Инструкция для команды фамы

### Как войти

1. Открыть https://resident-evil-panel.vercel.app
2. Ввести **логин** (твой игровой ник, формат `Nick_Name`) и **PIN-код**.
3. Если аккаунта нет — нажать **«📝 Зарегистрироваться»**, заполнить ник и PIN, выбрать «Резидент» или «Союзник», отправить заявку. Лидер или зам одобрят.

**Первый вход (демо):** `Emperor` / PIN `1111`. Смени PIN сразу через ADMIN.

### Основные разделы

| Раздел | Что там |
|--------|---------|
| 📊 **Дашборд** | Общая статистика семьи: сколько участников, кто онлайн, казна, войны, контракты. |
| 👤 **Игровые ники** | Список всех участников. Нажми на ник — откроется профиль. |
| 🎖 **Ранги** | Все роли и подразделения семьи. |
| 📜 **Контракты** | Задания с наградой. Если у тебя есть контракт — нажми «Сдать отчёт», приложи фото/видео. Лидер одобрит — получишь награду. |
| 🏅 **Акколада** | Награды и заслуги семьи. Можно подать заявку на аттестацию. |
| 🎯 **Капты** | Доска объявлений: срочные сборы, цели, статусы. |
| 🤝 **Союз семьи** | Список союзников, врагов, нейтралов. |
| 🎵 **Музыка** | Общий плейлист. Лидер добавляет треки, все слушают. |
| 📖 **Правила** | Устав семьи. Обязательно к прочтению. |
| 📸 **Фото** | Галерея с альбомами. Кликни на альбом — откроются фото. Кликни на фото — лайтбокс. |
| 💬 **Общение** | Общий чат резидентов. Можно отправлять текст, голосовые (🎤), эмодзи, реакции, отвечать на сообщения. |
| 🤝 **Союз чат** | Отдельный чат для союзников. |
| 👥 **Онлайн** | Кто сейчас в сети. |
| 📥 **Заявки** | Только для лидера и зама. Сюда приходят заявки на регистрацию, аттестацию, ники. |
| ⚙ **ADMIN** | Только для лидера и зама. Управление составом, ролями, подразделениями, backup. |

### Голосовые сообщения

- В чате нажми и **удерживай** 🎤.
- Отпусти — отправится.
- **Свайп влево** во время записи — отмена.
- Максимум 2 минуты, автоматически отправится.
- Слишком короткие (<0.8 сек) не отправляются.

### Звук

- Кнопка **🔔** в шапке — настройки.
- Можно отключить звук чата, контрактов, заявок по отдельности.
- Громкость — ползунок.

### Если что-то не работает

1. **Обнови страницу** (Ctrl+F5).
2. **Проверь интернет** — панель работает и офлайн (демо), но данные не синхронизируются.
3. **Сообщи лидеру или заму** — они посмотрят логи в ADMIN.
4. **Если чат не грузится** — подожди, возможно, Firebase тормозит. Через минуту обнови.

### Правила безопасности

- **Не сообщай PIN никому**, даже лидеру. Лидер может сменить PIN через ADMIN без твоего участия.
- **Не передавай аккаунт** другим. За это Warn → бан.
- **3 Warn = бан**. Снять может только лидер.
- **Пароли не восстанавливаются** — если забыл PIN, лидер сбросит через ADMIN.

---

## Лицензия

Проект приватный, для семьи RESIDENT EVIL. Все права у автора (`Daniil022`).

## Контакты

- **GitHub:** https://github.com/Daniil022/resident-evil-panel
- **ВК-сообщество:** https://vk.com/resident_panel
