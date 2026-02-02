# R5 Подача жалоб

**Версия:** 2.1.0
**Дата:** 02 февраля 2026
**Chrome Extension** для автоматизации подачи жалоб на отзывы Wildberries

[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](https://github.com/Klimov-IS/R5_extension_podacha_jalob)
[![Chrome](https://img.shields.io/badge/chrome-Manifest%20V3-green.svg)](https://www.google.com/chrome/)

---

## Описание

Расширение для Chrome, автоматизирующее процесс подачи жалоб на негативные отзывы в личном кабинете продавца Wildberries (`seller.wildberries.ru`).

### Основной функционал:
- **Автоматическая подача жалоб** - заполнение и отправка форм без ручного вмешательства
- **Status Sync** - синхронизация статусов отзывов с Backend в реальном времени
- **Интеграция с Backend API** - получение задач и отправка статистики
- **Пакетная обработка** - до 300 жалоб за один запуск
- **Детальная статистика** - отчёты по обработанным жалобам

---

## Быстрый старт

### Установка

1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/Klimov-IS/R5_extension_podacha_jalob.git
   ```
2. Установите зависимости:
   ```bash
   npm install
   ```
3. Соберите проект:
   ```bash
   npm run build
   ```
4. Откройте Chrome → `chrome://extensions`
5. Включите **"Режим разработчика"**
6. Нажмите **"Загрузить распакованное расширение"**
7. Выберите папку проекта

### Использование

1. Откройте страницу WB с отзывами:
   `https://seller.wildberries.ru/feedbacks/feedbacks-tab/answered`

2. Откройте страницу диагностики расширения:
   `diagnostic.html` (правый клик на иконке расширения → "Диагностика")

3. Выберите магазин из выпадающего списка

4. Нажмите **"Начать тест"**

5. Расширение автоматически:
   - Загрузит жалобы из Backend (до 300 шт)
   - Найдёт соответствующие отзывы на странице WB
   - Подаст жалобы
   - Синхронизирует статусы с Backend

---

## Архитектура

### Manifest V3
- **Service Worker** вместо background page
- **Webpack Bundle** для content scripts
- **ES6 Modules**
- **Message Passing** между компонентами

### Структура файлов

```
R5 подача жалоб/
├── manifest.json              # Манифест расширения
├── webpack.config.js          # Конфигурация Webpack
├── package.json               # NPM dependencies
├── diagnostic.html            # Страница диагностики (основной UI)
├── popup.html                 # Popup расширения
│
├── dist/                      # Production bundle
│   └── content-main-world.bundle.js
│
├── src/
│   ├── diagnostic.js          # Логика страницы диагностики
│   ├── popup.js               # Логика popup
│   │
│   ├── background/            # Service Worker
│   │   ├── index.js           # Точка входа
│   │   ├── message-router.js  # Роутер сообщений
│   │   └── handlers/          # Обработчики запросов
│   │       ├── complaints-handler.js
│   │       ├── status-sync-handler.js  # Status Sync
│   │       └── ...
│   │
│   ├── contents/complaints/   # Content Scripts
│   │   ├── content.js         # Entry point (ISOLATED world)
│   │   ├── main-world-entry.js # Webpack entry (MAIN world)
│   │   ├── utils.js           # Утилиты
│   │   │
│   │   ├── dom/               # Работа с DOM
│   │   │   ├── data-extractor.js
│   │   │   └── element-finder.js
│   │   │
│   │   ├── services/          # Бизнес-логика
│   │   │   ├── complaint-service.js
│   │   │   ├── navigation-service.js
│   │   │   └── ...
│   │   │
│   │   └── handlers/
│   │       └── optimized-handler.js  # Основной обработчик
│   │
│   └── services/              # Общие сервисы
│       ├── status-sync-service.js    # Синхронизация статусов
│       ├── settings-service.js       # Настройки
│       └── ...
│
└── docs/                      # Документация
```

---

## Workflow: Подача жалоб

```
1. Пользователь открывает diagnostic.html
   ↓
2. Выбирает магазин, нажимает "Начать тест"
   ↓
3. diagnostic.js запрашивает жалобы из Backend
   → GET /api/extension/stores/{storeId}/complaints?take=300
   ↓
4. Отправляет список в content.js
   → chrome.tabs.sendMessage({ type: "test4Diagnostics", complaints: [...] })
   ↓
5. OptimizedHandler обрабатывает каждую жалобу:
   │
   ├── Поиск отзыва по ключу: {productId}_{rating}_{date}
   │
   ├── Если найден → ComplaintService.submitComplaint()
   │   ├── Открывает меню (три точки)
   │   ├── Кликает "Пожаловаться"
   │   ├── Заполняет форму
   │   ├── Отправляет жалобу
   │   └── Отмечает в API как отправленную
   │
   └── Status Sync (после каждой страницы):
       → POST /api/extension/review-statuses
       → Синхронизирует статусы ВСЕХ отзывов на странице
   ↓
6. Показывает финальную статистику
```

---

## Status Sync

Функция синхронизации статусов отзывов с Backend.

### Как работает:
- После обработки каждой страницы отправляются статусы **всех** отзывов
- Данные отправляются в фоне (fire-and-forget), не блокируя основной процесс
- Backend становится единым источником правды о статусах отзывов

### API:
```
POST /api/extension/review-statuses
GET  /api/extension/review-statuses?storeId=...&limit=50
```

### Данные:
```json
{
  "storeId": "sTtXcI2WoTTF4Nmbng6N",
  "reviews": [
    {
      "productId": "649502497",
      "rating": 1,
      "reviewDate": "2026-01-07T20:09:37.000Z",
      "key": "649502497_1_2026-01-07T20:09:37.000Z",
      "statuses": ["Жалоба отклонена", "Выкуп"]
    }
  ]
}
```

---

## Backend API

### Base URL
```
http://158.160.217.236
```

### Endpoints

#### Получение магазинов
```http
GET /api/extension/stores
Authorization: Bearer {token}
```

#### Получение жалоб
```http
GET /api/extension/stores/{storeId}/complaints?skip=0&take=300
Authorization: Bearer {token}
```

#### Отметка жалобы как отправленной
```http
POST /api/extension/stores/{storeId}/reviews/{reviewId}/complaint/sent
Authorization: Bearer {token}
```

#### Синхронизация статусов
```http
POST /api/extension/review-statuses
Authorization: Bearer {token}
```

---

## Сборка

```bash
# Установка зависимостей
npm install

# Development (с watch)
npm run build:dev

# Production
npm run build

# Линтинг
npm run lint
npm run lint:fix

# Форматирование
npm run format
```

**После изменений в `src/contents/complaints/`:**
1. `npm run build`
2. Перезагрузить расширение в `chrome://extensions`
3. Обновить страницу WB (F5)

---

## Конфигурация

### manifest.json

**Permissions:**
- `activeTab`, `scripting`, `tabs`, `storage`

**Host Permissions:**
- `*://seller.wildberries.ru/*`
- `http://158.160.217.236/*`

### Настройки

Токен и endpoint Backend настраиваются в `src/services/settings-service.js`:
```javascript
// Default endpoint
const defaultEndpoint = 'http://158.160.217.236';

// Hardcoded token (временное решение)
const HARDCODED_TOKEN = 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
```

---

## Troubleshooting

### Content scripts не загружаются
1. Проверьте что bundle собран: `npm run build`
2. Перезагрузите расширение в `chrome://extensions`
3. Обновите страницу WB (F5)
4. Проверьте в консоли WB:
   ```javascript
   typeof window.WBUtils          // → 'object'
   typeof window.OptimizedHandler // → 'function'
   ```

### Магазины не загружаются
1. Проверьте доступность API: `http://158.160.217.236/api/extension/stores`
2. Проверьте токен в settings-service.js

### Ошибка "Content script не отвечает"
1. Убедитесь что открыта страница `seller.wildberries.ru/feedbacks`
2. Перезагрузите страницу WB (F5)

---

## История версий

### v2.1.0 (02.02.2026)
- **Status Sync** - синхронизация статусов всех отзывов с Backend
- **Автоматическая подача** - убрана задержка 20 сек и confirm для первой жалобы
- **Увеличен лимит** - до 300 жалоб за запрос
- **diagnostic.html** - основной UI для запуска

### v2.0.1 (30.01.2026)
- Webpack Bundle для content scripts
- Оптимизация загрузки (37 KB минифицированный bundle)

### v2.0.0 (30.01.2026)
- Упрощение архитектуры (-3200 строк кода)
- Удаление Google Sheets интеграции
- Manifest V3

---

## Разработка

### Code Style
- ES6+ syntax
- ES6 Modules
- JSDoc комментарии
- Логирование с префиксами: `[ModuleName]`

### Тестирование в консоли WB
```javascript
// Проверка модулей
window.WBUtils
window.DataExtractor
window.OptimizedHandler

// Получение статусов
await window.OptimizedHandler.getReviewStatuses('storeId', { limit: 50 });
```

---

## Ссылки

- **GitHub:** https://github.com/Klimov-IS/R5_extension_podacha_jalob
- **Issues:** https://github.com/Klimov-IS/R5_extension_podacha_jalob/issues

---

**Лицензия:** Proprietary - Все права защищены
