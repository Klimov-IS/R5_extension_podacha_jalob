# Extension Implementation: Status Sync

> **Что делает расширение для синхронизации статусов**

---

## Текущее состояние

Расширение уже умеет:

| Функция | Статус | Файл |
|---------|--------|------|
| Парсинг статусов отзывов | ✅ Работает | `src/contents/complaints/dom/data-extractor.js` |
| Определение canSubmitComplaint | ✅ Работает | `src/contents/complaints/handlers/optimized-handler.js` |
| Группировка по артикулам | ✅ Работает | `optimized-handler.js` |
| Отправка данных в Backend | ⏳ Нужно добавить | - |

---

## Что нужно добавить

### 1. Новый сервис: StatusSyncService

**Файл:** `src/services/status-sync-service.js`

```javascript
/**
 * Сервис синхронизации статусов отзывов с Backend
 */
class StatusSyncService {
  constructor() {
    this.API_ENDPOINT = '/api/extension/review-statuses';
    this.BATCH_SIZE = 100;
  }

  /**
   * Отправить статусы отзывов в Backend
   * @param {string} storeId - ID магазина
   * @param {Array} reviews - массив отзывов со статусами
   */
  async syncStatuses(storeId, reviews) {
    const payload = {
      storeId,
      parsedAt: new Date().toISOString(),
      reviews: reviews.map(r => ({
        reviewKey: this.normalizeReviewKey(r.key),
        productId: r.productId,
        rating: r.rating,
        reviewDate: r.reviewDate,
        statuses: r.statuses || [],
        canSubmitComplaint: this.canSubmitComplaint(r.statuses)
      }))
    };

    // Отправляем батчами по BATCH_SIZE
    const batches = this.splitIntoBatches(payload.reviews, this.BATCH_SIZE);

    for (const batch of batches) {
      await this.sendBatch(storeId, batch);
    }
  }

  /**
   * Определить, можно ли подать жалобу
   */
  canSubmitComplaint(statuses) {
    const COMPLAINT_STATUSES = [
      'Жалоба отклонена',
      'Жалоба одобрена',
      'Проверяем жалобу',
      'Жалоба пересмотрена'
    ];
    return !statuses.some(s => COMPLAINT_STATUSES.includes(s));
  }

  /**
   * Нормализовать ключ (убрать секунды)
   */
  normalizeReviewKey(key) {
    if (!key) return key;
    return key.replace(/T(\d{2}:\d{2}):\d{2}\.\d{3}Z$/, 'T$1');
  }

  // ... остальные методы
}
```

### 2. Интеграция в воркфлоу

**Когда отправлять статусы:**

1. **После парсинга отзывов** - когда расширение сканирует страницы
2. **После подачи жалобы** - чтобы обновить статус на "Проверяем жалобу"
3. **Периодически** - фоновая синхронизация (опционально)

**Точка интеграции:**

```javascript
// В optimized-handler.js после парсинга
const parsedReviews = [...]; // результат парсинга

// Отправляем статусы в Backend (асинхронно, не блокируем основной процесс)
StatusSyncService.syncStatuses(storeId, parsedReviews)
  .then(() => console.log('[StatusSync] Статусы отправлены'))
  .catch(err => console.error('[StatusSync] Ошибка:', err));
```

---

## Существующий код парсинга статусов

### DataExtractor.getReviewStatuses()

**Файл:** `src/contents/complaints/dom/data-extractor.js`

```javascript
static getReviewStatuses(row) {
  const statuses = [];

  // Контейнер статусов
  const statusContainer = row.querySelector('[class*="Feedback-statuses"]');

  if (statusContainer) {
    const chips = statusContainer.querySelectorAll('[data-name="Chips"]');

    for (const chip of chips) {
      const textEl = chip.querySelector('[class*="Chips__text"]');
      if (textEl) {
        const text = textEl.textContent.trim();
        if (text && !statuses.includes(text)) {
          statuses.push(text);
        }
      }
    }
  }

  return statuses;
}
```

### OptimizedHandler - логика canSubmitComplaint

**Файл:** `src/contents/complaints/handlers/optimized-handler.js`

```javascript
// Определяем возможность подачи жалобы
const COMPLAINT_STATUSES = [
  'Жалоба отклонена',
  'Жалоба одобрена',
  'Проверяем жалобу',
  'Жалоба пересмотрена'
];

const hasComplaintStatus = statuses.some(s => COMPLAINT_STATUSES.includes(s));

// МОЖНО подать жалобу = НЕТ ни одного статуса жалобы
if (!hasComplaintStatus) {
  report.canSubmitComplaint++;
} else {
  report.alreadyProcessed++;
}
```

---

## Формат данных

### Вход (после парсинга)

```javascript
{
  key: "649502497_1_2026-01-07T20:09:37.000Z",
  productId: "649502497",
  rating: 1,
  reviewDate: "2026-01-07T20:09:37.000Z",
  statuses: ["Жалоба отклонена", "Выкуп"],
  text: "Текст отзыва..."
}
```

### Выход (для Backend)

```javascript
{
  reviewKey: "649502497_1_2026-01-07T20:09",  // нормализованный
  productId: "649502497",
  rating: 1,
  reviewDate: "2026-01-07T20:09:37.000Z",
  statuses: ["Жалоба отклонена", "Выкуп"],
  canSubmitComplaint: false
}
```

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTENT SCRIPT                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  OptimizedHandler.processComplaints()                │    │
│  │    ├── DataExtractor.extractReviewData()             │    │
│  │    │     └── getReviewStatuses()                     │    │
│  │    └── StatusSyncService.syncStatuses() ────────────┼────┼──► Backend API
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Обработка ошибок

```javascript
async syncStatuses(storeId, reviews) {
  try {
    // ... отправка
  } catch (error) {
    // Логируем, но не прерываем основной процесс
    console.error('[StatusSync] Ошибка синхронизации:', error);

    // Можно сохранить в localStorage для повторной отправки
    this.saveForRetry(storeId, reviews);
  }
}
```

---

## Тестирование

### Консольная команда для теста

```javascript
// Тест отправки статусов
(async () => {
  const testData = {
    storeId: "123456",
    parsedAt: new Date().toISOString(),
    reviews: [
      {
        reviewKey: "649502497_1_2026-01-07T20:09",
        productId: "649502497",
        rating: 1,
        reviewDate: "2026-01-07T20:09:37.000Z",
        statuses: ["Жалоба отклонена", "Выкуп"],
        canSubmitComplaint: false
      }
    ]
  };

  const response = await fetch('/api/extension/review-statuses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testData)
  });

  console.log('Response:', await response.json());
})();
```

---

## План реализации

1. **Создать StatusSyncService** - новый файл сервиса
2. **Добавить отправку в OptimizedHandler** - после парсинга
3. **Добавить в message-router** - обработчик для фоновой отправки
4. **Тестирование** - проверка интеграции с Backend
