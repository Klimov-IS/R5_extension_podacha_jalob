# API Specification: Review Statuses Sync

> **Для разработчиков расширения - PRODUCTION READY**

**Статус:** РЕАЛИЗОВАНО
**Дата:** 01.02.2026

---

## Production Endpoints

| Endpoint | URL |
|----------|-----|
| **POST** | `https://wb-reputation-2.ru/api/extension/review-statuses` |
| **GET** | `https://wb-reputation-2.ru/api/extension/review-statuses?storeId=...` |

---

## POST /api/extension/review-statuses

### Назначение
Принимает статусы отзывов, спарсенные расширением с сайта Wildberries.
Эти данные используются для фильтрации отзывов перед генерацией жалоб.

### Headers

```
Content-Type: application/json
Authorization: Bearer <api_token>
```

**ВАЖНО:** Используйте тот же API токен, что и для других Extension API endpoints (формат `wbrm_...`).

### Request Body

```json
{
  "storeId": "7kKX9WgLvOPiXYIHk6hi",
  "parsedAt": "2026-02-01T12:00:00.000Z",
  "reviews": [
    {
      "reviewKey": "649502497_1_2026-01-07T20:09",
      "productId": "649502497",
      "rating": 1,
      "reviewDate": "2026-01-07T20:09:37.000Z",
      "statuses": ["Жалоба отклонена", "Выкуп"],
      "canSubmitComplaint": false
    },
    {
      "reviewKey": "528735233_2_2026-01-15T14:30",
      "productId": "528735233",
      "rating": 2,
      "reviewDate": "2026-01-15T14:30:00.000Z",
      "statuses": ["Выкуп"],
      "canSubmitComplaint": true
    }
  ]
}
```

### Описание полей

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `storeId` | string | Да | **Наш внутренний ID магазина** (не WB supplier ID!) |
| `parsedAt` | string (ISO 8601) | Да | Время парсинга (UTC) |
| `reviews` | array | Да | Массив отзывов со статусами (max 100) |

#### Поля объекта review

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `reviewKey` | string | Да | Уникальный ключ: `{productId}_{rating}_{datetime без секунд}` |
| `productId` | string | Да | Артикул WB (nmId) |
| `rating` | number (1-5) | Да | Рейтинг отзыва |
| `reviewDate` | string (ISO 8601) | Да | Дата и время отзыва |
| `statuses` | array of strings | Да | Массив статусов (может быть пустым `[]`) |
| `canSubmitComplaint` | boolean | Да | `true` если можно подать жалобу |

### Response Success (200 OK)

```json
{
  "success": true,
  "data": {
    "received": 20,
    "created": 15,
    "updated": 5,
    "errors": 0
  },
  "message": "Статусы успешно синхронизированы"
}
```

### Response Errors

**401 Unauthorized:**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid Authorization header"
  }
}
```

**400 Validation Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "storeId is required"
  }
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this store"
  }
}
```

**400 Limit Exceeded:**
```json
{
  "success": false,
  "error": {
    "code": "LIMIT_EXCEEDED",
    "message": "Maximum 100 reviews per request"
  }
}
```

---

## GET /api/extension/review-statuses

### Назначение
Получить сохраненные статусы для проверки синхронизации (для тестирования).

### Query Parameters

| Параметр | Тип | Обязательно | Описание |
|----------|-----|-------------|----------|
| `storeId` | string | Да | Наш внутренний ID магазина |
| `limit` | number | Нет | Количество записей (default: 50, max: 100) |
| `canSubmit` | string | Нет | Фильтр: `true`, `false`, или `all` (default) |

### Request

