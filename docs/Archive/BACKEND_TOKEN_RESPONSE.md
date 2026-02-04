# ✅ Backend API Token Response

**Дата:** 2026-01-29
**Приоритет:** 🔥 КРИТИЧЕСКИЙ
**Статус:** ✅ РЕШЕНО
**От:** Backend Team (WB Reputation Manager)
**Для:** Chrome Extension Team (R5 Complaints System)

---

## 📋 Краткое Резюме

Проблема с токеном **решена**. Причина была в **изменении архитектуры API** после обновления до версии 2.0.0.

**Ключевые изменения:**
- ❌ Токен из старой документации (`d794d440...`) **недействителен** (был для таблицы `api_tokens`)
- ✅ **Актуальный токен** предоставлен ниже (хранится в таблице `user_settings`)
- ✅ Все endpoints протестированы и работают корректно
- ✅ Store ID `ss6Y8orHTX6vS7SgJl4k` активен в базе данных

---

## 🔐 Актуальный Bearer Token (PRODUCTION)

### Токен для всех Extension API endpoints:

```
wbrm_0ab7137430d4fb62948db3a7d9b4b997
```

### Формат использования:

```
Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997
```

### Характеристики токена:

- **Формат:** `wbrm_*` (WB Reputation Manager prefix)
- **Срок действия:** Бессрочный (пока `is_active = true`)
- **Привязка:** User-level token (доступ ко всем магазинам пользователя)
- **Owner:** `itsklimovworkspace@gmail.com`
- **Rate Limiting:** 100 запросов в минуту

---

## ✅ Протестированные Endpoints

Все endpoints **работают корректно** с предоставленным токеном:

### 1. GET `/api/extension/stores`

**Назначение:** Получить список всех магазинов пользователя

**Тест:**
```bash
curl -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" \
     http://158.160.217.236/api/extension/stores
```

**Результат:** ✅ **200 OK** - Возвращает 50 магазинов

**Пример ответа:**
```json
[
  {
    "id": "ss6Y8orHTX6vS7SgJl4k",
    "name": "20Grace ИП Ширазданова Г. М.",
    "isActive": false
  },
  {
    "id": "ihMDtYWEY7IXkR3Lm9Pq",
    "name": "IP Adamyan",
    "isActive": true
  }
]
```

**Важно:** `isActive` определяется статусом магазина:
- `status = 'active'` → `isActive: true`
- `status = 'stopped' | 'paused' | 'archived'` → `isActive: false`

---

### 2. GET `/api/extension/stores/:storeId/complaints`

**Назначение:** Получить жалобы для конкретного магазина

**Тест:**
```bash
curl -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" \
     "http://158.160.217.236/api/extension/stores/ss6Y8orHTX6vS7SgJl4k/complaints?limit=10"
```

**Результат:** ✅ **200 OK**

**Query Parameters:**
- `filter`: `'draft'` | `'all'` (default: `'draft'`)
- `limit`: `number` (default: 100, max: 500)
- `rating`: `'1,2,3'` (comma-separated, default: `'1,2,3'`)

**Пример ответа:**
```json
{
  "complaints": [
    {
      "id": "review_123",
      "productId": "WB12345",
      "rating": 1,
      "text": "Плохой товар",
      "authorName": "Иван И.",
      "createdAt": "2026-01-15T10:30:00Z",
      "complaintText": {
        "reasonId": 11,
        "reasonName": "Отзыв не относится к товару",
        "complaintText": "Отзыв содержит информацию, не относящуюся к характеристикам товара..."
      }
    }
  ],
  "total": 1,
  "stats": {
    "by_rating": { "1": 5, "2": 3, "3": 2 },
    "by_article": { "WB12345": 3, "WB67890": 2 }
  }
}
```

---

### 3. POST `/api/extension/stores/:storeId/reviews/:reviewId/complaint/sent`

**Назначение:** Отметить жалобу как отправленную

**Тест:**
```bash
curl -X POST \
     -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" \
     -H "Content-Type: application/json" \
     http://158.160.217.236/api/extension/stores/ss6Y8orHTX6vS7SgJl4k/reviews/review_123/complaint/sent
```

**Результат:** ✅ **200 OK**

**Request Body:** Не требуется (или пустой JSON `{}`)

**Response:**
```json
{
  "success": true,
  "message": "Complaint marked as sent"
}
```

**Эффект:** Устанавливает `complaint_status = 'sent'` в таблице `reviews`

---

## 🔍 Причина Недействительности Старых Токенов

### Токен из документации: `d794d4408ef0955a693afaa913dd195ddd25f447e94d098c2f6e0155aa2b0038`

**Проблема:**
1. Этот токен был сгенерирован для таблицы **`api_tokens`** (новая система аутентификации)
2. НО все Extension API endpoints используют функцию `getUserByApiToken()`, которая ищет токен в таблице **`user_settings`**
3. В таблице `user_settings` этот токен не существует → 401 Unauthorized

**Архитектурная причина:**

В системе существуют **ДВЕ параллельные системы аутентификации**:

