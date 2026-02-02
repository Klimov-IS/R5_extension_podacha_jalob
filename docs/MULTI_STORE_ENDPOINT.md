# ✅ Multi-Store Support - GET /api/extension/stores

**Дата:** 2026-01-28
**Версия:** 2.0.0
**Статус:** ✅ ГОТОВО К ИСПОЛЬЗОВАНИЮ

---

## 📋 Обзор

Новый endpoint для получения списка всех магазинов пользователя. Позволяет создать dropdown в UI расширения для удобного переключения между магазинами.

**Решает проблему:** Пользователь имеет десятки магазинов, но приходится вручную вводить Store ID в настройках для каждого.

---

## 📡 API Specification

### Endpoint

```
GET /api/extension/stores
```

**Production URL:**
```
http://158.160.217.236/api/extension/stores
```

### Request Headers

```http
Authorization: Bearer {your_api_token}
Content-Type: application/json
```

### Response (200 OK)

```json
[
  {
    "id": "ss6Y8orHTX6vS7SgJl4k",
    "name": "20Grace ИП Ширазданова Г. М.",
    "isActive": true
  },
  {
    "id": "aB3Xr9qP2tKwL5mN8vZj",
    "name": "Магазин 2 ООО Рога и Копыта",
    "isActive": true
  },
  {
    "id": "mN8vZj2tKwL5qP9aB3Xr",
    "name": "Магазин 3 ИП Иванов",
    "isActive": false
  }
]
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Store ID (используется в других API endpoints) |
| `name` | string | Название магазина (для отображения пользователю) |
| `isActive` | boolean | Активен ли магазин (`true` = можно использовать, `false` = показать disabled) |

### Response Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 2026-01-28T18:00:00.000Z
```

---

## 🔐 Аутентификация

Использует тот же Bearer Token, что и другие API endpoints.

```javascript
const headers = {
  'Authorization': `Bearer ${API_TOKEN}`,
  'Content-Type': 'application/json'
};
```

---

## 🚦 Rate Limiting

- **Лимит:** 100 запросов в минуту (shared с другими endpoints)
- **Headers:** `X-RateLimit-*` возвращаются в каждом ответе
- **429 Error:** При превышении лимита

---

## 💻 Примеры Использования

### 1. Базовый Запрос

```javascript
async function loadStores() {
  const response = await fetch('http://158.160.217.236/api/extension/stores', {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load stores: HTTP ${response.status}`);
  }

  const stores = await response.json();
  return stores;
}
```

### 2. Заполнение Dropdown в UI

```javascript
async function populateStoreDropdown() {
  const storeSelect = document.getElementById('store-select');
  const stores = await loadStores();

  // Очистка
  storeSelect.innerHTML = '<option value="">Выберите магазин</option>';

  // Заполнение
  stores.forEach(store => {
    const option = document.createElement('option');
    option.value = store.id;              // Store ID (для API)
    option.textContent = store.name;       // Название (для UI)
    option.disabled = !store.isActive;     // Disabled если неактивен

    if (!store.isActive) {
      option.textContent += ' (неактивен)';
    }

    storeSelect.appendChild(option);
  });
}
```

### 3. HTML Dropdown

```html
<div class="form-group">
  <label for="store-select">Выберите магазин:</label>
  <select id="store-select">
    <option value="">Загрузка магазинов...</option>
  </select>
  <small style="color: #666; font-size: 12px;">
    💡 Выберите магазин, с которым хотите работать
  </small>
