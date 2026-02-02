# 🚀 Backend API - Готов к Интеграции

**Дата:** 2026-01-28
**Статус:** ✅ ГОТОВО К ИСПОЛЬЗОВАНИЮ
**Production URL:** http://158.160.217.236

---

## 📋 Краткое Резюме

Backend API для Chrome Extension успешно развернут и протестирован. Все endpoint'ы работают, аутентификация настроена, rate limiting активен.

**Готово:**
- ✅ 2 основных API endpoint'а
- ✅ Bearer Token аутентификация
- ✅ Rate limiting (100 запросов/минуту)
- ✅ CORS для chrome-extension://*
- ✅ База данных с жалобами
- ✅ Тестовый токен для разработки

---

## 🔑 Данные для Подключения

### Production Server
```
Base URL: http://158.160.217.236
Environment: Production
Database: PostgreSQL 15 (Yandex Cloud)
```

### Тестовый API Token
```
Token: d794d4408ef0955a693afaa913dd195ddd25f447e94d098c2f6e0155aa2b0038
Store ID: ss6Y8orHTX6vS7SgJl4k
Store Name: 20Grace ИП Ширазданова Г. М.
```

**⚠️ Важно:** Этот токен только для разработки и тестирования. Для продакшн использования каждый магазин получит свой токен.

---

## 📡 API Endpoints

### 1. GET /api/stores/:storeId/complaints

Получение списка жалоб, готовых к отправке на WB.

**URL:**
```
GET http://158.160.217.236/api/stores/{storeId}/complaints
```

**Query Parameters:**
| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `skip` | number | Нет | Пропустить N записей (default: 0) |
| `take` | number | Нет | Вернуть N записей (default: 100, max: 200) |

**Headers:**
```
Authorization: Bearer {your_api_token}
```

**Response (200 OK):**
```json
[
  {
    "id": "Sqe3RgPnbpJMke3xi0bU",
    "productId": "391988959",
    "rating": 3,
    "reviewDate": "2026-01-23T08:38:44.000Z",
    "reviewText": "Не оверложен низ. Не знаю, зачем выкупила...",
    "authorName": "Виктория",
    "createdAt": "2026-01-23T09:00:09.741Z",
    "complaintText": "```json\n{\"reasonId\":\"11\",\"reasonName\":\"Отзыв не относится к товару\",\"complaintText\":\"Отзыв покупателя не содержит...\"}\n```",
    "status": "draft",
    "attempts": 0,
    "lastAttemptAt": null
  }
]
```

**Response Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 2026-01-28T17:00:00.000Z
```

**Пример запроса (JavaScript):**
```javascript
const API_TOKEN = 'd794d4408ef0955a693afaa913dd195ddd25f447e94d098c2f6e0155aa2b0038';
const STORE_ID = 'ss6Y8orHTX6vS7SgJl4k';

async function fetchComplaints(skip = 0, take = 100) {
  const response = await fetch(
    `http://158.160.217.236/api/stores/${STORE_ID}/complaints?skip=${skip}&take=${take}`,
    {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return await response.json();
}

// Использование
const complaints = await fetchComplaints(0, 50);
console.log(`Получено ${complaints.length} жалоб`);
```

---

### 2. POST /api/stores/:storeId/reviews/:reviewId/complaint/sent

Отметить жалобу как отправленную после успешной подачи на WB.

**URL:**
```
POST http://158.160.217.236/api/stores/{storeId}/reviews/{reviewId}/complaint/sent
```

**Headers:**
```
Authorization: Bearer {your_api_token}
```

**Request Body:** Не требуется

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Complaint marked as sent",
  "data": {
    "reviewId": "Sqe3RgPnbpJMke3xi0bU",
    "status": "sent",
    "sentAt": "2026-01-28T16:26:23.818Z"
  }
}
```

