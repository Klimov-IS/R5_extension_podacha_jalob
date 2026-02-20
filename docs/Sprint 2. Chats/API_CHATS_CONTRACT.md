# API Contract: Chat Workflow

> **Статус:** API задеплоен в прод (2026-02-16)
> **Автор:** Product / Extension team + Backend team
> **Дата:** 2026-02-16 (обновлено после ревью бэкенда)
> **Связанная задача:** [TASK_чаты.md](TASK_чаты.md)
> **Бэкенд-гайд:** [EXTENSION_INTEGRATION_GUIDE.md](EXTENSION_INTEGRATION_GUIDE.md)

---

## Контекст

Расширение Rating5 добавляет новый workflow — **работа с чатами WB**.
Бизнес-проблема: по API WB отзывы и чаты никак не связаны. Расширение будет:
1. Получать правила по магазинам/артикулам (какие отзывы обрабатывать)
2. На странице WB находить подходящие отзывы → открывать чат
3. Парсить данные из вкладки чата (URL, системное сообщение)
4. Отправлять собранные данные обратно в бэкенд (связка отзыв ↔ чат)

---

## Общие параметры

**Base URL:** `https://rating5.ru`

**Аутентификация:** `Authorization: Bearer {api_key}` (тот же токен, что для жалоб)

**Rate limit:** 100 запросов в минуту на токен

**Content-Type:** `application/json`

---

## 1. Что расширение получает от бэкенда

### 1.1 GET /api/extension/chat/stores

Получить список магазинов с информацией о чат-workflow.