</div>
```

### 4. Использование Выбранного Store ID

```javascript
// Обработка выбора магазина
document.getElementById('store-select').addEventListener('change', async (e) => {
  const selectedStoreId = e.target.value;

  if (!selectedStoreId) return;

  // Сохраняем выбор
  await chrome.storage.local.set({ currentStoreId: selectedStoreId });

  // Загружаем жалобы для выбранного магазина
  const complaints = await fetchComplaints(selectedStoreId);
  displayComplaints(complaints);
});
```

### 5. Полный Пример с Кешированием

```javascript
class StoreManager {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.cachedStores = null;
    this.cacheExpiry = null;
    this.CACHE_TTL = 5 * 60 * 1000; // 5 минут
  }

  async loadStores(forceRefresh = false) {
    // Проверяем кеш
    if (!forceRefresh && this.cachedStores && Date.now() < this.cacheExpiry) {
      return this.cachedStores;
    }

    // Запрос к API
    const response = await fetch('http://158.160.217.236/api/extension/stores', {
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const stores = await response.json();

    // Обновляем кеш
    this.cachedStores = stores;
    this.cacheExpiry = Date.now() + this.CACHE_TTL;

    return stores;
  }

  async getStoreById(storeId) {
    const stores = await this.loadStores();
    return stores.find(s => s.id === storeId);
  }

  async getActiveStores() {
    const stores = await this.loadStores();
    return stores.filter(s => s.isActive);
  }
}

// Использование
const storeManager = new StoreManager(API_TOKEN);

// Загрузка всех магазинов
const allStores = await storeManager.loadStores();

// Только активные
const activeStores = await storeManager.getActiveStores();

// Найти конкретный магазин
const store = await storeManager.getStoreById('ss6Y8orHTX6vS7SgJl4k');
console.log(store.name); // "20Grace ИП Ширазданова Г. М."
```

---

## ❌ Обработка Ошибок

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

**Причина:** Неверный или отсутствующий API token

**Решение:** Проверить токен в настройках расширения

### 429 Too Many Requests

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Maximum 100 requests per minute.",
  "code": "RATE_LIMIT_EXCEEDED",
  "resetAt": "2026-01-28T18:00:00.000Z"
}
```

**Причина:** Превышен лимит 100 запросов/минуту

**Решение:** Дождаться сброса лимита (время указано в `resetAt`)

### Пример обработки ошибок:

```javascript
async function safeLoadStores() {
  try {
    const response = await fetch('http://158.160.217.236/api/extension/stores', {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();

      switch (response.status) {
        case 401:
          console.error('Invalid API token. Please check settings.');
          // Показать сообщение пользователю
          break;

        case 429:
          const resetAt = new Date(error.resetAt);
          console.warn(`Rate limited. Try again at ${resetAt.toLocaleTimeString()}`);
          // Повторить запрос позже
          break;

        default:
          console.error(`API Error: ${error.message}`);
      }

      throw error;
    }

    return await response.json();

  } catch (error) {
    if (error instanceof TypeError) {
      console.error('Network error. Check internet connection.');
    }
    throw error;
  }
}
```

---

## 🧪 Тестирование

### Test 1: Базовый запрос (curl)

```bash
curl -X GET http://158.160.217.236/api/extension/stores \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

**Ожидаемый результат:**
```json
[
  {
    "id": "ss6Y8orHTX6vS7SgJl4k",
    "name": "20Grace ИП Ширазданова Г. М.",
    "isActive": true
  }
]
```

### Test 2: Проверка Rate Limit Headers

```javascript
const response = await fetch('http://158.160.217.236/api/extension/stores', {
  headers: { 'Authorization': `Bearer ${API_TOKEN}` }
});

console.log('Rate Limit:', {
  limit: response.headers.get('X-RateLimit-Limit'),
  remaining: response.headers.get('X-RateLimit-Remaining'),
  reset: response.headers.get('X-RateLimit-Reset')
});
```

### Test 3: Проверка с невалидным токеном

```bash
curl -X GET http://158.160.217.236/api/extension/stores \
  -H "Authorization: Bearer invalid_token"
```

**Ожидаемый результат:** HTTP 401 с сообщением об ошибке

---

## 📊 Business Value

### Для Пользователя

- ✅ **Нет необходимости копировать/вставлять Store ID**
- ✅ **Быстрое переключение между магазинами** (один клик)
- ✅ **Понятный интерфейс** (названия магазинов вместо технических ID)
- ✅ **Меньше ошибок** (нет риска ввести неправильный Store ID)

### Для Разработки

- ✅ **Улучшенный UX** → больше пользователей используют расширение
- ✅ **Меньше тикетов в поддержку** (не нужно объяснять где взять Store ID)
- ✅ **Стандартный паттерн** (как в других приложениях с multi-account)

---

## 🔄 Миграция с Одного Магазина

### Было (старый подход):

1. Пользователь идет в настройки
2. Вручную вводит Store ID
3. Сохраняет настройки
4. Перезагружает расширение

### Стало (новый подход):

1. Расширение автоматически загружает список магазинов
2. Пользователь видит dropdown с названиями
3. Выбирает нужный магазин одним кликом
4. Работает сразу!

### Код миграции:

```javascript
// Проверяем, есть ли сохраненный Store ID
const { currentStoreId } = await chrome.storage.local.get('currentStoreId');

if (!currentStoreId) {
  // Загружаем список магазинов
  const stores = await loadStores();

  // Если только один магазин - выбираем автоматически
  if (stores.length === 1) {
    await chrome.storage.local.set({ currentStoreId: stores[0].id });
  } else {
    // Показываем dropdown для выбора
    await populateStoreDropdown();
  }
}
```

---

## 📞 Поддержка

- **Production URL:** http://158.160.217.236
- **Версия API:** 2.0.0
- **Дата релиза:** 2026-01-28

### Related Documentation

- [BACKEND_API_READY.md](./BACKEND_API_READY.md) - Полная документация API
- [QUICK_START.md](./QUICK_START.md) - Быстрый старт
- [MULTI_STORE_API_REQUEST.md](./docs/MULTI_STORE_API_REQUEST.md) - Оригинальный запрос

---

**Endpoint готов к использованию! 🚀**

Все изменения задеплоены на production. Можно начинать интеграцию в расширение.
