# 🚀 Quick Start - Backend API Integration

**Production Ready!** Начните интеграцию за 5 минут.

---

## ⚡ Быстрый Старт

### 1. Тестовые Данные

```javascript
const API_CONFIG = {
  baseURL: 'http://158.160.217.236',
  token: 'd794d4408ef0955a693afaa913dd195ddd25f447e94d098c2f6e0155aa2b0038',
  storeId: 'ss6Y8orHTX6vS7SgJl4k'
};
```

### 2. Первый Запрос (3 строки кода)

```javascript
const response = await fetch(
  'http://158.160.217.236/api/stores/ss6Y8orHTX6vS7SgJl4k/complaints?take=5',
  { headers: { 'Authorization': 'Bearer d794d4408ef0955a693afaa913dd195ddd25f447e94d098c2f6e0155aa2b0038' }}
);
const complaints = await response.json();
console.log(`Got ${complaints.length} complaints`);
```

### 3. Отметить как Отправленную

```javascript
await fetch(
  'http://158.160.217.236/api/stores/ss6Y8orHTX6vS7SgJl4k/reviews/REVIEW_ID/complaint/sent',
  {
    method: 'POST',
    headers: { 'Authorization': 'Bearer d794d4408ef0955a693afaa913dd195ddd25f447e94d098c2f6e0155aa2b0038' }
  }
);
```

---

## 📋 Формат Жалобы

```javascript
{
  "id": "Sqe3RgPnbpJMke3xi0bU",           // ID отзыва (используйте для markAsSent)
  "productId": "391988959",               // WB артикул
  "rating": 3,                            // Оценка 1-5
  "reviewDate": "2026-01-23T08:38:44.000Z",  // ISO 8601 → конвертируйте в DD.MM.YYYY
  "reviewText": "Не оверложен низ...",   // Текст отзыва
  "authorName": "Виктория",               // Имя автора
  "complaintText": "```json\n{...}\n```", // Парсите этот JSON
  "status": "draft"                       // Статус: draft, pending, sent
}
```

---

## 🔧 Необходимые Утилиты

### Парсинг complaintText

```javascript
function parseComplaintText(text) {
  const match = text.match(/```json\n(.*?)\n```/s);
  return match ? JSON.parse(match[1]) : null;
}

const parsed = parseComplaintText(complaint.complaintText);
// { reasonId: "11", reasonName: "...", complaintText: "..." }
```

### Конвертация Даты

```javascript
function formatDateForWB(isoDate) {
  const d = new Date(isoDate);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

formatDateForWB("2026-01-23T08:38:44.000Z"); // "23.01.2026"
```

---

## ✅ Полный Пример

```javascript
// 1. Получить жалобы
const response = await fetch(
  'http://158.160.217.236/api/stores/ss6Y8orHTX6vS7SgJl4k/complaints?take=10',
  { headers: { 'Authorization': 'Bearer d794d4408ef0955a693afaa913dd195ddd25f447e94d098c2f6e0155aa2b0038' }}
);
const complaints = await response.json();

// 2. Обработать каждую жалобу
for (const complaint of complaints) {
  // Парсим данные
  const parsed = parseComplaintText(complaint.complaintText);
  const wbDate = formatDateForWB(complaint.reviewDate);

  // Формируем для WB
  const wbData = {
    article: complaint.productId,
    date: wbDate,
    rating: complaint.rating,
    text: complaint.reviewText,
    author: complaint.authorName,
    reasonId: parsed.reasonId,
    complaintText: parsed.complaintText
  };

  // 3. Отправляем на WB (ваша логика)
  await submitToWB(wbData);

  // 4. Отмечаем как отправленную
  await fetch(
    `http://158.160.217.236/api/stores/ss6Y8orHTX6vS7SgJl4k/reviews/${complaint.id}/complaint/sent`,
    {
      method: 'POST',
      headers: { 'Authorization': 'Bearer d794d4408ef0955a693afaa913dd195ddd25f447e94d098c2f6e0155aa2b0038' }
    }
  );
}
```

---

## ⚠️ Важно Знать

1. **Rate Limit:** 100 запросов/минуту
2. **Формат Даты:** ISO 8601 → нужна конвертация в DD.MM.YYYY
3. **Идемпотентность:** POST /sent можно вызывать много раз
4. **Токен:** Храните в chrome.storage, не в коде!

---

## 📖 Полная Документация

Смотрите: **BACKEND_API_READY.md**

- Детальное описание всех endpoint'ов
- Обработка ошибок
- Примеры интеграции
- Архитектура клиента

---

**Готово! Начинайте интеграцию прямо сейчас** 🚀