| Система | Таблица | Формат токена | Используется в |
|---------|---------|---------------|----------------|
| **User API Keys** | `user_settings` | `wbrm_*` (32 char hex) | `/api/extension/*` endpoints |
| **Store API Tokens** | `api_tokens` | 64-char hex | Будущие store-specific endpoints |

**Текущая ситуация:**
- Все Extension API endpoints используют **User API Keys** (`user_settings`)
- Таблица `api_tokens` была создана в миграции `001_create_api_tokens_table.sql` для будущего функционала
- Токены из `api_tokens` пока **не используются** в production

---

## 📊 Информация о Store ID `ss6Y8orHTX6vS7SgJl4k`

**Store Details:**
- ✅ **Существует в базе данных**
- **Name:** `20Grace ИП Ширазданова Г. М.`
- **Status:** `stopped` (inactive)
- **Owner:** `itsklimovworkspace@gmail.com`
- **isActive:** `false` (важно для UI расширения)

**Важно:** Магазин находится в статусе `stopped`, но доступен для чтения данных.

---

## 🧪 Примеры Использования (JavaScript)

### 1. Загрузка списка магазинов

```javascript
const BACKEND_ENDPOINT = 'http://158.160.217.236';
const BACKEND_TOKEN = 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

async function loadStores() {
  const response = await fetch(`${BACKEND_ENDPOINT}/api/extension/stores`, {
    headers: {
      'Authorization': `Bearer ${BACKEND_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return await response.json(); // Array of stores
}

// Использование
loadStores().then(stores => {
  console.log(`Loaded ${stores.length} stores`);
  const activeStores = stores.filter(s => s.isActive);
  console.log(`Active stores: ${activeStores.length}`);
});
```

---

### 2. Загрузка жалоб для магазина

```javascript
async function loadComplaints(storeId, options = {}) {
  const {
    filter = 'draft',
    limit = 100,
    rating = '1,2,3'
  } = options;

  const params = new URLSearchParams({ filter, limit, rating });
  const url = `${BACKEND_ENDPOINT}/api/extension/stores/${storeId}/complaints?${params}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${BACKEND_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return await response.json(); // { complaints: [...], total: N, stats: {...} }
}

// Использование
loadComplaints('ss6Y8orHTX6vS7SgJl4k', { limit: 50 })
  .then(data => {
    console.log(`Found ${data.total} complaints`);
    console.log('Stats by rating:', data.stats.by_rating);
  });
```

---

### 3. Отметить жалобу как отправленную

```javascript
async function markComplaintAsSent(storeId, reviewId) {
  const url = `${BACKEND_ENDPOINT}/api/extension/stores/${storeId}/reviews/${reviewId}/complaint/sent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BACKEND_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({}) // Пустое тело или можно вообще не передавать
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return await response.json(); // { success: true, message: "..." }
}

// Использование
markComplaintAsSent('ss6Y8orHTX6vS7SgJl4k', 'review_abc123')
  .then(result => {
    console.log('✅ Complaint marked as sent:', result.message);
  })
  .catch(error => {
    console.error('❌ Error:', error.message);
  });
```

---

## 🔒 Безопасность и Best Practices

### 1. Хранение токена

**❌ НЕ ДЕЛАЙТЕ:**
```javascript
// НЕ хардкодите токен в коде расширения!
const TOKEN = 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
```

**✅ ПРАВИЛЬНО:**
```javascript
// Используйте Chrome Extension Storage API
async function getBackendToken() {
  const { backendToken } = await chrome.storage.local.get(['backendToken']);
  return backendToken;
}

