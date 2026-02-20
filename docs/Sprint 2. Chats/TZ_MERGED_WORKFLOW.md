# ТЗ: Объединённый воркфлоу — Жалобы + Чаты

> **Для:** Backend-команда
> **От:** Extension-команда
> **Дата:** 2026-02-19
> **Sprint:** 2 — Review-Chat Linking
> **Статус:** Обе стороны реализованы. Готово к интеграционному тестированию.
> **Обновлено:** 2026-02-19 — обратная связь от бэкенда, все API готовы

---

## 1. Что изменилось

Расширение теперь выполняет **один объединённый процесс** при обработке магазина:

```
Пользователь выбирает магазин → нажимает "Обработать"
    ↓
Расширение:
  1. Получает жалобы (GET /complaints) ← как раньше
  2. Получает правила чатов (GET /chat/stores/{id}/rules) ← НОВОЕ
  3. Парсит страницу отзывов WB
  4. Для каждого отзыва:
     - Если подходит для жалобы → подаёт жалобу
     - Если подходит для чата  → открывает чат + регистрирует в API
  5. Синхронизирует статусы (POST /review-statuses) ← как раньше
```

**Раньше:** расширение только подавало жалобы.
**Теперь:** расширение подаёт жалобы И открывает чаты за один проход.

---

## 2. Что готово на стороне расширения

### Реализовано и собирается (build OK)

| Компонент | Файл | Что делает |
|-----------|------|-----------|
| **ChatAPI** | `src/services/chat-api.js` | API клиент: `getChatRules()`, `chatOpened()`, `sendAnchor()`, `logError()` |
| **ChatHandler** | `src/background/handlers/chat-handler.js` | Background: обнаружение вкладки чата, парсинг якоря, закрытие вкладки |
| **ChatService** | `src/contents/complaints/services/chat-service.js` | Main world: клик по кнопке чата, bridge к background |
| **MessageRouter** | `src/background/message-router.js` | Добавлены роуты: `getChatRules`, `processChatTab` |
| **Content bridge** | `src/contents/complaints/content.js` | Bridge: `wb-chat-request`, `wb-chat-rules-request` |
| **OptimizedHandler** | `src/contents/complaints/handlers/optimized-handler.js` | Интеграция: `_tryOpenChat()`, `_fetchChatRules()`, chat stats в отчёте |
| **StatusSync** | `src/services/status-sync-service.js` | Передаёт `chatStatus` (уже работает, задеплоено) |

### Ещё не реализовано в расширении

| Что | Почему | Когда |
|-----|--------|-------|
| Отправка сообщений в чат | MVP — только открытие | Sprint 2, Phase 2 |
| Отдельный UI для чатов | Не нужен — объединённый воркфлоу | Не планируется |

---

## 3. Как расширение принимает решение об открытии чата

### Текущая логика `_tryOpenChat()` — проверяет ВСЕ условия:

```
✅ 1. Артикул есть в правилах бэкенда (chatEnabled = true)
✅ 2. Рейтинг отзыва входит в starsAllowed
✅ 3. Кнопка чата на странице WB = серая (chat_available — новый чат)
✅ 4. У отзыва есть статус «Жалоба отклонена»
✅ 5. У отзыва НЕТ блокирующих статусов:
     - «Жалоба одобрена»
     - «Исключен из рейтинга»
     - «Дополнен»
     - «Снят с публикации»
```

**НЕ открываем чат если:**
- Кнопка чёрная (`chat_opened` — чат уже существует)
- Кнопка disabled (`chat_not_activated` — чаты не активированы)
- Нет статуса «Жалоба отклонена» (не было подачи жалобы)
- Есть любой из блокирующих статусов

---

## 4. Что нужно от бэкенда

### 4.1 Правила работы в существующем API магазинов

**Проблема:** Сейчас расширение делает 2 отдельных запроса:
1. `GET /api/extension/stores` — получает список магазинов
2. `GET /api/extension/chat/stores/{storeId}/rules` — получает правила чатов

**Предложение:** Включить правила работы по артикулам **в существующий API магазинов**, чтобы расширение сразу знало по какому магазину какие действия доступны.

#### Вариант A: Расширить `GET /api/extension/stores`

Добавить поле `articleRules` в ответ каждого магазина:

