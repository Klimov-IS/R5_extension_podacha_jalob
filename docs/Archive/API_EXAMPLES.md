# API Примеры запросов

**Базовый URL:** `https://your-new-api.com/api/v1`

**Токен для тестов:** `wbrm_test_token_12345`

---

## 1. Получение списка магазинов

### cURL
```bash
curl -X GET "https://your-new-api.com/api/v1/stores" \
  -H "Authorization: Bearer wbrm_test_token_12345"
```

### JavaScript (Fetch)
```javascript
const response = await fetch('https://your-new-api.com/api/v1/stores', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer wbrm_test_token_12345'
  }
});

const stores = await response.json();
console.log(stores);
```

### Ожидаемый ответ
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

---

## 2. Получение жалоб (первая страница)

### cURL
```bash
curl -X GET "https://your-new-api.com/api/v1/stores/store_abc123/complaints?skip=0&take=10" \
  -H "Authorization: Bearer wbrm_test_token_12345"
```

### JavaScript (Fetch)
```javascript
const storeId = 'store_abc123';
const skip = 0;
const take = 10;

const response = await fetch(
  `https://your-new-api.com/api/v1/stores/${storeId}/complaints?skip=${skip}&take=${take}`,
  {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer wbrm_test_token_12345'
    }
  }
);

const complaints = await response.json();
console.log(`Получено ${complaints.length} жалоб`);
```

### Ожидаемый ответ
```json
[
  {
    "id": "review_001",
    "productId": "187489568",
    "rating": 1,
    "reviewDate": "18.01.2026",
    "reviewText": "Ужасное качество товара",
    "authorName": "Анна К.",
    "createdAt": "2026-01-18T14:25:00Z",
    "complaintText": "```json\n{\"reasonId\":\"1\",\"reasonName\":\"Оскорбление\",\"complaintText\":\"Отзыв содержит оскорбительные выражения\"}\n```",
    "status": "pending",
    "attempts": 0,
    "lastAttemptAt": null
  },
  {
    "id": "review_002",
    "productId": "298765432",
    "rating": 2,
    "reviewDate": "17.01.2026",
    "reviewText": "Не соответствует описанию",
    "authorName": "Мария П.",
    "createdAt": "2026-01-17T09:15:00Z",
    "complaintText": "```json\n{\"reasonId\":\"3\",\"reasonName\":\"Недостоверная информация\",\"complaintText\":\"Информация в отзыве не соответствует действительности\"}\n```",
    "status": "pending",
    "attempts": 0,
    "lastAttemptAt": null
  }
]
```

---

## 3. Получение жалоб (пагинация)

### cURL - вторая страница (10-20)
```bash
curl -X GET "https://your-new-api.com/api/v1/stores/store_abc123/complaints?skip=10&take=10" \
  -H "Authorization: Bearer wbrm_test_token_12345"
```

### JavaScript - получение всех жалоб (с пагинацией)
```javascript
async function getAllComplaints(storeId) {
  const allComplaints = [];
  let skip = 0;
  const take = 100; // Максимум за раз

  while (true) {
    const response = await fetch(
      `https://your-new-api.com/api/v1/stores/${storeId}/complaints?skip=${skip}&take=${take}`,
      {
        headers: {
          'Authorization': 'Bearer wbrm_test_token_12345'
        }
      }
    );

    const batch = await response.json();

    if (batch.length === 0) {
      break; // Больше жалоб нет
    }

    allComplaints.push(...batch);
    skip += take;

    console.log(`Загружено ${allComplaints.length} жалоб...`);
  }

  return allComplaints;
}

// Использование
const complaints = await getAllComplaints('store_abc123');
console.log(`Всего жалоб: ${complaints.length}`);
```

---

## 4. Отметка жалобы как отправленной

### cURL
```bash
curl -X POST "https://your-new-api.com/api/v1/stores/store_abc123/reviews/review_001/complaint/sent" \
  -H "Authorization: Bearer wbrm_test_token_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "sentAt": "2026-01-28T16:30:45Z",
    "duration": 2.3,
    "reasonId": "1",
    "reasonName": "Оскорбление"
  }'
```

### JavaScript (Fetch)
```javascript
const storeId = 'store_abc123';
const reviewId = 'review_001';