// При установке расширения или в настройках
async function saveBackendToken(token) {
  await chrome.storage.local.set({ backendToken: token });
}
```

---

### 2. Обработка ошибок

```javascript
async function fetchWithAuth(url, options = {}) {
  const token = await getBackendToken();

  if (!token) {
    throw new Error('Backend token not configured. Please check extension settings.');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  // Обработка специфических ошибок
  if (response.status === 401) {
    throw new Error('Invalid or expired token. Please update token in extension settings.');
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || '60';
    throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
  }

  if (response.status === 403) {
    throw new Error('Access denied. You do not have permission to access this store.');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response;
}
```

---

### 3. Rate Limiting

**Ограничение:** 100 запросов в минуту на токен

**Рекомендации:**
- Используйте кеширование для списка магазинов (TTL: 5 минут)
- Добавьте debouncing для частых запросов
- Отслеживайте заголовки `X-RateLimit-*` для мониторинга

```javascript
// Пример простого rate limiter
class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async waitIfNeeded() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      console.warn(`Rate limit reached. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.waitIfNeeded(); // Retry
    }

    this.requests.push(now);
  }
}

const rateLimiter = new RateLimiter();

async function fetchWithRateLimit(url, options) {
  await rateLimiter.waitIfNeeded();
  return fetchWithAuth(url, options);
}
```

---

## 📝 Изменения в Документации

**Необходимо обновить следующие файлы:**

1. `BACKEND_API_READY.md` (строка 34)
   - Заменить токен на `wbrm_0ab7137430d4fb62948db3a7d9b4b997`

2. `QUICK_START.md` (строка 14)
   - Заменить токен на `wbrm_0ab7137430d4fb62948db3a7d9b4b997`

3. `MULTI_STORE_ENDPOINT.md`
   - Обновить пример токена
   - Добавить информацию о формате `wbrm_*`

4. `TESTING_INSTRUCTIONS.md` (строка 127)
   - Заменить токен на актуальный

---

## 🎯 Checklist для Extension Team

- [x] Получить актуальный Bearer Token
- [x] Подтвердить Store ID `ss6Y8orHTX6vS7SgJl4k` существует
- [x] Проверить endpoint `/api/extension/stores` работает
- [x] Проверить endpoint `/api/extension/stores/:storeId/complaints` работает
- [x] Проверить endpoint `/api/extension/stores/:storeId/reviews/:reviewId/complaint/sent` работает
- [ ] Обновить токен в коде расширения (используя Chrome Storage API)
- [ ] Протестировать Multi-Store integration end-to-end
- [ ] Обновить документацию расширения с новым токеном

---

## 🚀 Рекомендации для Интеграции

### Шаг 1: Обновить токен в расширении

```javascript
// В complaints-page.js
const BACKEND_ENDPOINT = 'http://158.160.217.236';
const BACKEND_TOKEN = 'wbrm_0ab7137430d4fb62948db3a7d9b4b997'; // ✅ Актуальный токен

// Или лучше:
const BACKEND_TOKEN = await chrome.storage.local.get(['backendToken'])
  .then(data => data.backendToken || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997');
```

---

### Шаг 2: Протестировать загрузку магазинов

```javascript
async function loadStores(forceRefresh = false) {
  // Проверка кеша
  if (!forceRefresh) {
    const cached = await getCachedStores();
    if (cached && cached.timestamp > Date.now() - 5 * 60 * 1000) {
      console.log('[Stores] Using cached stores');
      return cached.stores;
    }
  }

  console.log('[Stores] Fetching from backend...');
  const response = await fetch(`${BACKEND_ENDPOINT}/api/extension/stores`, {
    headers: {
      'Authorization': `Bearer ${BACKEND_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to load stores: ${error.message}`);
  }

  const stores = await response.json();

  // Кешируем результат
  await chrome.storage.local.set({
    storesCache: {
      stores,
      timestamp: Date.now()
    }
  });

  return stores;
}
```

---

### Шаг 3: Populate Multi-Store Dropdown

```javascript
async function populateStoresDropdown() {
  const dropdown = document.getElementById('store-selector');

  try {
    const stores = await loadStores();
    const activeStores = stores.filter(s => s.isActive);

    console.log(`[Stores] Loaded ${stores.length} stores (${activeStores.length} active)`);

    // Очистка dropdown
    dropdown.innerHTML = '<option value="">Select Store...</option>';

    // Добавляем активные магазины
    activeStores.forEach(store => {
      const option = document.createElement('option');
      option.value = store.id;
      option.textContent = store.name;
      dropdown.appendChild(option);
    });

    // Добавляем неактивные магазины (disabled)
    const inactiveStores = stores.filter(s => !s.isActive);
    if (inactiveStores.length > 0) {
      const separator = document.createElement('option');
      separator.disabled = true;
      separator.textContent = '──────────';
      dropdown.appendChild(separator);

      inactiveStores.forEach(store => {
        const option = document.createElement('option');
        option.value = store.id;
        option.textContent = `${store.name} (inactive)`;
        option.disabled = true;
        dropdown.appendChild(option);
      });
    }

  } catch (error) {
    console.error('[Stores] Error loading stores:', error);
    dropdown.innerHTML = '<option value="">Error loading stores</option>';
    alert(`Failed to load stores: ${error.message}`);
  }
}
```

---

## 📞 Контакты и Поддержка

**Backend Team:**
- **Проект:** WB Reputation Manager v2.0.0
- **Production URL:** http://158.160.217.236
- **GitHub:** https://github.com/Klimov-IS/R5-Saas-v-2.0
- **Owner Email:** itsklimovworkspace@gmail.com

**При возникновении проблем:**
1. Проверьте логи расширения в Chrome DevTools
2. Проверьте network tab для HTTP-запросов
3. Убедитесь, что токен корректно передается в заголовке `Authorization`
4. Проверьте, что Store ID существует (используйте `/api/extension/stores`)

---

## ✅ Заключение

**Все готово для интеграции!** 🎉

- ✅ Актуальный токен предоставлен
- ✅ Все endpoints протестированы
- ✅ Store ID подтвержден
- ✅ Примеры кода предоставлены
- ✅ Security best practices описаны

**Ожидаемый timeline:**
- С этим токеном Multi-Store интеграция должна завершиться за **1-2 часа**
- Дальнейшая разработка больше **НЕ ЗАБЛОКИРОВАНА**

**Хорошей разработки!** 🚀

---

**Дата создания:** 2026-01-29
**Автор:** Backend Team (WB Reputation Manager)
**Версия API:** 2.0.0
**Статус:** ✅ Production Ready
