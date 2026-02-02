# ✅ Backend API Data Issue - Resolution

**Дата:** 2026-01-29
**Приоритет:** 🔥 ВЫСОКИЙ
**Статус:** ✅ **РЕШЕНО**
**От:** Backend Team (WB Reputation Manager)
**Для:** Chrome Extension Team (R5 Complaints System)

---

## 📋 Краткое Резюме

Проблема с пустыми данными **решена**. Root cause найдена и исправлена.

**Ключевые изменения:**
- ❌ Endpoint фильтровал по `reviews.complaint_status = 'draft'`
- ✅ **Исправлено:** Теперь фильтрует по `review_complaints.status = 'draft'`
- ✅ Fix задеплоен на production
- ✅ API возвращает 601 жалоба для магазина ИП Артюшина

---

## 🔍 Root Cause Analysis

### Проблема

Endpoint `/api/extension/stores/:storeId/complaints` возвращал пустой массив для ВСЕХ магазинов, даже когда жалобы существовали в базе данных.

### Первопричина

**Несоответствие между схемой данных и SQL запросом:**

1. **Таблица `reviews`:**
   - Имеет поле `complaint_status` (статус жалобы для отзыва)
   - При генерации жалобы это поле должно обновляться на `'draft'`
   - НО: В реальных данных ВСЕ отзывы имели `complaint_status = 'not_sent'`

2. **Таблица `review_complaints`:**
   - Содержит сами жалобы
   - Имеет поле `status` (статус жалобы: `'draft'`, `'sent'`, и т.д.)
   - Жалобы существовали в этой таблице со статусом `'draft'`

3. **Endpoint SQL запрос (старый):**
   ```sql
   WHERE r.store_id = $1
     AND r.complaint_status = 'draft'  -- ❌ Неправильно!
     AND r.rating = ANY($2)
   ```

**Результат:** JOIN работал корректно, жалобы находились, но фильтр `r.complaint_status = 'draft'` отсекал ВСЕ результаты, так как ни один отзыв не имел этого статуса.

---

### Диагностика (что мы обнаружили)

**Магазин:** ИП Артюшина (`7kKX9WgLvOPiXYIHk6hi`)

```sql
-- Проверка статусов в reviews
SELECT complaint_status, COUNT(*)
FROM reviews
WHERE store_id = '7kKX9WgLvOPiXYIHk6hi'
GROUP BY complaint_status;
```

**Результат:**
```
complaint_status | count
-----------------|-------
not_sent         | 16151  -- ❌ ВСЕ отзывы имеют not_sent!
```

```sql
-- Проверка жалоб в review_complaints
SELECT COUNT(*)
FROM review_complaints rc
JOIN reviews r ON rc.review_id = r.id
WHERE r.store_id = '7kKX9WgLvOPiXYIHk6hi'
  AND rc.status = 'draft';
```

**Результат:**
```
count
------
601    -- ✅ Жалобы существуют!
```

**Вывод:** Жалобы существуют в `review_complaints` со статусом `'draft'`, но endpoint фильтровал по `reviews.complaint_status = 'draft'`, где все значения были `'not_sent'`.

---

## ✅ Решение

### Изменения в Коде

**Файл:** `src/app/api/extension/stores/[storeId]/complaints/route.ts`

**Commit:** `55dea84` - "fix: Change complaints endpoint to filter by review_complaints.status"

#### 1. Основной запрос жалоб (строка 112)

**Было:**
```typescript
WHERE r.store_id = $1
  AND r.complaint_status = 'draft'  -- ❌ Неправильно
  AND r.rating = ANY($2)
```

**Стало:**
```typescript
WHERE r.store_id = $1
  AND rc.status = 'draft'  -- ✅ Правильно!
  AND r.rating = ANY($2)
```

---

#### 2. Статистика по рейтингам (строка 128)

**Было:**
```typescript
WHERE r.store_id = $1 AND r.complaint_status = 'draft'
```

**Стало:**
```typescript
WHERE r.store_id = $1 AND rc.status = 'draft'
```

---

#### 3. Статистика по артикулам (строка 144)

**Было:**
```typescript
WHERE r.store_id = $1 AND r.complaint_status = 'draft'
```

**Стало:**
```typescript
WHERE r.store_id = $1 AND rc.status = 'draft'
```

---

### Deployment

**Git:**
```bash
git commit -m "fix: Change complaints endpoint to filter by review_complaints.status"
git push origin main
```

**Production:**
```bash
ssh ubuntu@158.160.217.236
cd /var/www/wb-reputation
git pull origin main
npm run build
pm2 reload wb-reputation
```

**Статус:** ✅ Deployed to production at 2026-01-29 13:59 MSK

---

## 🧪 Тестирование

### Test 1: ИП Артюшина (7kKX9WgLvOPiXYIHk6hi)

**Request:**
```bash
curl -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" \
     "http://158.160.217.236/api/extension/stores/7kKX9WgLvOPiXYIHk6hi/complaints?limit=3"
```

**Response:** ✅ **200 OK**

