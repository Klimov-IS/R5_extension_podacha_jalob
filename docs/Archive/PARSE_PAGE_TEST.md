# Тест парсинга первой страницы WB

**Дата:** 2026-01-29
**Цель:** Извлечь ВСЮ доступную информацию из первых 10 отзывов на странице

---

## 📋 Команда для DevTools Console

**⚠️ ВАЖНО:** Запускать ТОЛЬКО после того, как расширение инжектировало скрипты (после Шага 3 из QUICK_TEST_GUIDE.md)

### Вариант 1: Подробная таблица с диагностикой

```javascript
(function() {
  console.log('=== 🔍 ПАРСИНГ ПЕРВОЙ СТРАНИЦЫ WB ===\n');

  // Находим таблицу
  const table = document.querySelector(".Base-table-body__F-y98zdE6m");
  if (!table) {
    console.error('❌ Таблица не найдена!');
    return;
  }

  const rows = Array.from(table.children).slice(0, 10);
  console.log(`Найдено строк: ${rows.length}\n`);

  const results = rows.map((row, index) => {
    // 1. Дата отзыва (WB формат)
    const dateContainer = row.querySelector('[class*="Col-date-time-with-readmark__date-with-marker"]');
    const dateSpan = dateContainer?.querySelector('span');
    const wbDateText = dateSpan?.textContent.trim() || 'НЕТ';

    // 2. Парсинг даты через DataExtractor
    let parsedDate = 'ERROR';
    let parsedISO = 'ERROR';
    try {
      parsedISO = window.DataExtractor.getReviewDate(row);
      parsedDate = new Date(parsedISO).toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      parsedDate = `ERROR: ${e.message}`;
    }

    // 3. Рейтинг
    let rating = 'НЕТ';
    try {
      rating = window.DataExtractor.getRating(row);
    } catch (e) {
      rating = `ERROR: ${e.message}`;
    }

    // 4. Артикул (из ссылки на товар)
    const productLink = row.querySelector('a[href*="/catalog/"]');
    let article = 'НЕТ';
    if (productLink) {
      const match = productLink.href.match(/\/catalog\/(\d+)\//);
      article = match ? match[1] : 'НЕТ в URL';
    }

    // 5. Текст отзыва
    const reviewTextEl = row.querySelector('[class*="Review-text__"]');
    const reviewText = reviewTextEl?.textContent.trim().substring(0, 50) || 'НЕТ';

    // 6. Имя автора
    const authorEl = row.querySelector('[class*="Review-author__"]');
    const author = authorEl?.textContent.trim() || 'НЕТ';

    // 7. Кнопка меню (троеточие)
    const menuBtn = row.querySelector('[class*="Col-more-button__"] button');
    const hasMenu = menuBtn ? 'ДА' : 'НЕТ';

    // 8. Временная разница
    let timeDiff = 'N/A';
    if (wbDateText !== 'НЕТ' && parsedISO !== 'ERROR') {
      const wbMatch = wbDateText.match(/(\d{2})\.(\d{2})\.(\d{4})\s+в\s+(\d{2}):(\d{2})/);
      if (wbMatch) {
        const wbHour = parseInt(wbMatch[4]);
        const parsedHour = new Date(parsedISO).getUTCHours();
        timeDiff = `${wbHour - parsedHour}ч`;
      }
    }

    return {
      '№': index + 1,
      'Артикул': article,
      'Рейтинг': rating,
      'WB Дата': wbDateText,
      'Parsed ISO': parsedISO,
      'Разница': timeDiff,
      'Автор': author,
      'Текст (50 симв)': reviewText,
      'Меню': hasMenu
    };
  });

  console.table(results);

  // Диагностика временной зоны
  console.log('\n=== ⏰ ДИАГНОСТИКА ВРЕМЕННОЙ ЗОНЫ ===');
  const sample = results[0];
  if (sample && sample['WB Дата'] !== 'НЕТ' && sample['Parsed ISO'] !== 'ERROR') {
    const wbMatch = sample['WB Дата'].match(/(\d{2})\.(\d{2})\.(\d{4})\s+в\s+(\d{2}):(\d{2})/);
    if (wbMatch) {
      const wbHour = parseInt(wbMatch[4]);
      const parsedDate = new Date(sample['Parsed ISO']);
      const parsedHourUTC = parsedDate.getUTCHours();
      const parsedHourMSK = new Date(sample['Parsed ISO']).toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        hour: '2-digit',
        hour12: false
      });

      console.log(`📍 WB показывает время: ${wbMatch[4]}:${wbMatch[5]} (MSK)`);
      console.log(`📍 Мы парсим как UTC: ${String(parsedHourUTC).padStart(2, '0')}:${wbMatch[5]}`);
      console.log(`📍 Если конвертировать обратно в MSK: ${parsedHourMSK}`);
      console.log(`\n⚠️ РАЗНИЦА: ${wbHour - parsedHourUTC} часа`);

      if (wbHour - parsedHourUTC === 3) {
        console.log('✅ Подтверждено: WB показывает время в MSK (UTC+3)');
        console.log('✅ Наш парсер создаёт UTC дату напрямую из MSK времени');
        console.log('✅ ФИКС: Нужно вычитать 3 часа при парсинге');
      }
    }
  }

  console.log('\n=== КОНЕЦ ПАРСИНГА ===');
})();
```