const response = await fetch(
  `https://your-new-api.com/api/v1/stores/${storeId}/reviews/${reviewId}/complaint/sent`,
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer wbrm_test_token_12345',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sentAt: new Date().toISOString(),
      duration: 2.3,
      reasonId: '1',
      reasonName: 'Оскорбление'
    })
  }
);

const result = await response.json();
console.log('Жалоба отмечена:', result);
```

### Ожидаемый ответ
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

## 5. Health Check

### cURL
```bash
curl -X GET "https://your-new-api.com/api/v1/health"
```

### JavaScript (Fetch)
```javascript
const response = await fetch('https://your-new-api.com/api/v1/health');
const health = await response.json();
console.log('API Status:', health.status);
```

### Ожидаемый ответ
```json
{
  "status": "ok",
  "timestamp": "2026-01-28T17:00:00Z",
  "version": "1.3.0",
  "uptime": 3456789,
  "services": {
    "database": "ok",
    "cache": "ok",
    "storage": "ok"
  }
}
```

---

## 6. Отправка спарсенных отзывов (External API)

### cURL
```bash
curl -X POST "https://your-external-api.com/api/v1/reviews" \
  -H "Authorization: Bearer external_token_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "reviews": [
      {
        "productId": "187489568",
        "productName": "Платье женское летнее",
        "reviewId": "wb_rev_12345",
        "rating": 5,
        "reviewDate": "15.01.2026",
        "authorName": "Екатерина С.",
        "reviewText": "Отличное платье, качество супер!",
        "photos": ["https://wbx.ru/photo1.jpg"],
        "hasVideo": false,
        "sellerResponse": null,
        "likes": 12,
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
  }'
```

### JavaScript (Fetch)
```javascript
const reviews = [
  {
    productId: '187489568',
    productName: 'Платье женское летнее',
    reviewId: 'wb_rev_12345',
    rating: 5,
    reviewDate: '15.01.2026',
    authorName: 'Екатерина С.',
    reviewText: 'Отличное платье, качество супер!',
    photos: ['https://wbx.ru/photo1.jpg'],
    hasVideo: false,
    sellerResponse: null,
    likes: 12,
    dislikes: 0,
    parsedAt: new Date().toISOString()
  }
];

const response = await fetch('https://your-external-api.com/api/v1/reviews', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer external_token_12345',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    reviews: reviews,
    stats: {
      totalReviews: reviews.length,
      pagesParsed: 1,
      duration: 5.2,
      filters: {
        stars: [1, 2, 3, 4, 5],
        withPhotos: false,
        withVideo: false,
        withoutSellerResponse: false
      }
    },
    timestamp: new Date().toISOString()
  })
});

const result = await response.json();
console.log('Отзывы отправлены:', result);
```

### Ожидаемый ответ
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

## 7. Обработка ошибок

### Пример 1: Неверный токен (401)

```bash
curl -X GET "https://your-new-api.com/api/v1/stores" \
  -H "Authorization: Bearer invalid_token"
```

**Ответ:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing token",
  "code": "AUTH_FAILED"
}
```

### Пример 2: Магазин не найден (404)

```bash
curl -X GET "https://your-new-api.com/api/v1/stores/nonexistent_store/complaints" \
  -H "Authorization: Bearer wbrm_test_token_12345"
```

**Ответ:**
```json
{
  "error": "Not Found",
  "message": "Store not found",
  "code": "STORE_NOT_FOUND"
}
```

### Пример 3: Жалоба уже отправлена (409)

```bash
curl -X POST "https://your-new-api.com/api/v1/stores/store_abc123/reviews/review_001/complaint/sent" \
  -H "Authorization: Bearer wbrm_test_token_12345" \
  -H "Content-Type: application/json"
```

**Ответ (если идемпотентность реализована правильно - должен быть 200):**
```json
{
  "success": true,
  "message": "Complaint already marked as sent",
  "data": {
    "reviewId": "review_001",
    "status": "sent"
  }
}
```

**ИЛИ (если НЕ идемпотентный - 409):**
```json
{
  "error": "Conflict",
  "message": "Complaint already marked as sent",
  "code": "ALREADY_SENT"
}
```

### Пример 4: Rate limit превышен (429)

```bash
# После 100 запросов в минуту
curl -X GET "https://your-new-api.com/api/v1/stores" \
  -H "Authorization: Bearer wbrm_test_token_12345"
```

**Ответ:**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Retry after 60 seconds",
  "code": "RATE_LIMIT",
  "retryAfter": 60
}
```

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1706461800
Retry-After: 60
```

