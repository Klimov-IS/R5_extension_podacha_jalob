# ⚠️ Backend API Data Issue - Нет Жалоб в Ответе

**Дата:** 2026-01-29
**Приоритет:** 🔥 ВЫСОКИЙ
**Статус:** 🔍 ТРЕБУЕТСЯ ДИАГНОСТИКА
**От:** Chrome Extension Team (R5 Complaints System)
**Для:** Backend Team (WB Reputation Manager)

---

## 📋 Краткое Описание Проблемы

После успешного завершения Multi-Store Integration обнаружена проблема с данными:

**Симптомы:**
- ✅ API работает корректно (200 OK responses)
- ✅ Токен валидный (`wbrm_0ab7137430d4fb62948db3a7d9b4b997`)
- ✅ Доступ к магазинам есть
- ⚠️ **Endpoint `/api/extension/stores/:storeId/complaints` возвращает пустой массив для ВСЕХ магазинов**
- 📌 **Известно, что в магазине "ИП Артюшина" (`7kKX9WgLvOPiXYIHk6hi`) есть сгенерированные черновики жалоб**

**Ожидаемое поведение:**
API должен возвращать список жалоб со статусом `draft` для магазинов, где они были созданы системой парсинга отзывов.

**Актуальное поведение:**
API возвращает `{"complaints":[],"total":0,"stats":{"by_rating":{},"by_article":{}}}` для всех магазинов.

---

## 🔍 Детальная Диагностика

### Протестированные Магазины

Мы протестировали следующие магазины с одинаковым результатом (0 жалоб):

#### 1. ИП Артюшина
**Store ID:** `7kKX9WgLvOPiXYIHk6hi`
**Status:** `isActive: true`
**Контекст:** Пользователь утверждает, что для этого магазина есть сгенерированные черновики жалоб

```bash
curl -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" \
     "http://158.160.217.236/api/extension/stores/7kKX9WgLvOPiXYIHk6hi/complaints?limit=10"
```

**Результат:**
```json
{
  "complaints": [],
  "total": 0,
  "stats": {
    "by_rating": {},
    "by_article": {}
  }
}
```

#### 2. ИП Авакова
**Store ID:** `haNp15vW6FWomNLPesHC`
**Status:** `isActive: true`

```bash
curl -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" \
     "http://158.160.217.236/api/extension/stores/haNp15vW6FWomNLPesHC/complaints?limit=10"
```

**Результат:** `{"complaints":[],"total":0}` (аналогично)

#### 3. IP Adamyan
**Store ID:** `ihMDtYWEY7IXkR3Lm9Pq`
**Status:** `isActive: true`

```bash
curl -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" \
     "http://158.160.217.236/api/extension/stores/ihMDtYWEY7IXkR3Lm9Pq/complaints?limit=10"
```

**Результат:** `{"complaints":[],"total":0}` (аналогично)

#### 4. 20Grace ИП Ширазданова Г. М. (из документации)
**Store ID:** `ss6Y8orHTX6vS7SgJl4k`
**Status:** `isActive: false`

```bash
curl -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" \
     "http://158.160.217.236/api/extension/stores/ss6Y8orHTX6vS7SgJl4k/complaints?limit=10"
```

**Результат:** `{"complaints":[],"total":0}` (аналогично)

---

### Тестирование с Разными Параметрами

#### Test 1: С параметром `filter=all`
```bash
curl -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" \
     "http://158.160.217.236/api/extension/stores/7kKX9WgLvOPiXYIHk6hi/complaints?filter=all&limit=100"
```

**Результат:** `{"complaints":[],"total":0}` (аналогично)

#### Test 2: С параметром `filter=draft` (explicit)
```bash
curl -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" \
     "http://158.160.217.236/api/extension/stores/7kKX9WgLvOPiXYIHk6hi/complaints?filter=draft&limit=100"
```

**Результат:** `{"complaints":[],"total":0}` (аналогично)

#### Test 3: С рейтингами `rating=1,2,3,4,5`
```bash
curl -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" \
     "http://158.160.217.236/api/extension/stores/7kKX9WgLvOPiXYIHk6hi/complaints?filter=all&rating=1,2,3,4,5&limit=500"
```

**Результат:** `{"complaints":[],"total":0}` (аналогично)

---

## 💻 Технические Детали Запросов из Расширения

### Метод `getComplaints()` из `pilot-api.js`

**Файл:** `src/api/pilot-api.js` (строка 84-159)

