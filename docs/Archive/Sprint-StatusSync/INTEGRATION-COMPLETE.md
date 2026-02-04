# Status Sync - Интеграция в расширение

> **Статус:** РЕАЛИЗОВАНО (01.02.2026)

---

## Архитектура

```
[diagnostic.html] → "Начать тест"
       ↓
[diagnostic.js] → chrome.runtime.sendMessage('test4Diagnostics')
       ↓
[content.js] → wb-call-main-world event
       ↓
[main-world-entry.js] → OptimizedHandler.runTest4Diagnostics()
       ↓
[optimized-handler.js] → парсит статусы → syncReviewStatuses()
       ↓
[content.js] → chrome.runtime.sendMessage('syncReviewStatuses')
       ↓
[message-router.js] → StatusSyncHandler.syncStatuses()
       ↓
[status-sync-service.js] → POST https://wb-reputation-2.ru/api/extension/review-statuses
```

---

## Созданные файлы

| Файл | Описание |
|------|----------|
| `src/services/status-sync-service.js` | Сервис отправки статусов в Backend |
| `src/background/handlers/status-sync-handler.js` | Handler для message-router |

## Изменённые файлы

| Файл | Изменение |
|------|-----------|
| `src/background/message-router.js` | Добавлен import + routes для syncReviewStatuses |
| `src/contents/complaints/handlers/optimized-handler.js` | Добавлены `syncReviewStatuses()`, `getReviewStatuses()` + вызов в runTest3/4 |

---

## API методы

### Из консоли (MAIN world)

```javascript
// Синхронизировать статусы
await window.OptimizedHandler.syncReviewStatuses('storeId', reviews);

// Получить синхронизированные статусы (для тестирования)
await window.OptimizedHandler.getReviewStatuses('storeId', { limit: 50 });
```

### Собрать и отправить статусы со страницы

```javascript
// 1. Собрать статусы с текущей страницы
const reviews = [];
const table = window.ElementFinder.findReviewsTable();
const rows = table.querySelectorAll('[class*="table-row"]');
for (const row of rows) {
  const data = window.DataExtractor.extractReviewData(row, '123456789'); // productId
  if (data) reviews.push(data);
}
console.log(`Собрано ${reviews.length} отзывов`);

// 2. Отправить в Backend
const result = await window.OptimizedHandler.syncReviewStatuses('storeId', reviews);
console.log(result);
// { success: true, data: { received: 20, created: 15, updated: 5, errors: 0 } }
```

---

## Формат данных

### Входные данные (reviews)

```javascript
{
  productId: "649502497",
  rating: 1,
  reviewDate: "2026-01-07T20:09:37.000Z",
  key: "649502497_1_2026-01-07T20:09:37.000Z",
  statuses: ["Жалоба отклонена", "Выкуп"]
}
```

### Выходные данные (для API)

```javascript
{
  reviewKey: "649502497_1_2026-01-07T20:09",  // нормализованный (без секунд)
  productId: "649502497",
  rating: 1,
  reviewDate: "2026-01-07T20:09:37.000Z",
  statuses: ["Жалоба отклонена", "Выкуп"],
  canSubmitComplaint: false  // автоматически вычисляется
}
```

---

## Production API

| Метод | URL |
|-------|-----|
| POST | `https://wb-reputation-2.ru/api/extension/review-statuses` |
| GET | `https://wb-reputation-2.ru/api/extension/review-statuses?storeId=...` |

**Authorization:** `Bearer wbrm_...`

### Лимиты

- Max 100 отзывов за запрос
- Сервис автоматически разбивает на батчи

---

## Логика canSubmitComplaint

```javascript
const COMPLAINT_STATUSES = [
  'Жалоба отклонена',
  'Жалоба одобрена',
  'Проверяем жалобу',
  'Жалоба пересмотрена'
];

// Можно подать = НЕТ ни одного статуса жалобы
const canSubmitComplaint = !statuses.some(s => COMPLAINT_STATUSES.includes(s));
```

---

## Воркфлоу интеграции

### Автоматически (при запуске теста)

1. Пользователь нажимает "Начать тест" в `diagnostic.html`
2. `runTest4Diagnostics` сканирует отзывы и собирает статусы
3. **После завершения** автоматически вызывается `syncReviewStatuses()`
4. Статусы отправляются в Backend

### Логи в консоли

```
📤 Синхронизация 20 статусов с Backend...
[StatusSync] 📤 Отправка 20 статусов в Backend...
[StatusSync] ✅ Синхронизировано: created=15, updated=5
✅ Статусы синхронизированы: created=15, updated=5
```

---

## Ожидаемый результат

| Метрика | До | После |
|---------|-----|-------|
| Генерация жалоб GPT | 100% отзывов | ~20% отзывов |
| Экономия токенов | 0% | **~80%** |
| Успешность подачи | ~20% | >80% |

---

## Тестирование

### 1. Проверить интеграцию

1. Перезагрузить расширение в Chrome
2. Открыть `diagnostic.html`
3. Выбрать магазин
4. Нажать "Начать тест"
5. После завершения проверить в консоли:
   - `[StatusSync] 📤 Отправка X статусов в Backend...`
   - `[StatusSync] ✅ Синхронизировано: created=X, updated=X`

### 2. Проверить Network

1. Открыть DevTools → Network
2. Запустить тест
3. Найти запрос к `review-statuses`
4. Проверить:
   - Method: POST
   - URL: `https://wb-reputation-2.ru/api/extension/review-statuses`
   - Response: `{ success: true, data: { ... } }`

### 3. Проверить данные в Backend

```javascript
// В консоли на странице WB
const result = await window.OptimizedHandler.getReviewStatuses('storeId');
console.log(result);
// { success: true, data: { total: 1500, reviews: [...], stats: { canSubmit: 300, cannotSubmit: 1200 } } }
```