---

## 8. Парсинг complaintText

### JavaScript функция для парсинга

```javascript
/**
 * Парсит complaintText из API
 * @param {string} complaintText - Строка с JSON в markdown блоке
 * @returns {Object} - {reasonId, reasonName, complaintText}
 */
function parseComplaintText(complaintText) {
  try {
    // Удаляем markdown блок
    const rawJson = complaintText
      .replace(/```json|```/g, '')
      .trim();

    // Парсим JSON
    const parsed = JSON.parse(rawJson);

    return {
      reasonId: parsed.reasonId,
      reasonName: parsed.reasonName,
      text: parsed.complaintText
    };
  } catch (error) {
    console.error('Ошибка парсинга complaintText:', error);
    throw new Error('Invalid complaintText format');
  }
}

// Пример использования
const complaint = {
  id: 'review_001',
  complaintText: '```json\n{"reasonId":"1","reasonName":"Оскорбление","complaintText":"Текст жалобы"}\n```'
};

const parsed = parseComplaintText(complaint.complaintText);
console.log(parsed);
// {
//   reasonId: '1',
//   reasonName: 'Оскорбление',
//   text: 'Текст жалобы'
// }
```

---

## 9. Создание ключа для поиска отзыва

### JavaScript функция

```javascript
/**
 * Создает уникальный ключ для идентификации отзыва
 * @param {string} productId - Артикул WB
 * @param {number} rating - Рейтинг 1-5
 * @param {string} reviewDate - Дата в формате "DD.MM.YYYY"
 * @returns {string} - Ключ вида "productId_rating_reviewDate"
 */
function createReviewKey(productId, rating, reviewDate) {
  return `${productId}_${rating}_${reviewDate}`;
}

// Пример использования
const complaint = {
  productId: '187489568',
  rating: 1,
  reviewDate: '18.01.2026'
};

const key = createReviewKey(
  complaint.productId,
  complaint.rating,
  complaint.reviewDate
);

console.log(key); // "187489568_1_18.01.2026"
```

---

## 10. Полный workflow обработки жалобы

### JavaScript - полный пример