```json
{
  "complaints": [
    {
      "id": "MDZTXVilHWCXBK1YZx4u",
      "productId": "P-02-NY-long",
      "rating": 1,
      "text": "Самая отвратительная пижама из всех пижам...",
      "authorName": "Алина",
      "createdAt": "2026-01-07T20:09:37.000Z",
      "complaintText": {
        "reasonId": 11,
        "reasonName": "Отзыв не относится к товару",
        "complaintText": "Отзыв покупателя не содержит объективной оценки..."
      }
    },
    {
      "id": "BuqKtsdHZzxAYevQz71K",
      "productId": "Флисовые брюки коричневые НЛ",
      "rating": 3,
      "text": "",
      "authorName": "Жанна",
      "createdAt": "2026-01-02T15:56:31.000Z",
      "complaintText": {
        "reasonId": 12,
        "reasonName": "Отзыв оставили конкуренты",
        "complaintText": "Отзыв содержит только низкую оценку..."
      }
    },
    {
      "id": "RL8O41ysJ0URxiO8uEmW",
      "productId": "Флисовые брюки коричневые НЛ",
      "rating": 2,
      "text": "",
      "authorName": "Ольга",
      "createdAt": "2025-12-31T23:39:39.000Z",
      "complaintText": {
        "reasonId": 12,
        "reasonName": "Отзыв оставили конкуренты",
        "complaintText": "Отзыв содержит только низкую оценку..."
      }
    }
  ],
  "total": 3,
  "stats": {
    "by_rating": {
      "1": 205,
      "2": 123,
      "3": 273
    },
    "by_article": {
      "shortbazeголубой": 86,
      "Брюки серые пижамные женские": 78,
      "shortbazeчерные": 71,
      "shortbazeбелый": 52,
      "fantasy_whiteбелый": 34,
      ...
    }
  }
}
```

---

### Статистика по магазину

**Всего жалоб:** 601
**Распределение по рейтингам:**
- ⭐ (1 звезда): 205 жалоб
- ⭐⭐ (2 звезды): 123 жалобы
- ⭐⭐⭐ (3 звезды): 273 жалобы

**Топ-5 продуктов с жалобами:**
1. shortbazeголубой - 86 жалоб
2. Брюки серые пижамные женские - 78 жалоб
3. shortbazeчерные - 71 жалоба
4. shortbazeбелый - 52 жалобы
5. fantasy_whiteбелый - 34 жалобы

---

## 📊 Ответы на вопросы из BACKEND_DATA_ISSUE.md

### 1. ✅ Наличие данных

**Вопрос:** Есть ли жалобы в базе для магазина `7kKX9WgLvOPiXYIHk6hi`?

**Ответ:** ДА, 601 жалоба со статусом `'draft'` в таблице `review_complaints`.

---

### 2. ✅ Store ID с данными для тестирования

**Рекомендуемый Store ID:** `7kKX9WgLvOPiXYIHk6hi` (ИП Артюшина)

**Характеристики:**
- Название: ИП Артюшина
- Status: `active` (`isActive: true`)
- Total Reviews: 16,151
- Complaints (draft): 601

**URL для тестирования:**
```
http://158.160.217.236/api/extension/stores/7kKX9WgLvOPiXYIHk6hi/complaints?limit=10
```

---

### 3. ✅ Query параметры

**Вопрос:** Поддерживает ли endpoint параметры `skip` и `take` или только `filter` и `limit`?

**Ответ:** Endpoint поддерживает только следующие параметры:

| Параметр | Тип | Default | Описание |
|----------|-----|---------|----------|
| `filter` | `'draft' \| 'all'` | `'draft'` | Фильтр по статусу жалобы |
| `limit` | `number` | `100` | Лимит результатов (max: 500) |
| `rating` | `string` | `'1,2,3'` | Рейтинги через запятую |

**❌ НЕ поддерживаются:** `skip`, `take`

**Рекомендация для Extension Team:**

Обновите код в `pilot-api.js` (строка 142):

**Было:**
```javascript
const url = `${this.baseURL}/api/extension/stores/${targetStoreId}/complaints?skip=${skip}&take=${take}`;
```

**Должно быть:**
```javascript
const url = `${this.baseURL}/api/extension/stores/${targetStoreId}/complaints?limit=${take}&filter=draft&rating=1,2,3`;
```

**Примечание:** Параметр `skip` не реализован. Для пагинации используйте фильтрацию на стороне клиента или мы можем добавить его в будущем, если необходимо.

---

### 4. ✅ Причина проблемы

**Причина:** Endpoint фильтровал по `reviews.complaint_status = 'draft'`, но в реальных данных все отзывы имели `complaint_status = 'not_sent'`. Жалобы существовали в таблице `review_complaints` со статусом `'draft'`, но фильтр по `reviews.complaint_status` отсекал все результаты.

**Решение:** Изменили фильтр на `review_complaints.status = 'draft'`.

---

## 🎯 Рекомендации для Extension Team

### 1. Обновить query параметры (ВАЖНО!)

**Файл:** `src/api/pilot-api.js` (строка 142)