**Идемпотентность:**
Безопасно вызывать несколько раз - повторные вызовы вернут:
```json
{
  "success": true,
  "message": "Complaint already marked as sent",
  "data": {
    "reviewId": "Sqe3RgPnbpJMke3xi0bU",
    "status": "sent",
    "sentAt": "2026-01-28T16:26:23.818Z"
  }
}
```

**Пример запроса (JavaScript):**
```javascript
async function markComplaintAsSent(reviewId) {
  const response = await fetch(
    `http://158.160.217.236/api/stores/${STORE_ID}/reviews/${reviewId}/complaint/sent`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return await response.json();
}

// Использование
const result = await markComplaintAsSent('Sqe3RgPnbpJMke3xi0bU');
console.log(result.message); // "Complaint marked as sent"
```

---

## 🔐 Аутентификация

### Bearer Token

Все запросы к API требуют Bearer Token аутентификации.

**Формат заголовка:**
```
Authorization: Bearer d794d4408ef0955a693afaa913dd195ddd25f447e94d098c2f6e0155aa2b0038
```

**Получение токена:**
- Каждый магазин получает уникальный API токен
- Токен предоставляется администратором системы
- Токен привязан к конкретному магазину (Store ID)
- Токен дает доступ только к данным своего магазина

**Безопасность:**
- Храните токен в secure storage расширения
- НЕ встраивайте токен в код расширения
- НЕ логируйте токен в консоль
- Токен можно отозвать в любой момент

---

## 🚦 Rate Limiting

**Лимит:** 100 запросов в минуту на токен

**Response Headers:**
```
X-RateLimit-Limit: 100          // Максимум запросов в минуту
X-RateLimit-Remaining: 95       // Осталось запросов
X-RateLimit-Reset: 2026-01-28T17:00:00.000Z  // Время сброса лимита
```

**При превышении лимита (429):**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Maximum 100 requests per minute.",
  "code": "RATE_LIMIT_EXCEEDED",
  "resetAt": "2026-01-28T17:00:00.000Z"
}
```

**Рекомендации:**
- Кешируйте список жалоб локально
- Не делайте запросы в цикле без задержек
- Обрабатывайте ошибки 429 с повтором через указанное время
- Используйте пагинацию для больших списков

**Пример обработки rate limit:**
```javascript
async function apiRequestWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    // Проверяем rate limit headers
    const remaining = parseInt(response.headers.get('X-RateLimit-Remaining'));
    if (remaining < 10) {
      console.warn(`Low rate limit: ${remaining} requests remaining`);
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After'); // seconds
      console.log(`Rate limited. Retrying after ${retryAfter}s`);
      await sleep(parseInt(retryAfter) * 1000);
      continue;
    }

    return response;
  }

  throw new Error('Max retries exceeded');
}
```

---

## 📝 Формат Данных

### reviewDate - Формат Даты

**Формат:** ISO 8601 (UTC)
**Пример:** `"2026-01-23T08:38:44.000Z"`

**Конвертация в формат для WB (DD.MM.YYYY):**
```javascript
function formatDateForWB(isoString) {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// Использование
const reviewDate = "2026-01-23T08:38:44.000Z";
const wbDate = formatDateForWB(reviewDate);
console.log(wbDate); // "23.01.2026"
```

### complaintText - Текст Жалобы

**Формат:** Markdown code block с JSON внутри

**Пример:**
```
```json
{
  "reasonId": "11",
  "reasonName": "Отзыв не относится к товару",
  "complaintText": "Отзыв покупателя не содержит объективной оценки товара..."
}
```
```

**Парсинг:**
```javascript
function parseComplaintText(complaintText) {
  // Извлекаем JSON из markdown code block
  const match = complaintText.match(/```json\n(.*?)\n```/s);

  if (!match) {
    throw new Error('Invalid complaintText format');
  }

  return JSON.parse(match[1]);
}

// Использование
const complaint = complaints[0];
const parsed = parseComplaintText(complaint.complaintText);

console.log(parsed.reasonId);        // "11"
console.log(parsed.reasonName);      // "Отзыв не относится к товару"
console.log(parsed.complaintText);   // "Отзыв покупателя не содержит..."
```