```javascript
/**
 * Класс для работы с Complaints API
 */
class ComplaintsAPI {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async getStores() {
    const response = await fetch(`${this.baseUrl}/stores`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }

  async getComplaints(storeId, skip = 0, take = 100) {
    const url = `${this.baseUrl}/stores/${storeId}/complaints?skip=${skip}&take=${take}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }

  async markAsSent(storeId, reviewId, metadata = {}) {
    const url = `${this.baseUrl}/stores/${storeId}/reviews/${reviewId}/complaint/sent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sentAt: new Date().toISOString(),
        ...metadata
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }

  parseComplaintText(complaintText) {
    const rawJson = complaintText.replace(/```json|```/g, '').trim();
    return JSON.parse(rawJson);
  }

  createReviewKey(productId, rating, reviewDate) {
    return `${productId}_${rating}_${reviewDate}`;
  }
}

// Использование
async function processComplaints() {
  const api = new ComplaintsAPI(
    'https://your-new-api.com/api/v1',
    'wbrm_test_token_12345'
  );

  // 1. Получить список магазинов
  const stores = await api.getStores();
  console.log(`Найдено магазинов: ${stores.length}`);

  const store = stores[0];
  console.log(`Обрабатываем магазин: ${store.name}`);

  // 2. Получить жалобы
  const complaints = await api.getComplaints(store.id, 0, 10);
  console.log(`Получено жалоб: ${complaints.length}`);

  // 3. Обработать каждую жалобу
  for (const complaint of complaints) {
    console.log(`\nОбрабатываем жалобу ${complaint.id}`);

    // Создаем ключ для поиска
    const key = api.createReviewKey(
      complaint.productId,
      complaint.rating,
      complaint.reviewDate
    );
    console.log(`Ключ: ${key}`);

    // Парсим текст жалобы
    const parsed = api.parseComplaintText(complaint.complaintText);
    console.log(`Причина: ${parsed.reasonName}`);
    console.log(`Текст: ${parsed.complaintText.substring(0, 50)}...`);

    // Здесь Extension находит отзыв на WB и подает жалобу
    // ...

    // Отмечаем как отправленную
    await api.markAsSent(store.id, complaint.id, {
      duration: 2.5,
      reasonId: parsed.reasonId,
      reasonName: parsed.reasonName
    });

    console.log('✅ Жалоба отправлена');

    // Задержка между жалобами
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n✅ Все жалобы обработаны!');
}

// Запуск
processComplaints().catch(console.error);
```

---

## 11. Тестирование с Postman

### Настройка Environment

Создайте Environment в Postman с переменными:

```
baseUrl = https://your-new-api.com/api/v1
token = wbrm_test_token_12345
storeId = store_abc123
reviewId = review_001
```

### Collection Structure

```
WB Reports API
├── Auth
│   └── Health Check (GET {{baseUrl}}/health)
├── Stores
│   ├── Get Stores (GET {{baseUrl}}/stores)
│   └── Get Store Details (GET {{baseUrl}}/stores/{{storeId}})
├── Complaints
│   ├── Get Complaints (GET {{baseUrl}}/stores/{{storeId}}/complaints)
│   ├── Get Complaints (Paginated) (GET {{baseUrl}}/stores/{{storeId}}/complaints?skip=10&take=10)
│   └── Mark As Sent (POST {{baseUrl}}/stores/{{storeId}}/reviews/{{reviewId}}/complaint/sent)
└── Reviews (External)
    └── Send Reviews (POST {{baseUrl}}/reviews)
```

### Pre-request Script для всех запросов (кроме Health)

```javascript
// Добавляем Authorization header
pm.request.headers.add({
  key: 'Authorization',
  value: `Bearer ${pm.environment.get('token')}`
});
```

### Test Script для проверки ответов

```javascript
// Для GET /stores
pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response is array", function () {
  pm.expect(pm.response.json()).to.be.an('array');
});

pm.test("Stores have required fields", function () {
  const stores = pm.response.json();
  pm.expect(stores[0]).to.have.property('id');
  pm.expect(stores[0]).to.have.property('name');
});

// Для GET /complaints
pm.test("Complaints have reviewDate", function () {
  const complaints = pm.response.json();
  complaints.forEach(complaint => {
    pm.expect(complaint).to.have.property('reviewDate');
    pm.expect(complaint.reviewDate).to.match(/^\d{2}\.\d{2}\.\d{4}$/);
  });
});

// Для POST /complaint/sent
pm.test("Complaint marked successfully", function () {
  const response = pm.response.json();
  pm.expect(response).to.have.property('success', true);
});
```

---

## 12. Нагрузочное тестирование

### Apache Bench (ab)

```bash
# 1000 запросов, 10 одновременных
ab -n 1000 -c 10 \
  -H "Authorization: Bearer wbrm_test_token_12345" \
  https://your-new-api.com/api/v1/health

# Ожидаемые результаты:
# - Requests per second: > 100
# - Time per request: < 100ms (mean)
# - Failed requests: 0
```

### Artillery.io

Создайте файл `load-test.yml`:

```yaml
config:
  target: "https://your-new-api.com"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"
  defaults:
    headers:
      Authorization: "Bearer wbrm_test_token_12345"

scenarios:
  - name: "Get complaints flow"
    flow:
      - get:
          url: "/api/v1/stores"
      - get:
          url: "/api/v1/stores/store_abc123/complaints?take=10"
      - post:
          url: "/api/v1/stores/store_abc123/reviews/review_001/complaint/sent"
          json:
            sentAt: "{{ $now }}"
            duration: 2.5
```

Запуск:
```bash
artillery run load-test.yml
```

---

## 13. Мониторинг

### Проверка доступности (каждые 30 секунд)

```bash
#!/bin/bash
while true; do
  response=$(curl -s -o /dev/null -w "%{http_code}" https://your-new-api.com/api/v1/health)

  if [ $response -eq 200 ]; then
    echo "$(date) - ✅ API доступен (HTTP $response)"
  else
    echo "$(date) - ❌ API недоступен (HTTP $response)"
    # Отправить alert
  fi

  sleep 30
done
```

### Проверка response time

```bash
#!/bin/bash
time=$(curl -s -o /dev/null -w "%{time_total}" https://your-new-api.com/api/v1/health)
echo "Response time: ${time}s"

# Alert если > 1s
if (( $(echo "$time > 1.0" | bc -l) )); then
  echo "⚠️ Slow response time!"
fi
```

---

**Дата:** 28 января 2026
**Версия:** 1.3.0
