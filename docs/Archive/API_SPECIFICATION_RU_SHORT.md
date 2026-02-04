# API Спецификация - Краткая версия

**Проект:** WB Reports Chrome Extension
**Версия:** 1.3.0
**Дата:** 28 января 2026

---

## Что это за проект?

Chrome Extension для автоматизации подачи жалоб на отзывы в личном кабинете продавца Wildberries.

**Основные функции:**
1. Автоматическая подача жалоб на отзывы
2. Парсинг отзывов с WB
3. Аналитика и отчетность

---

## Необходимые API Endpoints

### 1. GET /api/v1/stores

Получить список магазинов пользователя.

**Request:**
```http
GET /api/v1/stores
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "store_abc123",
    "name": "Магазин Одежды",
    "supplierName": "ООО Поставщик",
    "inn": "1234567890",
    "isActive": true
  }
]
```

---

### 2. GET /api/v1/stores/:storeId/complaints

**ГЛАВНЫЙ ENDPOINT** - Получить жалобы для обработки.

**Request:**
```http
GET /api/v1/stores/store_abc123/complaints?skip=0&take=100
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "review_001",
    "productId": "187489568",
    "rating": 1,
    "reviewDate": "18.01.2026",
    "reviewText": "Ужасное качество",
    "complaintText": "```json\n{\"reasonId\":\"1\",\"reasonName\":\"Оскорбление\",\"complaintText\":\"Текст жалобы\"}\n```",
    "status": "pending"
  }
]
```

**⚠️ КРИТИЧНО: Поле `reviewDate` обязательно!**

**Обязательные поля:**
- `id` - уникальный ID отзыва
- `productId` - артикул WB
- `rating` - оценка 1-5 звезд
- `reviewDate` - дата в формате **"DD.MM.YYYY"** (например, "18.01.2026")
- `complaintText` - JSON с данными жалобы

**Формат complaintText:**
```json
{
  "reasonId": "1",
  "reasonName": "Оскорбление",
  "complaintText": "Текст жалобы для отправки на WB"
}
```

Обернут в markdown:
```
```json
{...}
```
```

**Доступные reasonId:**
- "1" - Оскорбление
- "2" - Спам/реклама
- "3" - Недостоверная информация
- "4" - Неэтичное поведение
- "5" - Другое

---

### 3. POST /api/v1/stores/:storeId/reviews/:reviewId/complaint/sent

Отметить жалобу как успешно отправленную.

**Request:**
```http
POST /api/v1/stores/store_abc123/reviews/review_001/complaint/sent
Authorization: Bearer <token>
Content-Type: application/json

{
  "sentAt": "2026-01-28T16:30:45Z",
  "duration": 2.3
}
```

**Response:**
```json
{
  "success": true,
  "message": "Complaint marked as sent",
  "data": {
    "reviewId": "review_001",
    "status": "sent"
  }
}
```

**Важно:** Endpoint должен быть **идемпотентным** - повторные вызовы не должны вызывать ошибки.

---

### 4. GET /api/v1/health

Health check (авторизация не требуется).

**Request:**
```http
GET /api/v1/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-28T17:00:00Z",
  "version": "1.3.0"
}
```

---

### 5. POST /api/v1/reviews (External API, опционально)

Получение спарсенных отзывов.

**Request:**
```http
POST /api/v1/reviews
Authorization: Bearer <external_token>
Content-Type: application/json

{
  "reviews": [
    {
      "productId": "187489568",
      "productName": "Платье женское",
      "reviewId": "wb_rev_12345",
      "rating": 5,
      "reviewDate": "15.01.2026",
      "authorName": "Екатерина С.",
      "reviewText": "Отличное качество!",
      "photos": ["url1", "url2"],
      "hasVideo": false,
      "parsedAt": "2026-01-28T17:00:00Z"
    }
  ],
  "stats": {
    "totalReviews": 1,
    "pagesParsed": 1,
    "duration": 5.2
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "received": 1,
    "batchId": "batch_20260128"
  }
}
```

---

## Авторизация

**Формат:**
```
Authorization: Bearer <token>
```

**Пример токена:**
```
wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue
```

**Требования:**
- Токен уникален для каждого пользователя
- Минимум 32 символа
- Префикс: `wbrm_`

---

## Обработка ошибок

**Формат:**
```json
{
  "error": "Error Name",
  "message": "Detailed description",
  "code": "ERROR_CODE"
}
```

**Основные коды ошибок:**

| Code | Status | Описание |
|------|--------|----------|
| AUTH_FAILED | 401 | Неверный токен |
| STORE_NOT_FOUND | 404 | Магазин не найден |
| REVIEW_NOT_FOUND | 404 | Отзыв не найден |
| ALREADY_SENT | 409 | Жалоба уже отправлена |
| RATE_LIMIT | 429 | Превышен лимит запросов |

---

## Требования к производительности

- **Response Time:** < 1 секунды (95th percentile)
- **Uptime:** > 99.5%
- **Rate Limit:** 100 запросов/минуту на токен
- **Max пагинация:** 200 записей за запрос

---

## Требования к безопасности

1. ✅ **HTTPS only** - только защищенное соединение
2. ✅ **Bearer Token** - авторизация в каждом запросе
3. ✅ **Rate Limiting** - 100 req/min
4. ✅ **CORS** - настроить для `chrome-extension://*`
5. ✅ **Input Validation** - валидация всех входных данных