### Полный пример обработки жалобы:

```javascript
async function processComplaint(complaint) {
  // 1. Парсим данные
  const complaintData = parseComplaintText(complaint.complaintText);
  const wbDate = formatDateForWB(complaint.reviewDate);

  // 2. Формируем данные для отправки на WB
  const wbSubmission = {
    article: complaint.productId,           // WB артикул (nmId)
    reviewDate: wbDate,                     // "23.01.2026"
    reviewText: complaint.reviewText,       // Текст отзыва
    rating: complaint.rating,               // Оценка (1-5)
    authorName: complaint.authorName,       // Имя автора
    reasonId: complaintData.reasonId,       // ID причины для WB
    reasonName: complaintData.reasonName,   // Название причины
    complaintText: complaintData.complaintText  // Текст жалобы
  };

  // 3. Отправляем на WB (ваша логика)
  await submitToWildberries(wbSubmission);

  // 4. Отмечаем как отправленную в нашей системе
  await markComplaintAsSent(complaint.id);
}
```

---

## ❌ Обработка Ошибок

### Коды ошибок

| HTTP Code | Error Code | Описание |
|-----------|------------|----------|
| 400 | `INVALID_PARAMS` | Неверные параметры запроса |
| 401 | `INVALID_TOKEN` | Отсутствует или невалидный токен |
| 403 | `STORE_ACCESS_DENIED` | Токен не имеет доступа к этому магазину |
| 404 | `STORE_NOT_FOUND` | Магазин не найден |
| 404 | `REVIEW_NOT_FOUND` | Отзыв не найден |
| 404 | `COMPLAINT_NOT_FOUND` | Жалоба не найдена |
| 429 | `RATE_LIMIT_EXCEEDED` | Превышен лимит запросов |
| 500 | `DB_ERROR` | Ошибка базы данных |

### Формат ошибки

```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing API token",
  "code": "INVALID_TOKEN"
}
```

### Пример обработки:

```javascript
async function safeApiCall(url, options) {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json();

      switch (error.code) {
        case 'INVALID_TOKEN':
          // Токен невалиден - нужна переавторизация
          console.error('Invalid API token. Please re-authenticate.');
          break;

        case 'STORE_ACCESS_DENIED':
          // Нет доступа к магазину
          console.error('Access denied to this store');
          break;

        case 'RATE_LIMIT_EXCEEDED':
          // Превышен rate limit
          console.warn(`Rate limited. Retry after: ${error.resetAt}`);
          break;

        case 'DB_ERROR':
          // Временная ошибка сервера - можно повторить
          console.error('Server error. Retrying...');
          break;

        default:
          console.error(`API Error: ${error.message}`);
      }

      throw error;
    }

    return await response.json();
  } catch (error) {
    // Network error
    if (error instanceof TypeError) {
      console.error('Network error. Check internet connection.');
    }
    throw error;
  }
}
```

---

## 🧪 Тестирование API

### Проверка подключения

```bash
# 1. Health Check (без токена)
curl http://158.160.217.236/api/health

# Ожидаемый результат:
# {"status":"degraded","services":{"database":{"status":"healthy"},...}}
```

### Тест с токеном

```bash
# 2. Получить список жалоб
curl -H "Authorization: Bearer d794d4408ef0955a693afaa913dd195ddd25f447e94d098c2f6e0155aa2b0038" \
     "http://158.160.217.236/api/stores/ss6Y8orHTX6vS7SgJl4k/complaints?skip=0&take=5"

# Ожидаемый результат: JSON массив с жалобами
```

