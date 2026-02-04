# API Specification - WB Reports Extension
## Техническое задание для разработки нового API сервера

**Версия:** 1.3.0
**Дата:** 28 января 2026
**Статус:** Переезд с pilot-entry.ru на новый сервер

---

## 📋 Содержание

1. [Обзор проекта](#1-обзор-проекта)
2. [Текущая инфраструктура](#2-текущая-инфраструктура)
3. [Полная спецификация API](#3-полная-спецификация-api)
4. [Модели данных](#4-модели-данных)
5. [Примеры запросов/ответов](#5-примеры-запросовответов)
6. [Авторизация и безопасность](#6-авторизация-и-безопасность)
7. [Обработка ошибок](#7-обработка-ошибок)
8. [Дополнительные требования](#8-дополнительные-требования)
9. [Миграция данных](#9-миграция-данных)
10. [Контакты и поддержка](#10-контакты-и-поддержка)

---

## 1. Обзор проекта

### 1.1. Что это за проект?

**WB Reports** - это Chrome Extension для автоматизации работы с отзывами и жалобами в личном кабинете продавца Wildberries.

### 1.2. Основные функции

1. **Автоматическая подача жалоб на отзывы**
   - Получение списка жалоб из API
   - Фильтрация по рейтингу (1-5 звезд)
   - Автоматическое заполнение форм на WB
   - Отправка жалоб в интерфейсе WB
   - Обратная связь в API (отметка как отправленной)

2. **Парсинг отзывов с WB**
   - Сбор отзывов со страниц товаров WB
   - Извлечение данных (автор, дата, рейтинг, текст, фото/видео)
   - Отправка собранных данных на внешний API для обработки

3. **Проверка статуса жалоб**
   - Верификация статуса поданных жалоб на WB
   - Сбор скриншотов результатов
   - Формирование отчетов

4. **Аналитика и отчетность**
   - Статистика обработки жалоб
   - Детальные логи операций
   - Экспорт данных в Google Sheets

### 1.3. Как работает Extension?

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                          │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Popup UI    │───▶│  Background  │───▶│   Content    │  │
│  │   (User)     │    │  Service     │    │   Scripts    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │         │
└─────────┼────────────────────┼────────────────────┼─────────┘
          │                    │                    │
          │             ┌──────▼──────┐             │
          │             │   YOUR API  │             │
          │             │   (NEW!)    │             │
          │             └─────────────┘             │
          │                                         │
          └─────────────────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Wildberries.ru      │
                    │  (Target Website)    │
                    └──────────────────────┘
```

**Workflow подачи жалобы:**

1. User открывает Extension popup → выбирает магазин и параметры
2. Extension запрашивает у API список жалоб для обработки
3. API возвращает массив жалоб с данными (артикул, рейтинг, дата, текст жалобы)
4. Content Script находит отзывы на странице WB используя ключ `productId_rating_reviewDate`
5. Content Script автоматически заполняет форму жалобы и отправляет её
6. Extension отправляет обратную связь в API: жалоба успешно отправлена
7. API помечает жалобу как обработанную

**Workflow парсинга отзывов:**

1. User открывает страницу товара на WB → запускает парсинг
2. Content Script собирает отзывы со всех страниц пагинации
3. Извлекаются: ID отзыва, автор, дата, рейтинг, текст, фото/видео, ответ продавца
4. Собранные данные отправляются на External API для дальнейшей обработки
5. External API может быть использован для ML анализа, хранения и т.д.

### 1.4. Технологический стек Extension

- **Chrome Extension Manifest V3**
- **Vanilla JavaScript (ES6+) + Modules**
- **Chrome APIs**: storage, scripting, tabs, runtime, webRequest
- **Fetch API** для HTTP запросов
- **DOM Manipulation** для автоматизации WB интерфейса

---

## 2. Текущая инфраструктура

### 2.1. Pilot Entry API (текущий сервер)

**Base URL:** `https://pilot-entry.ru/api`

**Существующие endpoints:**

1. `GET /stores` - получение списка магазинов
2. `GET /stores/:storeId/complaints` - получение жалоб для магазина
3. `POST /stores/:storeId/reviews/:reviewId/complaint/sent` - отметка жалобы как отправленной

**Авторизация:** Bearer Token в header `Authorization`

**Проблемы текущей инфраструктуры:**

❌ Отсутствует поле `reviewDate` в объекте Complaint (критично для v1.3.0)
❌ Нет endpoint для верификации статусов жалоб
❌ Нет health check endpoint
❌ Нет версионирования API

### 2.2. External API (парсинг отзывов)

**Назначение:** Получение спарсенных отзывов от Extension для дальнейшей обработки

**Endpoints:**

1. `POST /reviews` - получение массива отзывов
2. `GET /health` - проверка доступности API

**Статус:** Опциональный, настраивается в Extension settings

---

## 3. Полная спецификация API

### 3.1. Базовые требования

**Base URL:** `https://your-new-api.com/api/v1`

**Формат данных:** JSON

**Авторизация:** Bearer Token в header

**Обязательные headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Версионирование:** `/api/v1/` в URL

---

### 3.2. Endpoint: GET /stores

**Описание:** Получить список всех магазинов пользователя

**Метод:** `GET`

**URL:** `/api/v1/stores`

**Headers:**
```
Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue
```

**Query Parameters:** Нет

**Response 200 OK:**
```json
[
  {
    "id": "store_abc123",
    "name": "Магазин Одежды",
    "supplierName": "ООО Поставщик",
    "inn": "1234567890",
    "isActive": true,
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2026-01-28T15:45:00Z"
  },
  {
    "id": "store_xyz456",
    "name": "Обувь и Аксессуары",
    "supplierName": "ИП Иванов",
    "inn": "9876543210",
    "isActive": true,
    "createdAt": "2024-12-01T08:00:00Z",
    "updatedAt": "2026-01-20T12:00:00Z"
  }
]
```

**Response 401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing token",
  "code": "AUTH_FAILED"
}
```

**Response 500 Internal Server Error:**
```json
{
  "error": "Internal Server Error",
  "message": "Database connection failed",
  "code": "DB_ERROR"
}
```

---

### 3.3. Endpoint: GET /stores/:storeId/complaints

**Описание:** Получить список жалоб для подачи на WB

**Метод:** `GET`

**URL:** `/api/v1/stores/:storeId/complaints`

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**
- `storeId` (string, required) - ID магазина

**Query Parameters:**
- `skip` (integer, optional, default=0) - Пропустить N записей (пагинация)
- `take` (integer, optional, default=100, max=200) - Взять N записей

**Пример запроса:**
```
GET /api/v1/stores/store_abc123/complaints?skip=0&take=100
```

**Response 200 OK:**
```json
[
  {
    "id": "r3fMHBDHxPesv6nJBZJ7",
    "productId": "187489568",
    "rating": 1,
    "reviewDate": "18.01.2026",
    "reviewText": "Ужасное качество, швы разошлись после первой стирки",
    "authorName": "Анна К.",
    "createdAt": "2026-01-18T14:25:00Z",
    "complaintText": "```json\n{\"reasonId\":\"1\",\"reasonName\":\"Оскорбление\",\"complaintText\":\"Отзыв содержит оскорбительные выражения в адрес продавца\"}\n```",
    "status": "pending",
    "attempts": 0,
    "lastAttemptAt": null
  },
  {
    "id": "oC6xvT0pdmZECSl1VEWg",
    "productId": "187489568",
    "rating": 2,
    "reviewDate": "17.01.2026",
    "reviewText": "Размер не соответствует, товар пришел с дефектом",
    "authorName": "Мария П.",
    "createdAt": "2026-01-17T09:15:00Z",
    "complaintText": "```json\n{\"reasonId\":\"3\",\"reasonName\":\"Недостоверная информация\",\"complaintText\":\"Отзыв содержит ложную информацию о товаре\"}\n```",
    "status": "pending",
    "attempts": 0,
    "lastAttemptAt": null
  }
]
```

**⚠️ КРИТИЧНО: Поле `reviewDate` обязательно!**

**Описание полей:**

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `id` | string | ✅ Да | Уникальный ID отзыва (используется для обратной связи) |
| `productId` | string | ✅ Да | Артикул товара WB (например, "187489568") |
| `rating` | integer | ✅ Да | Рейтинг отзыва (1-5 звезд) |
| `reviewDate` | string | ✅ Да | Дата отзыва в формате "DD.MM.YYYY" (например, "18.01.2026") |
| `reviewText` | string | ⚠️ Рекомендуется | Текст отзыва покупателя |
| `authorName` | string | ⚪ Нет | Имя автора отзыва |
| `createdAt` | string | ⚪ Нет | ISO 8601 дата создания записи в БД |
| `complaintText` | string | ✅ Да | JSON-строка с данными жалобы (см. формат ниже) |
| `status` | string | ⚪ Нет | Статус: "pending", "sent", "failed" |
| `attempts` | integer | ⚪ Нет | Количество попыток отправки |
| `lastAttemptAt` | string/null | ⚪ Нет | ISO 8601 дата последней попытки |

**Формат поля `complaintText`:**

```json
{
  "reasonId": "1",
  "reasonName": "Оскорбление",
  "complaintText": "Текст жалобы для отправки в форму WB"
}
```

Обернут в markdown code block:
```
```json
{"reasonId":"1","reasonName":"Оскорбление","complaintText":"Текст"}
```
```

**Доступные reasonId на WB:**
- `"1"` - Оскорбление
- `"2"` - Спам/реклама
- `"3"` - Недостоверная информация
- `"4"` - Неэтичное поведение
- `"5"` - Другое

**Ограничения:**
- Максимальная длина `complaintText` внутри JSON: 980 символов
- Extension автоматически добавляет префикс "Жалоба от: DD.MM\n\n" (20 символов)
- Итого лимит WB формы: 1000 символов

**Response 400 Bad Request:**
```json
{
  "error": "Bad Request",
  "message": "Invalid skip or take parameter",
  "code": "INVALID_PARAMS"
}
```

**Response 404 Not Found:**
```json
{
  "error": "Not Found",
  "message": "Store not found",
  "code": "STORE_NOT_FOUND"
}
```

---

### 3.4. Endpoint: POST /stores/:storeId/reviews/:reviewId/complaint/sent

**Описание:** Отметить жалобу как успешно отправленную на WB

**Метод:** `POST`

**URL:** `/api/v1/stores/:storeId/reviews/:reviewId/complaint/sent`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Path Parameters:**
- `storeId` (string, required) - ID магазина
- `reviewId` (string, required) - ID отзыва (тот же что в GET complaints)

**Body:** Пустой или опциональные метаданные
```json
{
  "sentAt": "2026-01-28T16:30:45Z",
  "duration": 2.5,
  "reasonId": "1",
  "reasonName": "Оскорбление"
}
```

**Пример запроса:**
```
POST /api/v1/stores/store_abc123/reviews/r3fMHBDHxPesv6nJBZJ7/complaint/sent
```

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Complaint marked as sent",
  "data": {
    "reviewId": "r3fMHBDHxPesv6nJBZJ7",
    "status": "sent",
    "updatedAt": "2026-01-28T16:30:45Z"
  }
}
```

**Response 404 Not Found:**
```json
{
  "error": "Not Found",
  "message": "Review not found",
  "code": "REVIEW_NOT_FOUND"
}
```

**Response 409 Conflict:**
```json
{
  "error": "Conflict",
  "message": "Complaint already marked as sent",
  "code": "ALREADY_SENT"
}
```

**Важно:**
- Этот endpoint должен быть **идемпотентным** (повторные вызовы с тем же reviewId не должны вызывать ошибки)
- После вызова этого endpoint жалоба НЕ должна возвращаться в `GET /complaints` (статус = "sent")

---

### 3.5. Endpoint: POST /reviews (External API)

**Описание:** Получить спарсенные отзывы от Extension

**Метод:** `POST`

**URL:** `/api/v1/reviews`

**Headers:**
```
Authorization: Bearer <external_token>
Content-Type: application/json
```

**Body:**
```json
{
  "reviews": [
    {
      "productId": "187489568",
      "productName": "Платье женское летнее",
      "reviewId": "abc123xyz",
      "rating": 5,
      "reviewDate": "15.01.2026",
      "authorName": "Екатерина С.",
      "reviewText": "Отличное платье, качество супер!",
      "photos": [
        "https://wbx.ru/photo1.jpg",
        "https://wbx.ru/photo2.jpg"
      ],
      "hasVideo": false,
      "sellerResponse": null,
      "likes": 12,
      "dislikes": 0,
      "parsedAt": "2026-01-28T16:45:00Z"
    },
    {
      "productId": "187489568",
      "productName": "Платье женское летнее",
      "reviewId": "def456uvw",
      "rating": 1,
      "reviewDate": "14.01.2026",
      "authorName": "Анна К.",
      "reviewText": "Разочарована покупкой, не рекомендую",
      "photos": [],
      "hasVideo": false,
      "sellerResponse": "Приносим извинения за неудобства. Свяжитесь с нами для возврата.",
      "likes": 5,
      "dislikes": 2,
      "parsedAt": "2026-01-28T16:45:05Z"
    }
  ],
  "stats": {
    "totalReviews": 2,
    "pagesParsed": 1,
    "duration": 15.5,
    "filters": {
      "stars": [1, 2, 3, 4, 5],
      "withPhotos": false,
      "withVideo": false,
      "withoutSellerResponse": false
    }
  },
  "timestamp": "2026-01-28T16:45:10Z"
}
```

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Reviews received successfully",
  "data": {
    "received": 2,
    "processed": 2,
    "batchId": "batch_20260128_164510"
  }
}
```

**Response 400 Bad Request:**
```json
{
  "error": "Bad Request",
  "message": "Invalid reviews data",
  "code": "INVALID_DATA"
}
```

---

### 3.6. Endpoint: GET /health

**Описание:** Health check для проверки доступности API

**Метод:** `GET`

**URL:** `/api/v1/health`

**Headers:** Авторизация НЕ требуется

**Response 200 OK:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-28T16:50:00Z",
  "version": "1.3.0",
  "uptime": 3456789,
  "services": {
    "database": "ok",
    "cache": "ok",
    "storage": "ok"
  }
}
```

**Response 503 Service Unavailable:**
```json
{
  "status": "error",
  "timestamp": "2026-01-28T16:50:00Z",
  "message": "Database connection failed",
  "services": {
    "database": "error",
    "cache": "ok",
    "storage": "ok"
  }
}
```

---

### 3.7. Дополнительные endpoints (рекомендуемые)

#### 3.7.1. GET /stores/:storeId/complaints/stats

**Описание:** Получить статистику жалоб магазина

**Response:**
```json
{
  "storeId": "store_abc123",
  "stats": {
    "total": 150,
    "pending": 45,
    "sent": 95,
    "failed": 10,
    "byRating": {
      "1": 60,
      "2": 40,
      "3": 30,
      "4": 15,
      "5": 5
    }
  }
}
```

#### 3.7.2. POST /stores/:storeId/reviews/:reviewId/complaint/failed

**Описание:** Отметить жалобу как неудачную (для повторной попытки)

**Body:**
```json
{
  "error": "UI element not found",
  "errorCode": "ELEMENT_NOT_FOUND",
  "failedAt": "2026-01-28T17:00:00Z"
}
```

#### 3.7.3. GET /stores/:storeId/reviews/:reviewId

**Описание:** Получить детальную информацию об отзыве

**Response:**
```json
{
  "id": "r3fMHBDHxPesv6nJBZJ7",
  "productId": "187489568",
  "rating": 1,
  "reviewDate": "18.01.2026",
  "reviewText": "Ужасное качество",
  "complaintText": "...",
  "status": "sent",
  "history": [
    {
      "status": "pending",
      "timestamp": "2026-01-18T14:25:00Z"
    },
    {
      "status": "sent",
      "timestamp": "2026-01-28T16:30:45Z",
      "duration": 2.5
    }
  ]
}
```

---

## 4. Модели данных

### 4.1. Store (Магазин)

```typescript
interface Store {
  id: string;                    // Уникальный ID
  name: string;                  // Название магазина
  supplierName: string;          // ИП/ООО
  inn: string;                   // ИНН
  isActive: boolean;             // Активен ли
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
}
```

### 4.2. Complaint (Жалоба)

```typescript
interface Complaint {
  // Обязательные поля для работы Extension v1.3.0
  id: string;                    // Уникальный ID отзыва
  productId: string;             // Артикул WB
  rating: number;                // 1-5 звезд
  reviewDate: string;            // "DD.MM.YYYY" (КРИТИЧНО!)
  complaintText: string;         // JSON с данными жалобы

  // Рекомендуемые поля
  reviewText?: string;           // Текст отзыва
  authorName?: string;           // Автор отзыва
  createdAt?: string;            // ISO 8601

  // Статусные поля
  status?: 'pending' | 'sent' | 'failed';
  attempts?: number;             // Количество попыток
  lastAttemptAt?: string | null; // ISO 8601 или null
}
```

### 4.3. ComplaintTextData (Данные жалобы)

```typescript
interface ComplaintTextData {
  reasonId: string;              // "1"-"5"
  reasonName: string;            // Название причины
  complaintText: string;         // Текст жалобы (макс 980 символов)
}
```

Сериализация:
```javascript
const complaintText = "```json\n" + JSON.stringify({
  reasonId: "1",
  reasonName: "Оскорбление",
  complaintText: "Текст жалобы"
}) + "\n```";
```

### 4.4. Review (Спарсенный отзыв)

```typescript
interface Review {
  productId: string;             // Артикул WB
  productName: string;           // Название товара
  reviewId: string;              // ID отзыва на WB
  rating: number;                // 1-5
  reviewDate: string;            // "DD.MM.YYYY"
  authorName: string;            // Автор
  reviewText: string;            // Текст отзыва
  photos: string[];              // URL фотографий
  hasVideo: boolean;             // Есть ли видео
  sellerResponse: string | null; // Ответ продавца
  likes: number;                 // Лайки
  dislikes: number;              // Дизлайки
  parsedAt: string;              // ISO 8601
}
```

### 4.5. ParsingStats (Статистика парсинга)

```typescript
interface ParsingStats {
  totalReviews: number;
  pagesParsed: number;
  duration: number;              // Секунды
  filters: {
    stars: number[];
    withPhotos: boolean;
    withVideo: boolean;
    withoutSellerResponse: boolean;
  };
}
```

---

## 5. Примеры запросов/ответов

### 5.1. Сценарий: Получение и обработка жалоб

**Шаг 1: Получить список магазинов**

```http
GET /api/v1/stores HTTP/1.1
Host: your-new-api.com
Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue
```

**Ответ:**
```json
[
  {
    "id": "store_abc123",
    "name": "Магазин Одежды",
    "supplierName": "ООО Поставщик",
    "inn": "1234567890",
    "isActive": true,
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2026-01-28T15:45:00Z"
  }
]
```

**Шаг 2: Получить жалобы для магазина**

```http
GET /api/v1/stores/store_abc123/complaints?skip=0&take=10 HTTP/1.1
Host: your-new-api.com
Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue
```

**Ответ:**
```json
[
  {
    "id": "review_001",
    "productId": "187489568",
    "rating": 1,
    "reviewDate": "18.01.2026",
    "reviewText": "Ужасное качество товара",
    "authorName": "Анна К.",
    "complaintText": "```json\n{\"reasonId\":\"1\",\"reasonName\":\"Оскорбление\",\"complaintText\":\"Отзыв содержит оскорбительные выражения\"}\n```",
    "status": "pending",
    "attempts": 0
  },
  {
    "id": "review_002",
    "productId": "298765432",
    "rating": 2,
    "reviewDate": "17.01.2026",
    "reviewText": "Не соответствует описанию",
    "authorName": "Мария П.",
    "complaintText": "```json\n{\"reasonId\":\"3\",\"reasonName\":\"Недостоверная информация\",\"complaintText\":\"Информация в отзыве не соответствует действительности\"}\n```",
    "status": "pending",
    "attempts": 0
  }
]
```

**Шаг 3: Extension обрабатывает жалобы на WB**

*(Extension автоматически заполняет формы и отправляет жалобы)*

**Шаг 4: Отметить жалобы как отправленные**

```http
POST /api/v1/stores/store_abc123/reviews/review_001/complaint/sent HTTP/1.1
Host: your-new-api.com
Authorization: Bearer wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue
Content-Type: application/json

{
  "sentAt": "2026-01-28T16:30:45Z",
  "duration": 2.3,
  "reasonId": "1",
  "reasonName": "Оскорбление"
}
```

**Ответ:**
```json
{
  "success": true,
  "message": "Complaint marked as sent",
  "data": {
    "reviewId": "review_001",
    "status": "sent",
    "updatedAt": "2026-01-28T16:30:45Z"
  }
}
```

---

### 5.2. Сценарий: Парсинг отзывов

**Шаг 1: Отправить спарсенные отзывы**

```http
POST /api/v1/reviews HTTP/1.1
Host: your-external-api.com
Authorization: Bearer external_token_12345
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
      "photos": ["https://wbx.ru/photo1.jpg"],
      "hasVideo": false,
      "sellerResponse": null,
      "likes": 10,
      "dislikes": 0,
      "parsedAt": "2026-01-28T17:00:00Z"
    }
  ],
  "stats": {
    "totalReviews": 1,
    "pagesParsed": 1,
    "duration": 5.2,
    "filters": {
      "stars": [1, 2, 3, 4, 5],
      "withPhotos": false,
      "withVideo": false,
      "withoutSellerResponse": false
    }
  },
  "timestamp": "2026-01-28T17:00:05Z"
}
```

**Ответ:**
```json
{
  "success": true,
  "message": "Reviews received successfully",
  "data": {
    "received": 1,
    "processed": 1,
    "batchId": "batch_20260128_170005"
  }
}
```

---

## 6. Авторизация и безопасность

### 6.1. Bearer Token Authentication

**Формат:**
```
Authorization: Bearer <token>
```

**Пример токена:**
```
wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue
```

**Требования:**
- Токен должен быть уникальным для каждого пользователя
- Длина: минимум 32 символа
- Формат: `wbrm_` + base64/random string
- Токен передается в каждом запросе (кроме `/health`)

### 6.2. Безопасность данных

**Обязательные меры:**

1. **HTTPS только**
   - Все запросы должны идти через HTTPS
   - HTTP редирект на HTTPS

2. **Rate Limiting**
   - Максимум 100 запросов в минуту на токен
   - Максимум 1000 запросов в час на токен
   - Response header: `X-RateLimit-Remaining`, `X-RateLimit-Reset`

3. **CORS Headers**
   ```
   Access-Control-Allow-Origin: chrome-extension://*
   Access-Control-Allow-Methods: GET, POST, OPTIONS
   Access-Control-Allow-Headers: Authorization, Content-Type
   ```

4. **Input Validation**
   - Валидация всех входных данных
   - Санитизация строк
   - Проверка длины полей

5. **Token Storage**
   - Токены хранятся в зашифрованном виде в БД
   - Хеширование токенов (bcrypt/argon2)
   - Возможность ревокации токенов

### 6.3. Error Responses

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing token",
  "code": "AUTH_FAILED"
}
```

**403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "Access denied to this resource",
  "code": "ACCESS_DENIED"
}
```

**429 Too Many Requests:**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Retry after 60 seconds",
  "code": "RATE_LIMIT",
  "retryAfter": 60
}
```

---

## 7. Обработка ошибок

### 7.1. HTTP Status Codes

| Code | Название | Когда использовать |
|------|----------|-------------------|
| 200 | OK | Успешный запрос |
| 201 | Created | Ресурс создан (если применимо) |
| 400 | Bad Request | Невалидные параметры |
| 401 | Unauthorized | Неверный/отсутствующий токен |
| 403 | Forbidden | Нет доступа к ресурсу |
| 404 | Not Found | Ресурс не найден |
| 409 | Conflict | Конфликт (например, жалоба уже отправлена) |
| 429 | Too Many Requests | Rate limit превышен |
| 500 | Internal Server Error | Ошибка сервера |
| 503 | Service Unavailable | Сервис недоступен |

### 7.2. Формат ошибок

**Обязательная структура:**
```json
{
  "error": "Human Readable Error",
  "message": "Detailed error description",
  "code": "ERROR_CODE",
  "details": {
    "field": "value"
  }
}
```

**Примеры:**

```json
{
  "error": "Bad Request",
  "message": "Missing required field: reviewDate",
  "code": "MISSING_FIELD",
  "details": {
    "field": "reviewDate",
    "expected": "string in format DD.MM.YYYY"
  }
}
```

```json
{
  "error": "Internal Server Error",
  "message": "Database query failed",
  "code": "DB_ERROR",
  "details": {
    "query": "SELECT * FROM complaints",
    "error": "Connection timeout"
  }
}
```

### 7.3. Error Codes

| Code | Описание |
|------|----------|
| `AUTH_FAILED` | Авторизация провалена |
| `ACCESS_DENIED` | Доступ запрещен |
| `INVALID_PARAMS` | Невалидные параметры |
| `MISSING_FIELD` | Отсутствует обязательное поле |
| `STORE_NOT_FOUND` | Магазин не найден |
| `REVIEW_NOT_FOUND` | Отзыв не найден |
| `ALREADY_SENT` | Жалоба уже отправлена |
| `RATE_LIMIT` | Превышен лимит запросов |
| `DB_ERROR` | Ошибка базы данных |
| `INVALID_DATA` | Невалидные данные |

---

## 8. Дополнительные требования

### 8.1. Производительность

**SLA (Service Level Agreement):**

- **Uptime:** 99.5% (допустимый downtime: ~3.6 часа в месяц)
- **Response Time:**
  - `/stores` - до 500ms (95th percentile)
  - `/complaints` - до 1000ms (95th percentile)
  - `/complaint/sent` - до 300ms (95th percentile)
  - `/reviews` - до 2000ms (95th percentile)
  - `/health` - до 100ms

**Пагинация:**
- Максимум 200 жалоб за один запрос (`take=200`)
- По умолчанию 100 жалоб

**Кеширование:**
- Список магазинов кешировать на 5 минут
- Health check кешировать на 30 секунд

### 8.2. Логирование

**Обязательные логи:**

1. Все входящие запросы:
   - Метод, URL, Headers (без токена)
   - Timestamp
   - User Agent
   - IP адрес

2. Ошибки:
   - Stack trace
   - Request payload
   - Timestamp

3. Бизнес-логика:
   - Создание жалобы
   - Отметка как отправленной
   - Получение жалоб

**Формат логов:** JSON

```json
{
  "timestamp": "2026-01-28T17:30:00Z",
  "level": "info",
  "method": "GET",
  "url": "/api/v1/stores/store_abc123/complaints",
  "statusCode": 200,
  "duration": 245,
  "userId": "user_12345",
  "ip": "192.168.1.1"
}
```

### 8.3. Мониторинг

**Метрики для отслеживания:**

1. **Основные:**
   - Requests per second (RPS)
   - Average response time
   - Error rate (%)
   - P95, P99 latency

2. **Бизнес-метрики:**
   - Количество созданных жалоб за день
   - Количество отправленных жалоб за день
   - Success rate (%)

3. **Инфраструктурные:**
   - CPU usage
   - Memory usage
   - Database connections
   - Disk I/O

**Alerting:**
- Error rate > 5% - warning
- Error rate > 10% - critical
- Response time P95 > 2s - warning
- Database downtime - critical

### 8.4. Backup и Recovery

**Требования:**

1. **Backup базы данных:**
   - Ежедневный полный backup (midnight UTC)
   - Incremental backup каждые 6 часов
   - Хранение backups: 30 дней

2. **Disaster Recovery:**
   - RPO (Recovery Point Objective): 6 часов
   - RTO (Recovery Time Objective): 2 часа

### 8.5. Совместимость

**Extension поддерживает:**
- Chrome 100+
- Edge 100+
- Brave (последняя версия)

**API должен работать с:**
- Fetch API (JavaScript)
- Content-Type: application/json
- UTF-8 encoding

### 8.6. Версионирование API

**Формат:** `/api/v{major}/...`

**Текущая версия:** `v1`

**Правила:**
- Breaking changes → новая major версия (v2, v3...)
- Backward compatible changes → в рамках текущей версии
- Поддержка старых версий: минимум 6 месяцев после релиза новой

---

## 9. Миграция данных

### 9.1. Переезд с pilot-entry.ru

**Шаги миграции:**

1. **Экспорт данных с pilot-entry.ru**
   - Все магазины (stores)
   - Все жалобы (complaints) со статусами
   - История операций

2. **Трансформация данных**
   - Добавить поле `reviewDate` к существующим жалобам
   - Преобразовать форматы дат в ISO 8601
   - Валидировать все данные

3. **Импорт в новый сервер**
   - Создать магазины
   - Импортировать жалобы с сохранением статусов
   - Проверить целостность данных

4. **Тестирование**
   - Функциональное тестирование всех endpoints
   - Load testing
   - Integration testing с Extension

5. **Switch-over**
   - Обновить настройки Extension (новый endpoint)
   - Мониторинг первых 24 часов
   - Rollback план (если что-то пошло не так)

### 9.2. Требование к полю reviewDate

**КРИТИЧНО:** Все существующие жалобы должны иметь поле `reviewDate`.

**Если данные недоступны:**
- Опция 1: Спарсить даты отзывов с WB
- Опция 2: Использовать `createdAt` как fallback
- Опция 3: Отметить старые жалобы как "legacy" и не обрабатывать

**Формат даты:**
```
"DD.MM.YYYY"  ← Обязательный формат
```

**Примеры:**
- ✅ "18.01.2026"
- ✅ "05.12.2025"
- ❌ "2026-01-18" (неверный формат)
- ❌ "18/01/2026" (неверный разделитель)

---

## 10. Контакты и поддержка

### 10.1. Техническая поддержка

**Для вопросов по API:**
- Email: api-support@your-company.com
- Telegram: @your_api_support
- Issues: GitHub repository

**Для срочных проблем:**
- Slack: #api-alerts
- Phone: +7 (XXX) XXX-XX-XX (24/7)

### 10.2. Документация

**Ссылки:**
- API Documentation: https://docs.your-api.com
- Postman Collection: https://postman.com/your-api
- OpenAPI Spec: https://api.your-api.com/openapi.json
- Status Page: https://status.your-api.com

### 10.3. Changelog

**Формат:** https://docs.your-api.com/changelog

**Обязательно указывать:**
- Дата изменения
- Версия API
- Тип изменения (breaking/feature/bugfix)
- Описание изменения

---

## 11. Приложения

### 11.1. Postman Collection

**Скачать:** (будет предоставлена отдельно)

**Содержит:**
- Все endpoints с примерами
- Environment переменные
- Pre-request scripts для авторизации
- Tests для валидации ответов

### 11.2. OpenAPI Specification

**Файл:** `openapi.yaml` (будет предоставлен отдельно)

**Версия:** OpenAPI 3.0

**Использование:**
- Генерация клиентских библиотек
- Автоматическая документация
- Валидация запросов/ответов

### 11.3. Примеры кода Extension

**Пример запроса жалоб:**

```javascript
// pilot-api.js
async getComplaints(storeId, { skip = 0, take = 100 } = {}) {
  const endpoint = await settingsService.getPilotEndpoint();
  const token = await settingsService.getPilotToken();
  const url = `${endpoint}/stores/${storeId}/complaints?skip=${skip}&take=${take}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  return data;
}
```

**Пример отметки жалобы:**

```javascript
async markComplaintAsSent(storeId, reviewId) {
  const endpoint = await settingsService.getPilotEndpoint();
  const token = await settingsService.getPilotToken();
  const url = `${endpoint}/stores/${storeId}/reviews/${reviewId}/complaint/sent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.json();
}
```

---

## 12. Чеклист готовности API

### 12.1. Обязательные endpoints

- [ ] `GET /api/v1/stores`
- [ ] `GET /api/v1/stores/:storeId/complaints`
- [ ] `POST /api/v1/stores/:storeId/reviews/:reviewId/complaint/sent`
- [ ] `POST /api/v1/reviews` (External API)
- [ ] `GET /api/v1/health`

### 12.2. Обязательные поля данных

- [ ] `Complaint.id` (string)
- [ ] `Complaint.productId` (string)
- [ ] `Complaint.rating` (number 1-5)
- [ ] `Complaint.reviewDate` (string "DD.MM.YYYY") **← КРИТИЧНО!**
- [ ] `Complaint.complaintText` (string с JSON)

### 12.3. Безопасность

- [ ] HTTPS only
- [ ] Bearer Token authentication
- [ ] Rate limiting (100 req/min)
- [ ] CORS headers настроены
- [ ] Input validation
- [ ] Error handling

### 12.4. Производительность

- [ ] Response time < 1s (95th percentile)
- [ ] Uptime > 99.5%
- [ ] Pagination (max 200 items)
- [ ] Caching

### 12.5. Мониторинг и логи

- [ ] Request logging
- [ ] Error logging
- [ ] Metrics (RPS, latency, errors)
- [ ] Alerting

### 12.6. Документация

- [ ] API documentation
- [ ] Postman collection
- [ ] OpenAPI spec
- [ ] Changelog

### 12.7. Тестирование

- [ ] Unit tests
- [ ] Integration tests
- [ ] Load tests
- [ ] Extension integration tests

---

## 13. FAQ для разработчиков API

**Q: Почему reviewDate - строка, а не ISO 8601 timestamp?**

A: WB отображает дату в формате "18.01.2026" в интерфейсе. Extension извлекает дату именно в этом формате из DOM. Для идентификации отзыва нужен точно такой же формат.

---

**Q: Зачем complaintText обернут в markdown code block?**

A: Исторические причины. Первая версия использовала копирование из GPT, который возвращал JSON в markdown блоках. Формат сохранили для обратной совместимости.

---

**Q: Можно ли вернуть больше 200 жалоб за один запрос?**

A: Нет. Лимит 200 установлен для предотвращения таймаутов и перегрузки. Используйте пагинацию (`skip`/`take`).

---

**Q: Что делать если токен скомпрометирован?**

A: Реализуйте endpoint для ревокации токенов. Extension должен получить ошибку 401 и попросить пользователя обновить токен в настройках.

---

**Q: Нужна ли поддержка WebSocket?**

A: Нет, Extension работает через REST API с polling. WebSocket не требуется.

---

**Q: Какая база данных рекомендуется?**

A: PostgreSQL или MySQL для relational data. MongoDB если предпочитаете NoSQL. Redis для кеширования.

---

**Q: Нужна ли поддержка GraphQL?**

A: Нет, Extension работает только с REST API.

---

## 14. Контрольные примеры (Test Cases)

### Test Case 1: Получение жалоб с reviewDate

**Request:**
```http
GET /api/v1/stores/store_test/complaints?skip=0&take=2
Authorization: Bearer test_token_123
```

**Expected Response:**
```json
[
  {
    "id": "test_review_001",
    "productId": "123456789",
    "rating": 1,
    "reviewDate": "28.01.2026",
    "complaintText": "```json\n{\"reasonId\":\"1\",\"reasonName\":\"Оскорбление\",\"complaintText\":\"Тест\"}\n```"
  }
]
```

**Validation:**
- ✅ Status 200
- ✅ Array не пустой
- ✅ Поле `reviewDate` присутствует
- ✅ Формат `reviewDate` = "DD.MM.YYYY"
- ✅ `rating` в диапазоне 1-5

---

### Test Case 2: Отметка жалобы как отправленной

**Request:**
```http
POST /api/v1/stores/store_test/reviews/test_review_001/complaint/sent
Authorization: Bearer test_token_123
Content-Type: application/json

{}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Complaint marked as sent",
  "data": {
    "reviewId": "test_review_001",
    "status": "sent",
    "updatedAt": "2026-01-28T17:00:00Z"
  }
}
```

**Validation:**
- ✅ Status 200
- ✅ `success` = true
- ✅ `reviewId` совпадает

---

### Test Case 3: Повторная отметка (идемпотентность)

**Request:** (тот же что в Test Case 2, повторный вызов)

**Expected Response:**
```json
{
  "success": true,
  "message": "Complaint marked as sent",
  "data": {
    "reviewId": "test_review_001",
    "status": "sent",
    "updatedAt": "2026-01-28T17:00:00Z"
  }
}
```

**Validation:**
- ✅ Status 200 (НЕ 409!)
- ✅ Идемпотентность работает

---

### Test Case 4: Health check

**Request:**
```http
GET /api/v1/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-28T17:05:00Z",
  "version": "1.3.0"
}
```

**Validation:**
- ✅ Status 200
- ✅ `status` = "ok"
- ✅ Авторизация НЕ требуется

---

### Test Case 5: Невалидный токен

**Request:**
```http
GET /api/v1/stores
Authorization: Bearer invalid_token_xyz
```

**Expected Response:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing token",
  "code": "AUTH_FAILED"
}
```