**Request:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://rating5.ru/api/extension/chat/stores"
```

**Response (200 OK):**
```json
[
  {
    "id": "store_abc123",
    "name": "Мой Магазин WB",
    "isActive": true,
    "chatEnabled": true,
    "pendingChatsCount": 42
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| id | string | ID магазина (тот же, что в complaints) |
| name | string | Название магазина |
| isActive | boolean | Активен ли магазин |
| chatEnabled | boolean | Есть ли хотя бы один товар с `work_in_chats = true` |
| pendingChatsCount | number | Кол-во отзывов с отклонёнными жалобами, для которых ещё не открыт чат |

**Логика UI:** показывать только магазины где `isActive = true` и `chatEnabled = true`.

---

### 1.2 GET /api/extension/chat/stores/{storeId}/rules

Получить правила чат-обработки для конкретного магазина.

**Request:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://rating5.ru/api/extension/chat/stores/store_abc123/rules"
```

**Response (200 OK):**
```json
{
  "storeId": "store_abc123",
  "globalLimits": {
    "maxChatsPerRun": 50,
    "cooldownBetweenChatsMs": 3000
  },
  "items": [
    {
      "nmId": "649502497",
      "productTitle": "Футболка мужская",
      "isActive": true,
      "chatEnabled": true,
      "starsAllowed": [1, 2, 3],
      "requiredComplaintStatus": "rejected"
    },
    {
      "nmId": "812345678",
      "productTitle": "Куртка зимняя",
      "isActive": true,
      "chatEnabled": true,
      "starsAllowed": [1, 2, 3, 4],
      "requiredComplaintStatus": "rejected"
    }
  ]
}
```

**Поля `items[]`:**

| Field | Type | Description |
|-------|------|-------------|
| nmId | string | Артикул WB (для сопоставления с отзывами на странице) |
| productTitle | string | Название товара (для логов/отображения) |
| isActive | boolean | Товар активен |
| chatEnabled | boolean | Для этого товара включена работа с чатами (`product_rules.work_in_chats`) |
| starsAllowed | number[] | По каким звёздам работаем (собирается из `chat_rating_1..4`) |
| requiredComplaintStatus | string | Всегда `"rejected"` — жалоба должна быть отклонена |

**Поля `globalLimits`:**

| Field | Type | Description |
|-------|------|-------------|
| maxChatsPerRun | number | Максимум чатов за один запуск (default: 50) |
| cooldownBetweenChatsMs | number | Пауза между открытием чатов в мс (default: 3000) |

**Критерии отбора отзыва для открытия чата** (логика в расширении):
1. `nmId` отзыва совпадает с артикулом из правил
2. `isActive = true` И `chatEnabled = true`
3. Звёзды отзыва входят в `starsAllowed`
4. Статус жалобы на странице WB = **«Жалоба отклонена»** (маппится на `requiredComplaintStatus = "rejected"`)

---

## 2. Что расширение отправляет в бэкенд

### 2.1 POST /api/extension/chat/opened

Вызывается **сразу после открытия чата** (до парсинга системного сообщения).

**Request:**
```json
{
  "storeId": "store_abc123",
  "reviewContext": {
    "nmId": "649502497",
    "rating": 2,
    "reviewDate": "2026-01-07T20:09:37.000Z",
    "reviewKey": "649502497_2_2026-01-07T20:09"
  },
  "chatUrl": "https://seller.wildberries.ru/feedback-and-questions/chats/12345",
  "openedAt": "2026-02-16T14:30:00.000Z",
  "status": "CHAT_OPENED"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| storeId | string | Yes | ID магазина |
| reviewContext.nmId | string | Yes | Артикул WB |
| reviewContext.rating | number | Yes | Звёзды отзыва (1-5) |
| reviewContext.reviewDate | string | Yes | Дата отзыва ISO 8601 |
| reviewContext.reviewKey | string | Yes | Ключ: `"{nmId}_{rating}_{date_trunc_min}"` |
| chatUrl | string | Yes | Полный URL открытой вкладки чата |
| openedAt | string | Yes | Время открытия ISO 8601 |
| status | string | Yes | Всегда `"CHAT_OPENED"` |

**Формат reviewKey:**
```
reviewKey = "{nmId}_{rating}_{дата_обрезана_до_минуты}"
Пример:   "649502497_2_2026-01-07T20:09"
```

**Response (201 Created / 200 OK):**
```json
{
  "success": true,
  "chatRecordId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": "Chat record created",
  "reviewMatched": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| chatRecordId | string | UUID записи — **использовать во всех последующих запросах** |
| message | string | `"Chat record created"` (новый) или `"Chat record already exists"` (дубль) |
| reviewMatched | boolean | Удалось ли бэкенду найти matching отзыв в БД (fuzzy match по nmId + rating + date ±2 мин) |

**Идемпотентность:** UPSERT по `(store_id, review_key)`. **201** = новая запись, **200** = запись уже существует.

---

### 2.2 POST /api/extension/chat/{chatRecordId}/anchor

Вызывается после парсинга **системного сообщения** WB в чате.

**Request:**
```json
{
  "systemMessageText": "Чат с покупателем по товару Футболка мужская, артикул 649502497",
  "parsedNmId": "649502497",
  "parsedProductTitle": "Футболка мужская",
  "anchorFoundAt": "2026-02-16T14:30:05.000Z",
  "status": "ANCHOR_FOUND"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| systemMessageText | string | При ANCHOR_FOUND | Полный текст системного сообщения WB |
| parsedNmId | string | No | Артикул, извлечённый из текста (если удалось) |
| parsedProductTitle | string | No | Название товара из текста (если удалось) |
| anchorFoundAt | string | Yes | Время нахождения ISO 8601 |
| status | string | Yes | `"ANCHOR_FOUND"` или `"ANCHOR_NOT_FOUND"` |

**Алгоритм поиска системного сообщения:**
1. Ищем в текущем DOM (сообщение может быть видимым)
2. Если не нашли — скроллим вверх постепенно
3. На каждом шаге re-scan DOM
4. Стоп: нашли сообщение ИЛИ достигли начала истории

Матч по ключам (регистронезависимо): `чат`, `покупател`, `товар`

Если не нашли — отправляем `status: "ANCHOR_NOT_FOUND"`.

**Response (200 OK):**
```json
{
  "success": true,
  "reviewChatLinked": true,
  "message": "Review-chat association confirmed"
}
```

| Field | Type | Description |
|-------|------|-------------|
| reviewChatLinked | boolean | `true` если удалось связать с конкретным отзывом в БД |

> Ключевая ценность: бэкенд теперь имеет связку **отзыв ↔ чат** через `chatRecordId`, `reviewKey`, `chatUrl` и подтверждение из `systemMessageText`.

---

### 2.3 POST /api/extension/chat/{chatRecordId}/message-sent

Вызывается после отправки стартового сообщения покупателю (Sprint 2, не MVP).

**Request:**
```json
{
  "messageType": "A",
  "messageText": "Здравствуйте! Мы увидели ваш отзыв и хотели бы...",
  "sentAt": "2026-02-16T14:30:10.000Z",
  "status": "MESSAGE_SENT"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| messageType | string | No | `"A"` (1-3 звезды), `"B"` (4 звезды), `"NONE"` |
| messageText | string | No | Текст отправленного сообщения |
| sentAt | string | Yes | Время отправки ISO 8601 |
| status | string | Yes | `"MESSAGE_SENT"`, `"MESSAGE_SKIPPED"` (дубль), `"MESSAGE_FAILED"` |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Message status recorded"
}
```

---

### 2.4 POST /api/extension/chat/{chatRecordId}/error

Вызывается при ошибке **на любом этапе**.

**Request:**
```json
{
  "errorCode": "ERROR_ANCHOR_NOT_FOUND",
  "errorMessage": "System message not found after scrolling to top",
  "stage": "anchor_parsing",
  "occurredAt": "2026-02-16T14:30:15.000Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| errorCode | string | Yes | Код ошибки (см. таблицу) |
| errorMessage | string | Yes | Описание ошибки |
| stage | string | Yes | Этап: `"chat_open"`, `"anchor_parsing"`, `"message_send"` |
| occurredAt | string | Yes | Время ошибки ISO 8601 |

**Коды ошибок:**

| Code | Stage | Description |
|------|-------|-------------|
| ERROR_TAB_TIMEOUT | chat_open | Вкладка чата не загрузилась за таймаут |
| ERROR_ANCHOR_NOT_FOUND | anchor_parsing | Системное сообщение не найдено |
| ERROR_DOM_CHANGED | * | DOM изменился, элементы не найдены |
| ERROR_INPUT_NOT_FOUND | message_send | Поле ввода не найдено |
| ERROR_SEND_FAILED | message_send | Не удалось отправить сообщение |
| ERROR_CHAT_BLOCKED | chat_open | Чат заблокирован/ограничен |
| ERROR_UNKNOWN | * | Непредвиденная ошибка |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Error recorded"
}
```

---

## 3. Жизненный цикл записи чата

```
POST /chat/opened
    ↓ status = chat_opened
POST /chat/{id}/anchor
    ├─ status = anchor_found       (системное сообщение найдено)
    └─ status = anchor_not_found   (не найдено)
POST /chat/{id}/message-sent
    ├─ status = message_sent       (сообщение отправлено)
    ├─ status = message_skipped    (пропущено — дубль)
    └─ status = message_failed     (ошибка)
POST /chat/{id}/error
    └─ status = error              (любая ошибка)
```

---

## 4. Полный Data Flow

```
┌─ Расширение ─────────────────────────────────────────────┐
│                                                           │
│  1. GET /chat/stores              → список магазинов      │
│  2. GET /chat/stores/{id}/rules   → правила (артикулы)    │
│                                                           │
│  3. Парсим страницу WB, находим подходящие отзывы         │
│  4. Кликаем "Открыть чат" → открывается вкладка          │
│                                                           │
│  5. POST /chat/opened             → chatRecordId          │
│     (storeId, reviewContext, chatUrl)                      │
│                                                           │
│  6. Парсим системное сообщение в чате                     │
│  7. POST /chat/{id}/anchor        → связка подтверждена   │
│     (systemMessageText, parsedNmId)                       │
│                                                           │
│  8. [Sprint 2] Отправляем сообщение покупателю            │
│  9. POST /chat/{id}/message-sent  → статус записан        │
│                                                           │
│  При ошибке:                                              │
│  POST /chat/{id}/error            → ошибка залогирована   │
└───────────────────────────────────────────────────────────┘
```

---

## 5. Идемпотентность и дедупликация

### POST /chat/opened
- Повторный вызов с тем же `storeId` + `reviewKey` **не создаёт дубль**
- UPSERT по `UNIQUE(store_id, review_key)` в БД
- Возвращает существующий `chatRecordId` (HTTP 200 вместо 201)

### POST /chat/{id}/anchor
- Повторный вызов **перезаписывает** данные (последний парсинг = актуальный)

### Дедупликация сообщений (в расширении)
- Перед отправкой стартового сообщения проверить: есть ли уже исходящее от нас
- Если да — `status: "MESSAGE_SKIPPED"`

---

## 6. Ошибки API

**Формат:**
```json
{
  "error": "Error type",
  "message": "Human-readable description"
}
```

| Код | Описание |
|-----|----------|
| 200 | OK |
| 201 | Created (новая запись) |
| 400 | Bad Request (невалидные данные) |
| 401 | Unauthorized (нет/невалидный токен) |
| 403 | Forbidden (нет доступа к магазину) |
| 404 | Not Found (магазин/запись не найдены) |
| 429 | Too Many Requests (100 req/min лимит) |
| 500 | Internal Server Error |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2026-02-16T14:31:00.000Z
Retry-After: 30  (только при 429)
```

---

## 7. MVP — минимальный сценарий

Для первого прогона достаточно **3 эндпоинтов**:

```
1. GET  /chat/stores/{id}/rules   → получить правила
2. POST /chat/opened              → зафиксировать открытие чата
3. POST /chat/{id}/anchor         → зафиксировать системное сообщение
```

`message-sent` и `error` — опциональны для MVP, но рекомендуются.

---

## 8. Reconciliation (бэкенд-сторона)

Бэкенд самостоятельно выполняет reconciliation:

1. **При POST /chat/opened** — fuzzy match по `nmId + rating + date ±2 мин` для поиска `review_id`
2. **При POST /chat/{id}/anchor** — парсинг `chat_id` из URL чата
3. **При dialogue sync** — match extension-записей с чатами из WB API по `chat_url`

Расширению не нужно беспокоиться о reconciliation — достаточно отправлять данные.

---

## 9. curl-примеры для тестирования

### Получить магазины
```bash
curl -s -H "Authorization: Bearer YOUR_TOKEN" \
  "https://rating5.ru/api/extension/chat/stores" | jq .
```

### Получить правила
```bash
curl -s -H "Authorization: Bearer YOUR_TOKEN" \
  "https://rating5.ru/api/extension/chat/stores/STORE_ID/rules" | jq .
```

### Зафиксировать открытие чата
```bash
curl -s -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "STORE_ID",
    "reviewContext": {
      "nmId": "649502497",
      "rating": 2,
      "reviewDate": "2026-01-07T20:09:37.000Z",
      "reviewKey": "649502497_2_2026-01-07T20:09"
    },
    "chatUrl": "https://seller.wildberries.ru/feedback-and-questions/chats/12345",
    "openedAt": "2026-02-16T14:30:00.000Z",
    "status": "CHAT_OPENED"
  }' \
  "https://rating5.ru/api/extension/chat/opened" | jq .
```

### Зафиксировать системное сообщение
```bash
curl -s -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "systemMessageText": "Чат с покупателем по товару Футболка, артикул 649502497",
    "parsedNmId": "649502497",
    "parsedProductTitle": "Футболка",
    "anchorFoundAt": "2026-02-16T14:30:05.000Z",
    "status": "ANCHOR_FOUND"
  }' \
  "https://rating5.ru/api/extension/chat/CHAT_RECORD_ID/anchor" | jq .
```

---

## 10. Open Questions (от бэкенд-команды)

| # | Вопрос | Статус | Решение |
|---|--------|--------|---------|
| 1 | Может ли расширение парсить WB review ID из DOM? | Проверим при DOM-разведке | Если да — используем как reviewKey |
| 2 | Стабилен ли формат URL чатов WB? | Проверим при DOM-разведке | Предварительно: `seller.wildberries.ru/feedback-and-questions/chats/{id}` |
| 3 | Шаблоны сообщений — бэкенд или хардкод? | Sprint 2 | Решим позже, не блокер |
| 4 | Rate limits на POST /chat/opened? | Решено | 100 req/min достаточно (maxChatsPerRun=50, cooldown=3s → ~20 req/min) |
| 5 | Retention записей с ошибками? | На бэкенде | Рекомендация: 30 дней |