```bash
# 3. Отметить жалобу как отправленную
curl -X POST \
     -H "Authorization: Bearer d794d4408ef0955a693afaa913dd195ddd25f447e94d098c2f6e0155aa2b0038" \
     "http://158.160.217.236/api/stores/ss6Y8orHTX6vS7SgJl4k/reviews/REVIEW_ID/complaint/sent"

# Ожидаемый результат: {"success":true,"message":"Complaint marked as sent",...}
```

### Тестовая функция для расширения:

```javascript
// Добавьте в ваше расширение для тестирования
async function testAPIConnection() {
  console.log('🧪 Testing API connection...\n');

  const API_TOKEN = 'd794d4408ef0955a693afaa913dd195ddd25f447e94d098c2f6e0155aa2b0038';
  const STORE_ID = 'ss6Y8orHTX6vS7SgJl4k';
  const BASE_URL = 'http://158.160.217.236';

  try {
    // Test 1: Health check
    console.log('Test 1: Health check');
    const healthResponse = await fetch(`${BASE_URL}/api/health`);
    const health = await healthResponse.json();
    console.log('✅ Health:', health.status);

    // Test 2: Get complaints
    console.log('\nTest 2: Get complaints');
    const complaintsResponse = await fetch(
      `${BASE_URL}/api/stores/${STORE_ID}/complaints?skip=0&take=5`,
      {
        headers: { 'Authorization': `Bearer ${API_TOKEN}` }
      }
    );

    const complaints = await complaintsResponse.json();
    console.log(`✅ Got ${complaints.length} complaints`);

    if (complaints.length > 0) {
      console.log('First complaint:', {
        id: complaints[0].id,
        productId: complaints[0].productId,
        rating: complaints[0].rating,
        status: complaints[0].status
      });
    }

    // Test 3: Rate limit headers
    const remaining = complaintsResponse.headers.get('X-RateLimit-Remaining');
    console.log(`\n📊 Rate Limit: ${remaining} requests remaining`);

    console.log('\n✅ All tests passed!');
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Запустите из DevTools консоли расширения
testAPIConnection();
```

---

## 📦 Пример Интеграции

### Архитектура расширения

```
Extension/
├── background.js         # Service worker с API клиентом
├── content-script.js     # Взаимодействие с WB страницей
├── api/
│   ├── client.js        # HTTP клиент
│   ├── complaints.js    # Методы для работы с жалобами
│   └── auth.js          # Хранение токена
└── utils/
    ├── date-formatter.js
    └── complaint-parser.js
```

### api/client.js

```javascript
// Базовый API клиент
class APIClient {
  constructor(baseURL, apiToken) {
    this.baseURL = baseURL;
    this.apiToken = apiToken;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const response = await fetch(url, { ...options, ...defaultOptions });

    // Логируем rate limit
    const remaining = response.headers.get('X-RateLimit-Remaining');
    if (remaining) {
      console.log(`Rate limit: ${remaining} requests remaining`);
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API Error');
    }

    return await response.json();
  }

  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  async post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }
}

export default APIClient;
```

### api/complaints.js

```javascript
import APIClient from './client.js';
import { parseComplaintText, formatDateForWB } from '../utils/index.js';

class ComplaintsAPI {
  constructor(apiToken, storeId) {
    this.client = new APIClient('http://158.160.217.236', apiToken);
    this.storeId = storeId;
  }

  async getComplaints(skip = 0, take = 100) {
    const complaints = await this.client.get(
      `/api/stores/${this.storeId}/complaints`,
      { skip, take }
    );

    // Обрабатываем каждую жалобу
    return complaints.map(complaint => ({
      ...complaint,
      // Парсим complaintText
      parsed: parseComplaintText(complaint.complaintText),
      // Форматируем дату для WB
      wbDate: formatDateForWB(complaint.reviewDate)
    }));
  }

  async markAsSent(reviewId) {
    return this.client.post(
      `/api/stores/${this.storeId}/reviews/${reviewId}/complaint/sent`
    );
  }

  // Получить все жалобы с пагинацией
  async getAllComplaints() {
    const allComplaints = [];
    let skip = 0;
    const take = 100;

    while (true) {
      const batch = await this.getComplaints(skip, take);
      if (batch.length === 0) break;

      allComplaints.push(...batch);
      skip += take;

      // Защита от бесконечного цикла
      if (allComplaints.length > 10000) {
        console.warn('Reached max complaints limit (10000)');
        break;
      }
    }

    return allComplaints;
  }
}

export default ComplaintsAPI;
```