---

### Вариант 2: JSON формат с полными данными

```javascript
(function() {
  const table = document.querySelector(".Base-table-body__F-y98zdE6m");
  if (!table) {
    console.error('❌ Таблица не найдена');
    return;
  }

  const rows = Array.from(table.children).slice(0, 10);

  const reviews = rows.map((row, index) => {
    // Вся информация из строки
    const dateContainer = row.querySelector('[class*="Col-date-time-with-readmark__date-with-marker"]');
    const dateSpan = dateContainer?.querySelector('span');
    const wbDateText = dateSpan?.textContent.trim();

    const ratingContainer = row.querySelector('[class*="Rating__"]');
    const orangeStars = ratingContainer?.querySelectorAll('svg path[fill="#FF773C"], svg path[fill="#ff773c"]');

    const productLink = row.querySelector('a[href*="/catalog/"]');
    const articleMatch = productLink?.href.match(/\/catalog\/(\d+)\//);

    const reviewTextEl = row.querySelector('[class*="Review-text__"]');
    const authorEl = row.querySelector('[class*="Review-author__"]');

    const menuBtn = row.querySelector('[class*="Col-more-button__"] button');

    let parsedISO;
    try {
      parsedISO = window.DataExtractor.getReviewDate(row);
    } catch (e) {
      parsedISO = null;
    }

    return {
      index: index + 1,
      article: articleMatch ? articleMatch[1] : null,
      rating: orangeStars ? orangeStars.length : null,
      wbDateTime: wbDateText || null,
      parsedISO: parsedISO,
      reviewText: reviewTextEl?.textContent.trim() || null,
      author: authorEl?.textContent.trim() || null,
      hasMenuButton: !!menuBtn,
      rowClasses: row.className,
      // Создаём ключ как делает Backend
      backendKey: parsedISO && articleMatch ? `${articleMatch[1]}_${orangeStars?.length}_${parsedISO}` : null
    };
  });

  console.log('=== 📊 ОТЗЫВЫ (JSON) ===');
  console.log(JSON.stringify(reviews, null, 2));

  // Проверка временной зоны
  const first = reviews[0];
  if (first?.wbDateTime && first?.parsedISO) {
    const wbMatch = first.wbDateTime.match(/(\d{2})\.(\d{2})\.(\d{4})\s+в\s+(\d{2}):(\d{2})/);
    const parsedDate = new Date(first.parsedISO);

    console.log('\n=== ⏰ ВРЕМЕННАЯ ЗОНА ===');
    console.log('WB показывает:', first.wbDateTime);
    console.log('Мы парсим в ISO:', first.parsedISO);
    console.log('Разница часов:', parseInt(wbMatch[4]) - parsedDate.getUTCHours());
  }

  return reviews;
})();
```