```javascript
/**
 * Получить жалобы для магазина с пагинацией
 * @param {string} [storeId] - ID магазина (опционально, используется текущий storeId)
 * @param {Object} options - Опции пагинации
 * @param {number} [options.skip=0] - Пропустить записей
 * @param {number} [options.take=100] - Взять записей
 * @returns {Promise<Array>} - Массив жалоб
 * @throws {Error} При ошибке сети или API
 */
async getComplaints(storeId, { skip = 0, take = 100 } = {}) {
  await this.initialize();

  // Если storeId не указан, используем текущий
  const targetStoreId = storeId || this.storeId;
  const url = `${this.baseURL}/api/extension/stores/${targetStoreId}/complaints?skip=${skip}&take=${take}`;

  console.log(`[PilotAPI] Запрос жалоб:`, {
    storeId: targetStoreId,
    skip,
    take,
    url,
    token: this.token,
    authHeader: `Bearer ${this.token}`
  });

  const response = await fetchWithRetry(
    url,
    {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
    },
    {
      maxRetries: 3,
      baseDelay: 1000,
      shouldRetry: (res) => res.status === 503
    }
  );

  // Проверяем rate limit headers
  const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
  const rateLimitLimit = response.headers.get('X-RateLimit-Limit');
  const rateLimitReset = response.headers.get('X-RateLimit-Reset');

  if (rateLimitRemaining) {
    console.log(`[PilotAPI] Rate Limit: ${rateLimitRemaining}/${rateLimitLimit}, Reset: ${rateLimitReset}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[PilotAPI] ❌ Ошибка HTTP:', response.status, errorText);

    // Специальная обработка ошибок
    if (response.status === 401) {
      throw new Error('Ошибка авторизации: проверьте Backend Token в настройках');
    } else if (response.status === 404) {
      throw new Error('Магазин не найден: проверьте Store ID в настройках');
    } else if (response.status === 429) {
      throw new Error('Превышен лимит запросов. Пожалуйста, подождите.');
    }

    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
  }

  const complaints = await response.json();
  console.log('[PilotAPI] ✅ Получено жалоб от API:', complaints?.length || 0);

  // Обработка жалоб: парсинг complaintText, генерация reviewKey, форматирование дат
  const processed = processComplaints(complaints);

  return processed;
}
```

### Логи из Chrome Extension (Background Service Worker)

```
[MessageRouter] Маршрутизация сообщения: getComplaints
[ComplaintsHandler] Запрос жалоб: { storeId: "7kKX9WgLvOPiXYIHk6hi", skip: 0, take: 200 }
[SettingsService] Настройки загружены из storage
[SettingsService] 🔍 getBackendEndpoint() вызван, возвращаем: http://158.160.217.236
[SettingsService] 🔍 getBackendToken() вызван, возвращаем: wbrm_0ab7137430d4fb62948db3a7d9b4b997
[PilotAPI] Инициализация завершена: {
  baseURL: "http://158.160.217.236",
  storeId: "7kKX9WgLvOPiXYIHk6hi",
  token: "wbrm_0ab7137430d4fb62948db3a7d9b4b997",
  tokenLength: 37
}
[PilotAPI] Запрос жалоб: {
  storeId: "7kKX9WgLvOPiXYIHk6hi",
  skip: 0,
  take: 200,
  url: "http://158.160.217.236/api/extension/stores/7kKX9WgLvOPiXYIHk6hi/complaints?skip=0&take=200",
  token: "wbrm_0ab7137430d4fb62948db3a7d9b4b997",
  authHeader: "Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997"
}
[FetchRetry] Попытка 1/3: http://158.160.217.236/api/extension/stores/7kKX9WgLvOPiXYIHk6hi/complaints?skip=0&take=200
[PilotAPI] Ответ сервера: { status: 200, statusText: "OK", ok: true }
[PilotAPI] ✅ Получено жалоб от API: 0
[PilotAPI] ✅ Жалобы обработаны: { total: 0, withKeys: 0, withParsedData: 0 }
```

### Логи из complaints-page.js (Frontend)

```
[Complaints Page] Selected store: ИП Артюшина (7kKX9WgLvOPiXYIHk6hi)
[Complaints Page] Получены данные: { data: [] }
[Complaints Page] ✅ Загружено 0 жалоб
```

---

## ⚠️ Несоответствие Query Параметров

### Проблема: Расширение использует `skip` и `take`, но документация указывает `filter` и `limit`

**Из документации (`BACKEND_TOKEN_RESPONSE.md`, строка 98-100):**
```
Query Parameters:
- filter: 'draft' | 'all' (default: 'draft')
- limit: number (default: 100, max: 500)
- rating: '1,2,3' (comma-separated, default: '1,2,3')
```

**Из кода расширения (`pilot-api.js`, строка 89):**
```javascript
const url = `${this.baseURL}/api/extension/stores/${targetStoreId}/complaints?skip=${skip}&take=${take}`;
```

**Вопрос к Backend команде:**
1. Поддерживает ли endpoint параметры `skip` и `take`?
2. Если нет, нужно ли обновить код расширения на `filter` и `limit`?
3. Влияет ли это на результат (возвращение 0 жалоб)?

---

## 📊 Контекст Пользователя и Системы

### Информация о пользователе
- **Email:** `itsklimovworkspace@gmail.com`
- **API Token:** `wbrm_0ab7137430d4fb62948db3a7d9b4b997`
- **Привязка токена:** User-level (доступ ко всем 50 магазинам пользователя)
- **Количество магазинов:** 50 (из них 34 активных, 16 неактивных)

### Магазин с предполагаемыми данными
- **Название:** ИП Артюшина
- **Store ID:** `7kKX9WgLvOPiXYIHk6hi`
- **Status:** `isActive: true` (активен)
- **Owner:** `itsklimovworkspace@gmail.com`
- **Контекст:** Пользователь утверждает, что для этого магазина были созданы черновики жалоб системой парсинга отзывов

### Ожидаемые данные
Согласно пользователю, в магазине "ИП Артюшина" (`7kKX9WgLvOPiXYIHk6hi`) **должны быть жалобы** со статусом `draft`, созданные системой автоматического парсинга отзывов WildBerries.

---

## 🔎 Запрос на Диагностику от Backend Команды

### 1. Проверка данных в базе

Пожалуйста, выполните следующие SQL запросы для диагностики:

#### Запрос 1: Проверка наличия магазина
```sql
SELECT
  id,
  name,
  status,
  user_id,
  created_at,
  updated_at