```javascript
// ❌ Старый код (НЕ работает)
const url = `${this.baseURL}/api/extension/stores/${targetStoreId}/complaints?skip=${skip}&take=${take}`;

// ✅ Новый код (работает)
const url = `${this.baseURL}/api/extension/stores/${targetStoreId}/complaints?limit=${take}&filter=draft&rating=1,2,3`;
```

**Альтернатива (если нужна пагинация):**

Используйте фильтрацию на клиенте:

```javascript
async getComplaints(storeId, { skip = 0, take = 100 } = {}) {
  // Запрашиваем все жалобы (до 500)
  const url = `${this.baseURL}/api/extension/stores/${storeId}/complaints?limit=500&filter=draft`;

  const response = await fetchWithRetry(url, ...);
  const data = await response.json();

  // Пагинация на клиенте
  const complaints = data.complaints.slice(skip, skip + take);

  return {
    ...data,
    complaints,
    total: data.complaints.length
  };
}
```

---

### 2. Протестировать с реальными данными

**Магазин для тестирования:** ИП Артюшина (`7kKX9WgLvOPiXYIHk6hi`)

**Тестовый запрос:**
```javascript
const complaints = await api.getComplaints('7kKX9WgLvOPiXYIHk6hi', { skip: 0, take: 20 });
console.log(`Получено ${complaints.total} жалоб`);
```

**Ожидаемый результат:** 20 жалоб (или меньше, если используется limit)

---

### 3. Обработка статистики

API теперь возвращает статистику:

```javascript
{
  "complaints": [...],
  "total": 3,
  "stats": {
    "by_rating": {
      "1": 205,
      "2": 123,
      "3": 273
    },
    "by_article": {
      "shortbazeголубой": 86,
      "Брюки серые пижамные женские": 78,
      ...
    }
  }
}
```

**Рекомендация:** Используйте `stats` для отображения аналитики в UI расширения (графики, топ продуктов, и т.д.).

---

## 📝 Технические детали

### Схема данных

**Таблица `reviews`:**
```sql
CREATE TABLE reviews (
  id VARCHAR PRIMARY KEY,
  store_id VARCHAR REFERENCES stores(id),
  product_id VARCHAR REFERENCES products(id),
  rating INTEGER,
  text TEXT,
  author VARCHAR,
  date TIMESTAMP,
  complaint_status VARCHAR DEFAULT 'not_sent',  -- not_sent, draft, pending, sent
  ...
);
```

**Таблица `review_complaints`:**
```sql
CREATE TABLE review_complaints (
  id UUID PRIMARY KEY,
  review_id VARCHAR REFERENCES reviews(id),
  reason_id INTEGER,
  reason_name VARCHAR,
  complaint_text TEXT,
  status VARCHAR DEFAULT 'draft',  -- draft, sent, approved, rejected
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Связь:**
- `reviews.id` → `review_complaints.review_id` (ONE-TO-ONE)
- Жалоба создается в `review_complaints` со статусом `'draft'`
- Отзыв должен обновиться: `reviews.complaint_status = 'draft'` (но в реальных данных этого не было)

---

### SQL запрос (исправленный)

```sql
SELECT
  r.id,
  p.vendor_code as product_id,
  r.rating,
  r.text,
  r.author,
  r.date as created_at,
  rc.reason_id,
  rc.reason_name,
  rc.complaint_text
FROM reviews r
JOIN review_complaints rc ON r.id = rc.review_id
JOIN products p ON r.product_id = p.id
WHERE r.store_id = $1
  AND rc.status = 'draft'  -- ✅ Фильтр по статусу в review_complaints
  AND r.rating = ANY($2)
ORDER BY r.date DESC
LIMIT $3;
```

---

## 📞 Контакты и Поддержка

**Backend Team:**
- **Production URL:** http://158.160.217.236
- **GitHub:** https://github.com/Klimov-IS/R5-Saas-v-2.0
- **Version:** 2.0.0

**При возникновении проблем:**
1. Проверьте query параметры (`limit`, `filter`, `rating`)
2. Убедитесь, что используете актуальный токен
3. Проверьте, что Store ID существует и имеет жалобы
4. См. документацию: `BACKEND_TOKEN_RESPONSE.md`

---

## ✅ Заключение

**Все готово для интеграции!** 🎉

- ✅ Проблема диагностирована
- ✅ Root cause найдена
- ✅ Fix задеплоен на production
- ✅ Протестировано с реальными данными (601 жалоба)
- ✅ API возвращает корректные результаты

**Action Items для Extension Team:**
- [ ] Обновить query параметры (`skip`/`take` → `limit`/`filter`)
- [ ] Протестировать с Store ID `7kKX9WgLvOPiXYIHk6hi`
- [ ] Убедиться, что UI корректно отображает жалобы
- [ ] (Опционально) Использовать `stats` для аналитики

**Ожидаемый timeline:**
- С этим fix-ом интеграция должна работать **немедленно**
- Требуется только обновление query параметров в коде расширения

**Хорошей разработки!** 🚀

---

**Дата создания:** 2026-01-29
**Автор:** Backend Team (WB Reputation Manager)
**Версия API:** 2.0.0
**Commit:** 55dea84
**Статус:** ✅ Production Ready