---

### Вариант 3: Быстрый тест (только ключи)

```javascript
(function() {
  const table = document.querySelector(".Base-table-body__F-y98zdE6m");
  const rows = Array.from(table.children).slice(0, 10);

  console.log('=== 🔑 КЛЮЧИ ОТЗЫВОВ ===\n');

  rows.forEach((row, i) => {
    const productLink = row.querySelector('a[href*="/catalog/"]');
    const article = productLink?.href.match(/\/catalog\/(\d+)\//)?.[1];
    const rating = window.DataExtractor.getRating(row);
    const date = window.DataExtractor.getReviewDate(row);
    const key = window.DataExtractor.createReviewKey(article, rating, date);

    console.log(`${i + 1}. ${key}`);
  });

  console.log('\n=== КОНЕЦ ===');
})();
```

---

## 📋 Ожидаемый результат

### Таблица (Вариант 1):

```
=== 🔍 ПАРСИНГ ПЕРВОЙ СТРАНИЦЫ WB ===

Найдено строк: 10

┌─────────┬───────────┬─────────┬──────────────────────┬─────────────────────────┬─────────┬────────┬─────────────────────────────┬──────┐
│ (index) │  Артикул  │ Рейтинг │      WB Дата         │      Parsed ISO         │ Разница │ Автор  │    Текст (50 симв)          │ Меню │
├─────────┼───────────┼─────────┼──────────────────────┼─────────────────────────┼─────────┼────────┼─────────────────────────────┼──────┤
│    1    │'649502497'│    1    │'07.01.2026 в 23:09'  │'2026-01-07T23:09:00.000Z'│  '3ч'   │'Алина' │'Отличная пижама для...'     │ 'ДА' │
│    2    │'528735233'│    3    │'08.01.2026 в 14:22'  │'2026-01-08T14:22:00.000Z'│  '3ч'   │'Мария' │'Хороший товар, но размер...'│ 'ДА' │
└─────────┴───────────┴─────────┴──────────────────────┴─────────────────────────┴─────────┴────────┴─────────────────────────────┴──────┘

=== ⏰ ДИАГНОСТИКА ВРЕМЕННОЙ ЗОНЫ ===
📍 WB показывает время: 23:09 (MSK)
📍 Мы парсим как UTC: 23:09
📍 Если конвертировать обратно в MSK: 02:09

⚠️ РАЗНИЦА: 3 часа
✅ Подтверждено: WB показывает время в MSK (UTC+3)
✅ Наш парсер создаёт UTC дату напрямую из MSK времени
✅ ФИКС: Нужно вычитать 3 часа при парсинге
```

---

## 🎯 Что покажет тест

### Полезная информация:

1. **Артикулы** - числовые WB артикулы из URL
2. **Рейтинги** - количество оранжевых звезд (1-5)
3. **WB Дата** - как показывает WB на странице (MSK)
4. **Parsed ISO** - как мы парсим (НЕПРАВИЛЬНО, без учёта часового пояса)
5. **Разница** - разница в часах между WB временем и нашим парсингом
6. **Автор** - имя автора отзыва
7. **Текст** - первые 50 символов отзыва
8. **Меню** - есть ли кнопка троеточия

### Диагностика временной зоны:

- **WB показывает:** `23:09` (это MSK = UTC+3)
- **Мы парсим как:** `23:09 UTC` (ОШИБКА!)
- **Разница:** 3 часа

**Вывод:** Нужно вычитать 3 часа при создании UTC даты

---

## 🔧 Следующий шаг после теста

После того как увидите результаты и подтвердите проблему с часовым поясом:

**ФИКС в `src/contents/complaints/dom/data-extractor.js:43`:**

```javascript
// Было:
const date = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));

// Станет:
const date = new Date(Date.UTC(year, month, day, hours - 3, minutes, 0, 0));
```

Это конвертирует MSK (UTC+3) в UTC, и ключи будут совпадать с Backend API.

---

**Создано:** 2026-01-29
**Версия:** 1.0
**Статус:** ✅ READY FOR TESTING