FROM stores
WHERE id = '7kKX9WgLvOPiXYIHk6hi';
```

**Ожидаемый результат:** Магазин должен существовать с `status = 'active'`

---

#### Запрос 2: Подсчет жалоб по статусам для магазина
```sql
SELECT
  complaint_status,
  COUNT(*) as count
FROM reviews
WHERE store_id = '7kKX9WgLvOPiXYIHk6hi'
GROUP BY complaint_status;
```

**Ожидаемый результат:** Должны быть записи со статусом `draft`, `pending`, или `sent`

**Если пусто:** Данных нет вообще → система парсинга не запущена для этого магазина

---

#### Запрос 3: Примеры жалоб (если есть)
```sql
SELECT
  id,
  product_id,
  rating,
  review_text,
  author_name,
  complaint_status,
  created_at
FROM reviews
WHERE store_id = '7kKX9WgLvOPiXYIHk6hi'
  AND complaint_status IN ('draft', 'pending')
LIMIT 5;
```

**Ожидаемый результат:** Примеры жалоб со статусом `draft` или `pending`

---

#### Запрос 4: Общая статистика по всем магазинам пользователя
```sql
SELECT
  s.id as store_id,
  s.name as store_name,
  s.status as store_status,
  COUNT(r.id) as total_reviews,
  SUM(CASE WHEN r.complaint_status = 'draft' THEN 1 ELSE 0 END) as draft_count,
  SUM(CASE WHEN r.complaint_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
  SUM(CASE WHEN r.complaint_status = 'sent' THEN 1 ELSE 0 END) as sent_count
FROM stores s
LEFT JOIN reviews r ON s.id = r.store_id
WHERE s.user_id = (
  SELECT user_id FROM user_settings WHERE api_token = 'wbrm_0ab7137430d4fb62948db3a7d9b4b997'
)
GROUP BY s.id, s.name, s.status
HAVING total_reviews > 0
ORDER BY draft_count DESC
LIMIT 10;
```

**Ожидаемый результат:** Список магазинов с количеством жалоб по статусам

**Если пусто:** Нет жалоб ни в одном магазине пользователя → нужно запустить парсинг

---

### 2. Проверка endpoint'а

#### Проверка 1: Логирование запросов к `/api/extension/stores/:storeId/complaints`

Пожалуйста, добавьте логирование в endpoint для диагностики:

```javascript
// В обработчике GET /api/extension/stores/:storeId/complaints
console.log('[API] GET /api/extension/stores/:storeId/complaints', {
  storeId: req.params.storeId,
  userId: req.user?.id,
  queryParams: req.query,
  headers: {
    authorization: req.headers.authorization?.substring(0, 20) + '...'
  }
});

// Логирование SQL запроса
console.log('[API] SQL query:', {
  storeId: req.params.storeId,
  filter: req.query.filter || 'draft',
  limit: req.query.limit || 100,
  rating: req.query.rating || '1,2,3'
});

// Логирование результата
console.log('[API] SQL result:', {
  complaintsCount: complaints.length,
  total: total
});
```

#### Проверка 2: Обработка параметров `skip` и `take`

**Вопрос:** Поддерживает ли endpoint параметры `skip` и `take`?

Если НЕТ, то расширение отправляет неправильные параметры:
```
?skip=0&take=200
```

Вместо ожидаемых:
```
?filter=draft&limit=200&rating=1,2,3
```

Это может приводить к тому, что backend игнорирует эти параметры и возвращает пустой результат с дефолтными фильтрами.

---

### 3. Проверка фильтров

Пожалуйста, подтвердите логику фильтрации:

**Дефолтное поведение (из документации):**
- `filter = 'draft'` (по умолчанию)
- `limit = 100` (по умолчанию)
- `rating = '1,2,3'` (по умолчанию)

**Вопросы:**
1. Что происходит, если передать параметры `skip` и `take` вместо `filter` и `limit`?
2. Игнорируются ли они или вызывают ошибку?
3. Возвращается ли пустой результат, если параметры некорректны?

---

## 🎯 Запрос на Решение

### Что нужно от Backend Команды:

#### 1. ✅ Подтвердить наличие данных
- Выполнить SQL запросы (см. раздел "Запрос на Диагностику")
- Подтвердить наличие жалоб в магазине `7kKX9WgLvOPiXYIHk6hi` или других магазинах
- Если данных нет, запустить систему парсинга для тестового магазина

#### 2. ✅ Проверить query параметры
- Подтвердить, поддерживает ли endpoint параметры `skip` и `take`
- Если НЕТ, сообщить Extension команде для обновления кода
- Если ДА, объяснить, почему они не работают

#### 3. ✅ Предоставить Store ID с тестовыми данными
- Указать Store ID, который гарантированно имеет жалобы со статусом `draft`
- Предоставить примерный URL для тестирования
- Количество ожидаемых жалоб для этого магазина

#### 4. ✅ Обновить документацию (опционально)
- Если `skip`/`take` не поддерживаются, обновить `BACKEND_TOKEN_RESPONSE.md`
- Добавить примеры с правильными параметрами
- Указать, какие параметры обязательны

---

## 🧪 Примеры для Тестирования

### Если данные есть, ожидаемый ответ:

```json
{
  "complaints": [
    {
      "id": "review_abc123",
      "productId": "WB12345",
      "rating": 2,
      "text": "Плохое качество товара",
      "authorName": "Иван И.",
      "createdAt": "2026-01-28T10:30:00Z",
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

### Если данных нет, текущий ответ:

```json
{
  "complaints": [],
  "total": 0,
  "stats": {
    "by_rating": {},
    "by_article": {}
  }
}
```

---

## 📞 Контакты

**Extension Team:**
- **Проект:** R5 Complaints System (Chrome Extension)
- **GitHub:** (если есть репозиторий расширения)

**Backend Team:**
- **Проект:** WB Reputation Manager v2.0.0
- **Production URL:** http://158.160.217.236
- **GitHub:** https://github.com/Klimov-IS/R5-Saas-v-2.0

---

## ✅ Чеклист для Backend Команды

- [ ] Выполнить SQL запросы для Store ID `7kKX9WgLvOPiXYIHk6hi`
- [ ] Подсчитать жалобы по статусам (`draft`, `pending`, `sent`)
- [ ] Проверить, есть ли данные в других магазинах пользователя
- [ ] Подтвердить поддержку параметров `skip` и `take` в endpoint
- [ ] Добавить логирование в endpoint для диагностики
- [ ] Предоставить Store ID с тестовыми данными для Extension команды
- [ ] Запустить систему парсинга для магазина `7kKX9WgLvOPiXYIHk6hi` (если данных нет)
- [ ] Обновить документацию с правильными query параметрами

---

## 🙏 Запрос

Пожалуйста, проведите диагностику и предоставьте следующую информацию:

1. **Результаты SQL запросов** - есть ли жалобы в базе для магазина `7kKX9WgLvOPiXYIHk6hi`?
2. **Store ID с данными** - какой магазин можно использовать для тестирования?
3. **Query параметры** - поддерживает ли endpoint `skip`/`take` или только `filter`/`limit`?
4. **Причина проблемы** - почему API возвращает 0 жалоб для всех магазинов?

**Спасибо за помощь!** 🚀

---

**Дата создания:** 2026-01-29
**Автор:** Extension Development Team
**Версия API:** 2.0.0
**Статус расширения:** ✅ Multi-Store Integration Completed, ⚠️ Waiting for Data