**Validation:**
- ✅ Status 401
- ✅ Error code присутствует

---

## 15. Итоговая информация

### 15.1. Критичные изменения относительно pilot-entry.ru

1. **Добавлено поле `reviewDate`** - обязательное поле в формате "DD.MM.YYYY"
2. **Версионирование API** - `/api/v1/` вместо `/api/`
3. **Health check endpoint** - `/api/v1/health`
4. **Улучшенная обработка ошибок** - стандартизированный формат с кодами

### 15.2. Recommended Timeline

| Этап | Длительность | Описание |
|------|--------------|----------|
| Design & Planning | 1 неделя | Архитектура API, выбор стека |
| Development | 2-3 недели | Разработка endpoints, БД, логика |
| Testing | 1 неделя | Unit, integration, load tests |
| Staging Deployment | 3 дня | Deploy на staging, тесты с Extension |
| Migration | 1 день | Миграция данных с pilot-entry.ru |
| Production Deploy | 1 день | Deploy на production |
| Monitoring | 1 неделя | Мониторинг после запуска |

**Total:** ~6-8 недель

### 15.3. Минимально необходимые endpoints для запуска

Для минимально рабочего продукта (MVP):

1. ✅ `GET /stores`
2. ✅ `GET /stores/:storeId/complaints`
3. ✅ `POST /stores/:storeId/reviews/:reviewId/complaint/sent`
4. ✅ `GET /health`

External API (`POST /reviews`) - опциональный, можно добавить позже.

---

## 16. Контакты для уточнений

**Технический контакт (Extension Team):**
- Email: extension-team@company.com
- Telegram: @extension_dev

**Вопросы по ТЗ:**
- Создайте issue в репозитории проекта
- Или свяжитесь с продакт-менеджером

---

**Дата создания ТЗ:** 28 января 2026
**Версия Extension:** 1.3.0
**Версия API:** v1
**Статус:** Готов к разработке ✅

---

**Подготовлено командой WB Reports Extension**
