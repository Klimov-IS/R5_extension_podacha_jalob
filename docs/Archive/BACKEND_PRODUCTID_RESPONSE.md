# Backend Response: ProductId Issue

**Дата:** 2026-01-29
**Статус:** ✅ RESOLVED
**Приоритет:** 🔥 HIGH
**Backend Team:** WB Reputation Manager v2.0.0

---

## 📋 Ваш запрос

**Проблема:** API endpoint `/api/extension/stores/:storeId/complaints` возвращал в поле `productId` названия продуктов (например, `"P-02-NY-long"`) вместо числовых артикулов Wildberries (например, `"649502497"`).

**Ожидаемое поведение:** Поле `productId` должно содержать **числовой артикул WB** (nmID), который вы используете для подачи жалоб в WB API.

---

## ✅ Решение

### Что было исправлено

**Endpoint:** `GET /api/extension/stores/:storeId/complaints`

**Изменения в коде:**

1. **Поле `productId` теперь возвращает WB артикул (nmID):**
   - Было: `p.vendor_code as product_id` → возвращал внутренний артикул продавца
   - Стало: `p.wb_product_id as product_id` → возвращает числовой артикул WB

2. **Поле `productName` полностью удалено из ответа:**
   - По обратной связи продакт-менеджера, внутренний артикул продавца ненадежен и не нужен
   - Команда работает исключительно с числовыми артикулами WB
   - Все статистики и сопоставления привязаны к WB артикулам

**Commits:**
- `e2a1877` - Первое исправление: изменили productId на wb_product_id
- `710b356` - Финальное исправление: удалили поле productName

---

## 🧪 Проверка

### API Response (До исправления)

```json
{
  "complaints": [
    {
      "id": "MDZTXVilHWCXBK1YZx4u",
      "productId": "P-02-NY-long",      // ❌ Внутренний артикул продавца
      "productName": "P-02-NY-long",    // ❌ Дублирование, не нужно
      "rating": 1,
      "text": "...",
      "authorName": "Алина",
      "createdAt": "2026-01-07T20:09:37.000Z",
      "complaintText": { ... }
    }
  ]
}
```

### API Response (После исправления)

```json
{
  "complaints": [
    {
      "id": "MDZTXVilHWCXBK1YZx4u",
      "productId": "649502497",         // ✅ Числовой артикул WB (nmID)
      "rating": 1,
      "text": "...",
      "authorName": "Алина",
      "createdAt": "2026-01-07T20:09:37.000Z",
      "complaintText": { ... }
    }
  ]
}
```

### Проверка данных

**Тест для магазина:** ИП Артюшина (`7kKX9WgLvOPiXYIHk6hi`)

```bash
curl -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" \
     "http://158.160.217.236/api/extension/stores/7kKX9WgLvOPiXYIHk6hi/complaints?limit=5"
```

**Результат:**
- ✅ `productId` = `"649502497"` (числовой артикул WB)
- ✅ Поле `productName` отсутствует
- ✅ Все 5 жалоб имеют корректные WB артикулы

---

## 📊 Структура данных

### База данных

**Таблица `products`:**

```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,                -- Внутренний UUID
  store_id TEXT NOT NULL,
  wb_product_id TEXT NOT NULL,        -- nmID из WB (649502497) ✅ Используется
  vendor_code TEXT NOT NULL,          -- Артикул продавца (P-02-NY-long) ❌ Не используется
  name TEXT NOT NULL,                 -- Название товара
  -- ...
);
```

### API Endpoint

**SQL Query (текущий):**

```sql
SELECT
  r.id,
  p.wb_product_id as product_id,     -- ✅ WB артикул (nmID)
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
  AND rc.status = 'draft'
  AND r.rating = ANY($2)
ORDER BY r.date DESC
LIMIT $3
```

---

## 🔄 Статистика по артикулам

**Endpoint статистики также обновлен:**

```json
{
  "stats": {
    "by_article": {
      "649502497": 78,    // ✅ WB артикулы (nmID)
      "528735233": 52,
      "394856123": 31
    }
  }
}
```

**SQL Query для статистики:**

```sql
SELECT p.wb_product_id, COUNT(*) as count
FROM reviews r
JOIN review_complaints rc ON r.id = rc.review_id
JOIN products p ON r.product_id = p.id
WHERE r.store_id = $1 AND rc.status = 'draft'
GROUP BY p.wb_product_id
ORDER BY count DESC
LIMIT 20
```

---

## 💡 Рекомендации для интеграции

### 1. Обновите TypeScript интерфейсы

```typescript
// Extension API Types
interface Complaint {
  id: string;
  productId: string;          // ✅ WB артикул (nmID) - всегда число
  // productName: УДАЛЕНО      // ❌ Больше не возвращается
  rating: number;
  text: string;
  authorName: string;
  createdAt: string;
  complaintText: {
    reasonId: number;
    reasonName: string;
    complaintText: string;
  };
}

interface ComplaintsResponse {
  complaints: Complaint[];
  total: number;
  stats: {
    by_rating: Record<string, number>;
    by_article: Record<string, number>;  // ✅ Ключи - WB артикулы
  };
}
```