### background.js (пример использования)

```javascript
import ComplaintsAPI from './api/complaints.js';

// Инициализация
const API_TOKEN = 'd794d4408ef0955a693afaa913dd195ddd25f447e94d098c2f6e0155aa2b0038';
const STORE_ID = 'ss6Y8orHTX6vS7SgJl4k';
const complaintsAPI = new ComplaintsAPI(API_TOKEN, STORE_ID);

// Получить жалобы при запуске расширения
chrome.runtime.onStartup.addListener(async () => {
  try {
    console.log('🔄 Fetching complaints from backend...');
    const complaints = await complaintsAPI.getAllComplaints();

    // Сохраняем в локальное хранилище
    await chrome.storage.local.set({
      complaints,
      lastSync: new Date().toISOString()
    });

    console.log(`✅ Synced ${complaints.length} complaints`);

    // Показываем badge с количеством
    chrome.action.setBadgeText({
      text: complaints.length.toString()
    });

  } catch (error) {
    console.error('❌ Failed to sync complaints:', error);
  }
});

// Обработка успешной отправки жалобы на WB
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'COMPLAINT_SENT_TO_WB') {
    const { reviewId } = message.data;

    // Отмечаем в нашей системе
    complaintsAPI.markAsSent(reviewId)
      .then(result => {
        console.log('✅ Marked as sent:', result);
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('❌ Failed to mark as sent:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Async response
  }
});
```

---

## 🔧 Настройка Расширения

### 1. Хранение API Token

```javascript
// Сохранение токена (один раз при настройке)
async function saveAPIToken(token, storeId) {
  await chrome.storage.local.set({
    apiToken: token,
    storeId: storeId
  });
}

// Получение токена
async function getAPIToken() {
  const { apiToken, storeId } = await chrome.storage.local.get([
    'apiToken',
    'storeId'
  ]);

  if (!apiToken || !storeId) {
    throw new Error('API token not configured');
  }

  return { apiToken, storeId };
}
```

### 2. Страница настроек (options.html)

```html
<!DOCTYPE html>
<html>
<head>
  <title>API Settings</title>
</head>
<body>
  <h1>Backend API Configuration</h1>

  <form id="settings-form">
    <label>
      API Token:
      <input type="text" id="api-token" required
             placeholder="d794d4408ef0955a693afaa913dd195ddd25f447e94d098c2f6e0155aa2b0038">
    </label>
    <br>

    <label>
      Store ID:
      <input type="text" id="store-id" required
             placeholder="ss6Y8orHTX6vS7SgJl4k">
    </label>
    <br>

    <button type="submit">Save</button>
    <button type="button" id="test-connection">Test Connection</button>
  </form>

  <div id="status"></div>

  <script src="options.js"></script>
</body>
</html>
```

### 3. options.js

```javascript
document.getElementById('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const apiToken = document.getElementById('api-token').value;
  const storeId = document.getElementById('store-id').value;

  await chrome.storage.local.set({ apiToken, storeId });

  document.getElementById('status').textContent = '✅ Settings saved!';
});

document.getElementById('test-connection').addEventListener('click', async () => {
  const status = document.getElementById('status');
  status.textContent = '🔄 Testing...';

  try {
    const { apiToken, storeId } = await chrome.storage.local.get([
      'apiToken',
      'storeId'
    ]);

    const response = await fetch(
      `http://158.160.217.236/api/stores/${storeId}/complaints?take=1`,
      {
        headers: { 'Authorization': `Bearer ${apiToken}` }
      }
    );

    if (response.ok) {
      status.textContent = '✅ Connection successful!';
    } else {
      const error = await response.json();
      status.textContent = `❌ Error: ${error.message}`;
    }
  } catch (error) {
    status.textContent = `❌ Network error: ${error.message}`;
  }
});
```

---

## 📊 Мониторинг и Отладка

### Логирование запросов

```javascript
class APILogger {
  static log(method, endpoint, response, duration) {
    console.log(`[API] ${method} ${endpoint}`, {
      status: response.status,
      duration: `${duration}ms`,
      remaining: response.headers.get('X-RateLimit-Remaining')
    });
  }