```json
{
  "stores": [
    {
      "id": "store_abc123",
      "name": "Мой магазин",
      "isActive": true,
      "draftComplaintsCount": 15,
      "chatEnabled": true,
      "pendingChatsCount": 8,
      "articleRules": [
        {
          "nmId": "649502497",
          "productTitle": "Футболка мужская",
          "isActive": true,
          "complaintsEnabled": true,
          "chatEnabled": true,
          "starsAllowed": [1, 2, 3],
          "requiredComplaintStatus": "rejected"
        },
        {
          "nmId": "341213496",
          "productTitle": "Кроссовки женские",
          "isActive": true,
          "complaintsEnabled": true,
          "chatEnabled": false,
          "starsAllowed": [1, 2],
          "requiredComplaintStatus": "rejected"
        }
      ],
      "globalLimits": {
        "maxComplaintsPerRun": 300,
        "maxChatsPerRun": 50,
        "cooldownBetweenChatsMs": 3000
      }
    }
  ]
}
```

#### Вариант B: Отдельный эндпоинт (текущий контракт)

Оставить `GET /api/extension/chat/stores/{storeId}/rules` как есть. Расширение будет делать дополнительный запрос при старте обработки.

**Расширение поддерживает оба варианта** — сейчас используется Вариант B (отдельный запрос `getChatRules`). Если бэкенд реализует Вариант A, мы перейдём на него.

### 4.2 Поля правил — что нужно расширению

Для каждого артикула расширение ожидает:

| Поле | Тип | Описание | Пример |
|------|-----|----------|--------|
| `nmId` | string | Артикул WB | `"649502497"` |
| `isActive` | boolean | Товар активен | `true` |
| `chatEnabled` | boolean | Открытие чатов разрешено | `true` |
| `starsAllowed` | number[] | Разрешённые рейтинги для чата | `[1, 2, 3]` |
| `requiredComplaintStatus` | string | Обязательный статус жалобы | `"rejected"` |

Глобальные лимиты:

| Поле | Тип | Описание | Default |
|------|-----|----------|---------|
| `maxChatsPerRun` | number | Макс. чатов за один запуск | `50` |
| `cooldownBetweenChatsMs` | number | Пауза между открытиями (мс) | `3000` |

### 4.3 Chat API эндпоинты

Все 4 эндпоинта **задеплоены и готовы** (Sprint 002, 2026-02-16):

| # | Метод | Эндпоинт | Статус |
|---|-------|----------|--------|
| 1 | GET | `/api/extension/chat/stores/{storeId}/rules` | **Ready** (rules/route.ts) |
| 2 | POST | `/api/extension/chat/opened` | **Ready** (opened/route.ts) |
| 3 | POST | `/api/extension/chat/{chatRecordId}/anchor` | **Ready** (anchor/route.ts) |
| 4 | POST | `/api/extension/chat/{chatRecordId}/error` | **Ready** (error/route.ts) |

> **Base URL:** тот же что и для complaints — `settingsService.getBackendEndpoint()`.
> **Auth:** тот же Bearer token.

#### POST /chat/opened — что отправляет расширение

```json
{
  "storeId": "store_abc123",
  "reviewContext": {
    "nmId": "649502497",
    "rating": 1,
    "reviewDate": "2026-01-07T20:09:37.000Z",
    "reviewKey": "649502497_1_2026-01-07T20:09"
  },
  "chatUrl": "https://seller.wildberries.ru/chat-with-clients?chatId=a8775c6f-049b-da67-1045-421477a8bfcb",
  "openedAt": "2026-02-19T14:30:00.000Z",
  "status": "CHAT_OPENED"
}
```

Ожидаемый ответ:
```json
{
  "success": true,
  "chatRecordId": "uuid-here",
  "reviewMatched": true,
  "message": "Chat record created"
}
```

#### POST /chat/{chatRecordId}/anchor — что отправляет расширение

```json
{
  "systemMessageText": "Чат с покупателем по товару 649502497",
  "parsedNmId": "649502497",
  "parsedProductTitle": "",
  "anchorFoundAt": "2026-02-19T14:30:05.000Z",
  "status": "ANCHOR_FOUND"
}
```

---

## 5. Как расширение обрабатывает вкладку чата

Детальный flow для отладки:

```
1. OptimizedHandler сканирует строку отзыва на странице WB
2. Проверяет условия (раздел 3)
3. ChatService кликает кнопку чата в строке отзыва
   → WB открывает новую вкладку: /chat-with-clients?chatId={UUID}
4. Background (ChatHandler) обнаруживает вкладку:
   → Polling: chrome.tabs.query({ url: '*://seller.wildberries.ru/chat-with-clients*' })
   → Ждёт загрузку (status: 'complete')
   → Ждёт 3 секунды рендеринга
5. Background вызывает POST /chat/opened → получает chatRecordId
6. Background инжектит скрипт в вкладку чата:
   → chrome.scripting.executeScript()
   → Ищет системное сообщение: "Чат с покупателем по товару {nmId}"
   → Извлекает nmId из текста
7. Background вызывает POST /chat/{chatRecordId}/anchor
8. Background закрывает вкладку: chrome.tabs.remove(tabId)
9. Результат возвращается в OptimizedHandler → обновляет отчёт
```

**Время на один чат:** ~5-7 секунд (клик + загрузка + парсинг + API + закрытие)
**Cooldown между чатами:** настраивается через `cooldownBetweenChatsMs` (default 3000мс)

---

## 6. Отчёт расширения — новые поля

Отчёт `runTest4Diagnostics` теперь включает:

```json
{
  "timestamp": "2026-02-19T14:30:00.000Z",
  "complaintsReceived": 25,
  "submitted": 18,
  "skipped": 3,
  "errors": 1,

  "chatsOpened": 8,
  "chatsSkipped": 2,
  "chatErrors": 1,
  "chatRulesLoaded": true,

  "totalReviewsSynced": 150,
  "chatStatusStats": {
    "chat_available": 45,
    "chat_opened": 30,
    "chat_not_activated": 75
  },

  "overallStatus": "SUCCESS - подано 18 жалоб, открыто 8 чатов"
}
```

---

## 7. Checklist — статус интеграции

> Обновлено 2026-02-19 по обратной связи от бэкенда

- [x] **GET /chat/stores/{storeId}/rules** — Done. Формат полностью совпадает с контрактом
- [x] **POST /chat/opened** — Done. UPSERT на (store_id, review_key), повторный вызов → 200 OK
- [x] **POST /chat/{id}/anchor** — Done. ANCHOR_FOUND / ANCHOR_NOT_FOUND, перематчивает review_id
- [x] **POST /chat/{id}/error** — Done. errorCode, errorMessage, stage
- [x] Идемпотентность POST /chat/opened — Done
- [x] Fuzzy matching DATE_TRUNC ± 2 мин — Done, fallback на anchor nmId
- [ ] **Отложено:** включить `articleRules` в `GET /api/extension/stores` (Вариант A — когда появится реальная потребность)

### Известный нюанс: URL формат chatId

Бэкенд regex `extractChatIdFromUrl` ожидает `/chats/{id}`, а WB формат:
```
https://seller.wildberries.ru/chat-with-clients?chatId=a8775c6f-...
```
**Влияние:** некритично — `chat_id` заполняется позже при dialogue sync reconciliation.
**Рекомендация:** бэкенду обновить regex на поддержку `?chatId=` формата.

---

## 8. Ответы на вопросы (закрыты 2026-02-19)

| # | Вопрос | Ответ |
|---|--------|-------|
| 1 | Base URL — тот же сервер? | **Да.** Chat API на том же сервере. Один `getBackendEndpoint()` |
| 2 | Вариант A vs B? | **Вариант B** (отдельный endpoint). Переход на A — позже, как оптимизация |
| 3 | Лимиты на POST /chat/opened? | **Нет.** Расширение само соблюдает maxChatsPerRun=50, cooldown=3s. Достаточно |
| 4 | Блокирующие статусы — дополнять? | **Нет.** Текущий список корректный |

---

## 9. Связанные документы

- [API_CHATS_CONTRACT.md](API_CHATS_CONTRACT.md) — полный контракт Chat API
- [TZ_CHAT_STATUS_API.md](TZ_CHAT_STATUS_API.md) — парсинг chatStatus (задеплоено)
- [EXTENSION_INTEGRATION_GUIDE.md](EXTENSION_INTEGRATION_GUIDE.md) — гайд интеграции
- `docs/BACKEND_API.md` — документация текущего API расширения