### 2. Использование productId для WB API

```typescript
// Пример: Подача жалобы через WB API
async function submitComplaintToWB(complaint: Complaint) {
  const nmID = complaint.productId;  // ✅ Это уже числовой WB артикул

  const wbPayload = {
    nmId: parseInt(nmID),             // Конвертируем в число
    reasonId: complaint.complaintText.reasonId,
    text: complaint.complaintText.complaintText,
    // ...
  };

  await fetch('https://feedbacks-api.wildberries.ru/api/v1/feedbacks/complaint', {
    method: 'POST',
    body: JSON.stringify(wbPayload),
  });
}
```

### 3. Валидация productId

```typescript
// Проверка, что productId - это числовой WB артикул
function isValidWBArticle(productId: string): boolean {
  return /^\d+$/.test(productId);  // Должен содержать только цифры
}

// Пример использования
complaints.forEach(complaint => {
  if (!isValidWBArticle(complaint.productId)) {
    console.error('Invalid WB article:', complaint.productId);
  }
});
```

---

## 🚀 Deployment Status

**Status:** ✅ Deployed to Production

**Deployment Timeline:**
- **14:35 MSK** - Первое исправление: `productId` теперь возвращает WB артикулы
- **14:50 MSK** - Финальное исправление: удалено поле `productName`

**Git:**
```bash
# Commits
e2a1877 - fix: Return wb_product_id instead of vendor_code for productId
710b356 - refactor: Remove productName field from complaints endpoint

# Branch: main
# Status: Pushed to GitHub ✅
```

**Production Server:**
```bash
# Deployment
ssh ubuntu@158.160.217.236
cd /var/www/wb-reputation
git pull origin main
npm run build
pm2 reload wb-reputation
```

---

## ✅ Что вы можете делать сейчас

### 1. Тестируйте API с реальными данными

```bash
# Получить жалобы для магазина
curl -H "Authorization: Bearer wbrm_0ab7137430d4fb62948db3a7d9b4b997" \
     "http://158.160.217.236/api/extension/stores/7kKX9WgLvOPiXYIHk6hi/complaints?limit=10"
```

### 2. Обновите ваш код

- **Удалите все ссылки на `productName`** (поле больше не возвращается)
- **Используйте `productId` напрямую** для WB API (это уже числовой артикул)
- **Проверьте статистики** `stats.by_article` - теперь группируются по WB артикулам

### 3. Интеграция с WB API

Поле `productId` теперь полностью совместимо с WB Feedbacks API:

```typescript
// Готово к использованию - конвертация не требуется
const nmId = parseInt(complaint.productId);  // ✅
```

---

## 📚 Дополнительная информация

### Почему удалили productName?

**Исходная логика:** Мы думали, что `vendor_code` (внутренний артикул продавца) может быть полезен для UI.

**Обратная связь Product Manager:**
> "Артикул продавца может быть тоже чертишто там понаписано, мы работаем с артикулами товаров - и лучше их и оставить, чтобы только они отображались. Так как мы работаем не с названиями а с цифрами, удобно сразу смотреть везде и сравнивать, вся статистика по артикулам тоже привязана к этому."

**Решение:** Убрали `productName` полностью, оставили только `productId` (WB артикул).

### Если нужно название товара для UI

Если вам действительно нужно отображать **полное название товара** (а не vendor_code), дайте знать - мы можем добавить поле `productName` из таблицы `products.name`:

```json
{
  "productId": "649502497",
  "productName": "Хлопковая пижама с принтом NY"  // products.name
}
```

Но сейчас по запросу продакт-менеджера оставили только `productId` (числовой WB артикул).

---

## 📞 Контакты

Если возникнут вопросы или потребуется дополнительная помощь:

**Backend Team:** WB Reputation Manager v2.0.0
**API Version:** 2.0.0
**Endpoint:** `/api/extension/stores/:storeId/complaints`

**Тестовые данные:**
- **Store ID:** `7kKX9WgLvOPiXYIHk6hi` (ИП Артюшина)
- **API Token:** `wbrm_0ab7137430d4fb62948db3a7d9b4b997`
- **Complaints Available:** 601

---

## ✅ Итоговый чек-лист

- [x] `productId` возвращает числовой WB артикул (nmID)
- [x] `productName` полностью удалено из ответа
- [x] Статистика `stats.by_article` группируется по WB артикулам
- [x] Код задеплоен на production
- [x] Endpoint протестирован с реальными данными
- [x] Документация обновлена

**Status:** 🟢 **READY FOR INTEGRATION**

---

**Создано:** 2026-01-29
**Автор:** Backend Team (WB Reputation Manager)
**Версия API:** 2.0.0
**Commits:** `e2a1877`, `710b356`