---

## Критичные изменения относительно pilot-entry.ru

### ⚠️ Поле reviewDate - ОБЯЗАТЕЛЬНО!

**Формат:** `"DD.MM.YYYY"`

**Примеры:**
- ✅ "18.01.2026"
- ✅ "05.12.2025"
- ❌ "2026-01-18" (неверный формат)
- ❌ "18/01/2026" (неверный разделитель)

**Почему критично:**

Extension v1.3.0 использует новый механизм идентификации отзывов:

```
Ключ = productId + "_" + rating + "_" + reviewDate
Пример: "187489568_1_18.01.2026"
```

Без поля `reviewDate` Extension не сможет найти отзывы на странице WB.

---

## Workflow подачи жалобы

```
1. Extension → GET /stores
   ← [{"id": "store_abc123", "name": "Магазин"}]

2. Extension → GET /stores/store_abc123/complaints?take=10
   ← [{id, productId, rating, reviewDate, complaintText}, ...]

3. Extension находит отзыв на WB по ключу:
   productId_rating_reviewDate

4. Extension заполняет форму и отправляет жалобу на WB

5. Extension → POST /stores/store_abc123/reviews/review_001/complaint/sent
   ← {"success": true}

6. Жалоба больше не возвращается в GET /complaints (status = "sent")
```

---

## Минимальный набор для запуска (MVP)

Для работы Extension нужны только:

1. ✅ `GET /api/v1/stores`
2. ✅ `GET /api/v1/stores/:storeId/complaints`
3. ✅ `POST /api/v1/stores/:storeId/reviews/:reviewId/complaint/sent`
4. ✅ `GET /api/v1/health`

External API (`POST /reviews`) - опционально, можно добавить позже.

---

## Пример кода (JavaScript)

```javascript
// Получение жалоб
async function getComplaints(storeId, skip = 0, take = 100) {
  const response = await fetch(
    `https://your-api.com/api/v1/stores/${storeId}/complaints?skip=${skip}&take=${take}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.json();
}

// Отметка жалобы
async function markAsSent(storeId, reviewId) {
  const response = await fetch(
    `https://your-api.com/api/v1/stores/${storeId}/reviews/${reviewId}/complaint/sent`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sentAt: new Date().toISOString(),
        duration: 2.5
      })
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.json();
}
```

---

## Чеклист готовности API

### Endpoints
- [ ] GET /api/v1/stores
- [ ] GET /api/v1/stores/:storeId/complaints
- [ ] POST /api/v1/stores/:storeId/reviews/:reviewId/complaint/sent
- [ ] GET /api/v1/health

### Данные
- [ ] Поле `reviewDate` присутствует в Complaint
- [ ] Формат `reviewDate` = "DD.MM.YYYY"
- [ ] Поле `complaintText` содержит JSON в markdown блоке

### Безопасность
- [ ] HTTPS only
- [ ] Bearer Token authentication
- [ ] Rate limiting (100 req/min)
- [ ] CORS headers для chrome-extension://*
- [ ] Валидация входных данных

### Производительность
- [ ] Response time < 1s (95th)
- [ ] Uptime > 99.5%
- [ ] Пагинация до 200 записей
- [ ] Кеширование /stores (5 мин)

### Мониторинг
- [ ] Логирование всех запросов
- [ ] Логирование ошибок
- [ ] Метрики (RPS, latency, errors)
- [ ] Alerting при ошибках

---

## Timeline миграции

| Этап | Длительность |
|------|--------------|
| Разработка API | 2-3 недели |
| Тестирование | 1 неделя |
| Миграция данных | 1 день |
| Production deploy | 1 день |
| **Total** | **~4-5 недель** |

---

## FAQ

**Q: Где взять поле reviewDate для старых жалоб?**

A: 3 варианта:
1. Спарсить даты с WB
2. Использовать createdAt как fallback
3. Пометить старые жалобы как "legacy"

**Q: Почему complaintText в markdown блоке?**

A: Историческое решение для совместимости. Первая версия копировала JSON из GPT.

**Q: Можно больше 200 жалоб за раз?**

A: Нет, лимит 200 для предотвращения таймаутов. Используйте пагинацию.

---

## Контакты

**Для вопросов по API:**
- Email: api-support@company.com
- Telegram: @api_support

**Полная документация:**
- См. файл `API_SPECIFICATION.md` (английская версия)

---

**Дата:** 28 января 2026
**Статус:** Готов к разработке ✅