```
GET /api/extension/review-statuses?storeId=7kKX9WgLvOPiXYIHk6hi&limit=10
Authorization: Bearer wbrm_your_token
```

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "total": 1500,
    "reviews": [
      {
        "reviewKey": "649502497_1_2026-01-07T20:09",
        "productId": "649502497",
        "rating": 1,
        "reviewDate": "2026-01-07T20:09:37.000Z",
        "statuses": ["Жалоба отклонена", "Выкуп"],
        "canSubmitComplaint": false,
        "parsedAt": "2026-02-01T12:00:00.000Z",
        "createdAt": "2026-02-01T12:00:01.000Z",
        "updatedAt": "2026-02-01T12:00:01.000Z"
      }
    ],
    "stats": {
      "canSubmit": 300,
      "cannotSubmit": 1200
    }
  }
}
```

---

## Формат reviewKey

**Формат:** `{productId}_{rating}_{datetime}`

**Где datetime:** ISO 8601 дата БЕЗ СЕКУНД (для стабильности)

**Примеры:**
```
649502497_1_2026-01-07T20:09
528735233_2_2026-01-15T14:30
187489568_5_2026-01-20T09:15
```

**JavaScript код для генерации:**
```javascript
function generateReviewKey(productId, rating, reviewDate) {
  const date = new Date(reviewDate);
  const datetime = date.toISOString().slice(0, 16); // "2026-01-07T20:09"
  return `${productId}_${rating}_${datetime}`;
}
```

---

## Логика canSubmitComplaint

```javascript
const COMPLAINT_STATUSES = [
  'Жалоба отклонена',
  'Жалоба одобрена',
  'Проверяем жалобу',
  'Жалоба пересмотрена'
];

function canSubmitComplaint(statuses) {
  // Можно подать если НЕТ ни одного статуса жалобы
  return !statuses.some(s => COMPLAINT_STATUSES.includes(s));
}
```

---

## Все возможные статусы

### Статусы жалоб (блокируют подачу)

| Статус | canSubmitComplaint |
|--------|-------------------|
| `Жалоба отклонена` | false |
| `Жалоба одобрена` | false |
| `Проверяем жалобу` | false |
| `Жалоба пересмотрена` | false |

### Информационные статусы (НЕ блокируют)

| Статус | canSubmitComplaint |
|--------|-------------------|
| `Выкуп` | true |
| `Отказ` | true |
| `Возврат` | true |
| `Запрошен возврат` | true |
| `Снят с публикации` | true |
| `Исключён из рейтинга` | true |

---

## cURL примеры

### POST - отправить статусы

```bash
curl -X POST "https://wb-reputation-2.ru/api/extension/review-statuses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wbrm_your_token" \
  -d '{
    "storeId": "7kKX9WgLvOPiXYIHk6hi",
    "parsedAt": "2026-02-01T12:00:00.000Z",
    "reviews": [
      {
        "reviewKey": "649502497_1_2026-01-07T20:09",
        "productId": "649502497",
        "rating": 1,
        "reviewDate": "2026-01-07T20:09:37.000Z",
        "statuses": ["Жалоба отклонена", "Выкуп"],
        "canSubmitComplaint": false
      }
    ]
  }'
```

### GET - проверить статусы

```bash
curl -X GET "https://wb-reputation-2.ru/api/extension/review-statuses?storeId=7kKX9WgLvOPiXYIHk6hi&limit=10" \
  -H "Authorization: Bearer wbrm_your_token"
```

---

## Лимиты

| Параметр | Значение |
|----------|----------|
| Max reviews per request | 100 |
| Max request size | 1 MB |

---

## Интеграция в расширение

### Когда отправлять

Рекомендуется отправлять статусы:
1. После парсинга страницы отзывов
2. Пакетами по 100 отзывов (при большом количестве)
3. Перед/после подачи жалоб

### Пример интеграции

```javascript
async function syncReviewStatuses(storeId, reviews) {
  const API_URL = 'https://wb-reputation-2.ru/api/extension/review-statuses';
  const API_TOKEN = 'wbrm_your_token';

  // Разбиваем на пакеты по 100
  const chunks = chunkArray(reviews, 100);

  for (const chunk of chunks) {
    const payload = {
      storeId: storeId,
      parsedAt: new Date().toISOString(),
      reviews: chunk.map(r => ({
        reviewKey: generateReviewKey(r.productId, r.rating, r.reviewDate),
        productId: r.productId,
        rating: r.rating,
        reviewDate: r.reviewDate,
        statuses: r.statuses || [],
        canSubmitComplaint: canSubmitComplaint(r.statuses || [])
      }))
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log(`Synced: ${result.data.created} created, ${result.data.updated} updated`);
  }
}
```

---

## Тестовые данные

Для тестирования используйте:

| Параметр | Значение |
|----------|----------|
| Store ID | `7kKX9WgLvOPiXYIHk6hi` (ИП Артюшина) |
| API Token | Запросите у команды Backend |

---

## Вопросы?

Если возникли вопросы по интеграции, обращайтесь к команде Backend.