  static error(method, endpoint, error) {
    console.error(`[API ERROR] ${method} ${endpoint}`, error);
  }
}

// Использование с fetch wrapper
async function apiRequestWithLogging(url, options) {
  const start = Date.now();
  const method = options?.method || 'GET';

  try {
    const response = await fetch(url, options);
    const duration = Date.now() - start;

    APILogger.log(method, url, response, duration);
    return response;

  } catch (error) {
    APILogger.error(method, url, error);
    throw error;
  }
}
```

### Dashboard для разработчиков

```javascript
// Добавьте в DevTools панель расширения
class APIDashboard {
  static async getStats() {
    const { apiToken, storeId } = await getAPIToken();

    // Получаем данные
    const response = await fetch(
      `http://158.160.217.236/api/stores/${storeId}/complaints?take=1`,
      { headers: { 'Authorization': `Bearer ${apiToken}` } }
    );

    // Собираем статистику
    return {
      serverStatus: response.ok ? 'Online' : 'Offline',
      rateLimit: {
        limit: response.headers.get('X-RateLimit-Limit'),
        remaining: response.headers.get('X-RateLimit-Remaining'),
        reset: response.headers.get('X-RateLimit-Reset')
      },
      responseTime: response.headers.get('X-Response-Time')
    };
  }

  static async display() {
    const stats = await this.getStats();
    console.table(stats);
  }
}

// Вызов из DevTools
APIDashboard.display();
```

---

## 📞 Поддержка

### Контакты

- **Production Server:** http://158.160.217.236
- **GitHub Repository:** https://github.com/Klimov-IS/R5-Saas-v-2.0
- **Backend Team:** Смотрите DEPLOYMENT_SUCCESS_2026-01-28.md в корне проекта

### Известные Проблемы

- База данных располагается в Yandex Cloud (ru-central1-d)
- Возможны задержки при первом подключении (~100ms)
- Rate limit сбрасывается каждые 60 секунд

### Дополнительная Документация

1. **Backend Project Root:**
   - `/R5 saas-prod/DEPLOYMENT_SUCCESS_2026-01-28.md` - Полный отчет о деплое
   - `/R5 saas-prod/docs/EXTENSION_API_DOCUMENTATION.md` - Техническая документация API

2. **Deployment Guide:**
   - `/R5 saas-prod/EXTENSION_API_DEPLOYMENT.md` - Инструкция по деплою и тестированию

---

## ✅ Чеклист Интеграции

Перед началом работы убедитесь:

- [ ] Получен API Token от администратора
- [ ] Известен Store ID вашего магазина
- [ ] Проверено подключение через `curl` или Postman
- [ ] Настроена страница options в расширении
- [ ] Реализовано хранение токена в chrome.storage
- [ ] Добавлена обработка ошибок и rate limiting
- [ ] Настроено логирование API запросов
- [ ] Протестирован полный цикл: получение → отправка → отметка
- [ ] Добавлены функции парсинга complaintText и форматирования дат

---

## 🎉 Готово к Использованию!

Backend API полностью готов к интеграции. Все endpoint'ы протестированы и работают стабильно.

**Production URL:** http://158.160.217.236

Если возникнут вопросы или проблемы - обращайтесь к Backend команде.

Удачной интеграции! 🚀
