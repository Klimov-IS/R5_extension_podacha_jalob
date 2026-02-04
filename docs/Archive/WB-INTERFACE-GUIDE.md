# Wildberries Seller Portal - Руководство по интерфейсу для разработчиков

> **Версия:** 1.0.0
> **Дата обновления:** 31.01.2026
> **Проверено на:** seller.wildberries.ru/feedbacks

---

## Оглавление

1. [Обзор страницы отзывов](#1-обзор-страницы-отзывов)
2. [Поиск по артикулу](#2-поиск-по-артикулу)
3. [Таблица отзывов](#3-таблица-отзывов)
4. [Пагинация](#4-пагинация)
5. [Меню действий (троеточие)](#5-меню-действий-троеточие)
6. [Модальное окно жалобы](#6-модальное-окно-жалобы)
7. [Парсинг данных отзыва](#7-парсинг-данных-отзыва)
8. [Работающие паттерны для React](#8-работающие-паттерны-для-react)
9. [Тайминги и задержки](#9-тайминги-и-задержки)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Обзор страницы отзывов

### URL
```
https://seller.wildberries.ru/feedbacks-questions/feedbacks
```

### Технологический стек WB
- **Framework:** React (современная версия)
- **CSS:** CSS Modules с хэшированными классами
- **State Management:** Redux или аналог
- **API:** REST API с lazy loading

### Важные особенности
- Все классы CSS хэшированы (например: `Simple-input__field__u7tzNYrd2b`)
- React управляет состоянием input-ов (нужны специальные паттерны для ввода)
- Данные загружаются асинхронно через API
- Таблица использует виртуализацию (100 строк на страницу)

---

## 2. Поиск по артикулу

### Селекторы поля поиска

```javascript
// Способ 1: По placeholder (РЕКОМЕНДУЕТСЯ)
input[placeholder*="Поиск"]
input[placeholder*="Артикулам WB"]

// Способ 2: По type
input[type="search"]

// Способ 3: По name
input[name="feedback-search-name-input"]

// Способ 4: По классу (НЕ надёжно - хэш меняется)
input[class*="Simple-input__field"]
```

### Рабочий паттерн ввода текста

**КРИТИЧНО:** WB использует React, обычный `input.value = "..."` НЕ работает!

```javascript
async function searchByArticle(productId) {
  const input = document.querySelector('input[placeholder*="Поиск"]');

  // 1. ОБЯЗАТЕЛЬНО: Фокус на элемент ПЕРЕД вводом
  input.focus();

  // 2. Очистка поля
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;
  setter.call(input, '');
  input.dispatchEvent(new Event('input', { bubbles: true }));

  await sleep(300);

  // 3. Ввод артикула через prototype setter
  setter.call(input, productId);
  input.dispatchEvent(new Event('input', { bubbles: true }));

  // 4. ОБЯЗАТЕЛЬНО: Нажатие Enter для активации поиска
  input.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true
  }));

  // 5. Ожидание загрузки результатов (5 секунд минимум!)
  await sleep(5000);
}
```

### Что НЕ работает
```javascript
// ❌ Не работает - React не видит изменение
input.value = "123456";

// ❌ Не работает - без focus() React может игнорировать
setter.call(input, "123456");

// ❌ Не работает - без Enter поиск не активируется
input.dispatchEvent(new Event('input', { bubbles: true }));
```

---

## 3. Таблица отзывов

### Селекторы таблицы

```javascript
// Контейнер таблицы
const table = document.querySelector('.Base-table-body__F-y98zdE6m');

// Все строки отзывов
const rows = document.querySelectorAll('[class*="Base-table-body"] > [class*="table-row"]');

// Альтернативный селектор строк
const rows = table.children; // HTMLCollection
```

### Структура строки отзыва

```
<div class="table-row__...">
  ├── [Checkbox колонка]
  ├── [Дата и время]
  │   └── <span data-name="Text">31.01.2026 в 21:47</span>
  ├── [Рейтинг]
  │   └── <div class="Rating__...">
  │       └── <svg> × 5 (звёзды)
  ├── [Артикул/Товар]
  ├── [Текст отзыва]
  │   └── <span data-name="Text">Текст отзыва...</span>
  └── [Кнопка меню (...)]
      └── <button class="button__...">
          └── <svg viewBox="0 -10 24 24">
</div>
```

### Количество строк на странице
- **Стандартно:** 100 строк на страницу
- **С фильтром:** зависит от количества результатов

---

## 4. Пагинация

> **Обновлено:** 01.02.2026
> **HTML образец:** `docs/HTML/Пагинация.html`

### Селектор кнопок пагинации

```javascript
// Контейнер пагинации
const wrapper = document.querySelector('[class*="Token-pagination__arrows-wrapper"]');

// Все кнопки пагинации (4 штуки)
const paginationButtons = document.querySelectorAll('[class*="Token-pagination__arrow"]');
```

### Порядок кнопок (ВАЖНО! Обновлено 01.02.2026)

```
Индекс | Кнопка              | Описание
-------|---------------------|---------------------------
[0]    | ◀◀ В начало         | Первая страница
[1]    | ◀ Предыдущая        | Предыдущая страница
[2]    | ▶ Следующая         | СЛЕДУЮЩАЯ СТРАНИЦА ← ИНДЕКС 2!
[3]    | ▶▶ В конец          | Последняя страница
```

**ВНИМАНИЕ:** Ранее была ошибка - указан индекс [3]. Правильный индекс кнопки "Следующая" = **[2]**!

### HTML структура (февраль 2026)

```html
<div class="Token-pagination__arrows-wrapper__...">
  <button class="Token-pagination__arrow__..." disabled><<</button>  <!-- [0] В начало -->
  <button class="Token-pagination__arrow__..." disabled><</button>   <!-- [1] Предыдущая -->
  <button class="Token-pagination__arrow__..." type="button">></button>  <!-- [2] СЛЕДУЮЩАЯ -->
  <button class="Token-pagination__arrow__..." type="button">>></button> <!-- [3] В конец -->
</div>
```

### Код для перехода на следующую страницу

```javascript
async function goToNextPage() {
  const buttons = document.querySelectorAll('[class*="Token-pagination__arrow"]');

  // Кнопка "Следующая" на индексе [2] (НЕ [3]!)
  const nextButton = buttons[2];

  if (!nextButton || nextButton.disabled) {
    console.log('Достигнута последняя страница');
    return false;
  }

  // Запоминаем дату первой строки ДО клика
  const firstRowDateBefore = getFirstRowDate();

  // Клик
  nextButton.click();

  // Ожидание загрузки (4 секунды минимум!)
  await sleep(4000);

  // Проверка: изменилась ли дата первой строки?
  const firstRowDateAfter = getFirstRowDate();

  return firstRowDateBefore !== firstRowDateAfter;
}
```

### Альтернативный селектор (CSS nth-child)

```javascript
// Третий ребёнок (nth-child считает с 1, не с 0)
const nextButton = document.querySelector(
  'button[class*="Token-pagination__arrow"]:nth-child(3):not([disabled])'
);
```

### Проверка состояния кнопки

```javascript
function canGoToNextPage(button) {
  return button && !button.disabled && !button.hasAttribute('disabled');
}
```

---

## 5. Меню действий (троеточие)

### Селектор кнопки меню (троеточие)

```javascript
// Способ 1: По viewBox SVG (НАДЁЖНЫЙ)
function findMenuButton(row) {
  const svgs = row.querySelectorAll('svg');
  for (const svg of svgs) {
    const viewBox = svg.getAttribute('viewBox');
    // Троеточие имеет специфичный viewBox с -10
    if (viewBox && viewBox.includes('-10')) {
      return svg.closest('button');
    }
  }
  return null;
}

// Способ 2: По классу (менее надёжный)
const menuButton = row.querySelector('button[class*="onlyIcon"]');
```

### Открытие dropdown меню

```javascript
async function openDropdown(menuButton) {
  // Используем усиленный клик для React
  menuButton.scrollIntoView({ behavior: 'instant', block: 'center' });
  await sleep(100);

  menuButton.focus();

  // Отправляем PointerEvents + MouseEvents
  const rect = menuButton.getBoundingClientRect();
  const options = {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };

  menuButton.dispatchEvent(new PointerEvent('pointerdown', options));
  menuButton.dispatchEvent(new PointerEvent('pointerup', options));
  menuButton.dispatchEvent(new MouseEvent('click', options));
  menuButton.click();

  await sleep(500);
}
```

### Селектор открытого dropdown

```javascript
// Dropdown появляется как портал в body
const dropdown = document.querySelector('[class*="Dropdown-list__item"]')?.closest('[class*="Dropdown"]');
```

### Кнопка "Пожаловаться на отзыв"

```javascript
function findComplaintButton() {
  // Ищем по тексту кнопки
  const items = document.querySelectorAll('[class*="Dropdown-list__item"]');

  for (const item of items) {
    const text = item.textContent.trim();
    if (text.includes('Пожаловаться')) {
      return item;
    }
  }

  return null;
}
```

---

## 6. Модальное окно жалобы

### Селектор модального окна

```javascript
// По классу формы жалобы
const modal = document.querySelector('[class*="Complaint-form"]');

// Альтернативно: по заголовку
const modalByTitle = [...document.querySelectorAll('h2, h3')]
  .find(h => h.textContent.includes('Пожаловаться'))
  ?.closest('[class*="modal"], [class*="Modal"]');
```

### Структура модального окна

```
<div class="Complaint-form__...">
  ├── <h2>Пожаловаться на отзыв</h2>
  ├── [Radio buttons категорий]
  │   ├── <input type="radio" id="..." name="complaintType">
  │   ├── <label for="...">Отзыв оставили конкуренты</label>
  │   └── ...
  ├── [Текстовое поле] (появляется ПОСЛЕ выбора категории!)
  │   └── <textarea id="explanation">
  └── [Кнопки]
      ├── <button>Отправить</button>
      └── <button>Отмена</button>
</div>
```

### Категории жалоб (radio buttons)

```javascript
const radioButtons = modal.querySelectorAll('input[type="radio"]');

// Выбор категории
async function selectCategory(modal, index = 0) {
  const radios = modal.querySelectorAll('input[type="radio"]');
  const radio = radios[index];
  const label = modal.querySelector(`label[for="${radio.id}"]`);

  // Кликаем по label (надёжнее для React)
  (label || radio).click();

  // ВАЖНО: textarea появляется ТОЛЬКО после выбора категории!
  await sleep(500);
}
```

### Текстовое поле жалобы

```javascript
// Появляется ПОСЛЕ выбора категории!
const textarea = modal.querySelector('textarea#explanation');
// или
const textarea = modal.querySelector('textarea');

// Ввод текста (используем prototype setter)
function setTextareaValue(textarea, text) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  ).set;
  setter.call(textarea, text);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}
```

### Кнопка "Отправить"

```javascript
function findSubmitButton() {
  // Способ 1: В контейнере кнопок формы
  const buttonsContainer = document.querySelector('[class*="Complaint-form__buttons"]');
  if (buttonsContainer) {
    const buttons = buttonsContainer.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent.includes('Отправить')) {
        return btn;
      }
    }
  }

  // Способ 2: По тексту во всём модальном окне
  const modal = document.querySelector('[class*="Complaint-form"]');
  const allButtons = modal?.querySelectorAll('button');
  return [...(allButtons || [])].find(b => b.textContent.includes('Отправить'));
}
```

### Закрытие модального окна

```javascript
async function closeModal(modal) {
  // Способ 1: Кнопка закрытия
  const closeBtn = modal.querySelector('[class*="close"]') ||
                   modal.querySelector('button[aria-label*="Закр"]');
  if (closeBtn) {
    closeBtn.click();
    return;
  }

  // Способ 2: Клик по overlay
  const overlay = document.querySelector('[class*="overlay"]');
  if (overlay) {
    overlay.click();
    return;
  }

  // Способ 3: ESC
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}
```

---

## 7. Парсинг данных отзыва

### Извлечение даты и времени

```javascript
function getReviewDate(row) {
  // Ищем контейнер даты
  const dateContainer = row.querySelector('[class*="Col-date-time-with-readmark"]');
  if (!dateContainer) return null;

  // Ищем span с data-name="Text" содержащий дату
  const textSpans = dateContainer.querySelectorAll('span[data-name="Text"]');

  // Паттерн: "31.01.2026 в 21:47"
  const dateTimePattern = /(\d{2})\.(\d{2})\.(\d{4})\s+в\s+(\d{2}):(\d{2})/;

  for (const span of textSpans) {
    const match = span.textContent.match(dateTimePattern);
    if (match) {
      const [_, day, month, year, hours, minutes] = match;
      // Возвращаем ISO 8601
      return new Date(year, month - 1, day, hours, minutes).toISOString();
    }
  }

  return null;
}
```

### Извлечение рейтинга (звёзды)

```javascript
function getRating(row) {
  const ratingContainer = row.querySelector('[class*="Rating__"]');
  if (!ratingContainer) return null;

  // Способ 1: По классу active
  const activeStars = ratingContainer.querySelectorAll('[class*="active"]');
  if (activeStars.length > 0) {
    return activeStars.length;
  }

  // Способ 2: Подсчёт оранжевых звёзд (fill="#FF773C")
  const svgs = ratingContainer.querySelectorAll('svg');
  let orangeCount = 0;

  for (const svg of svgs) {
    const orangePath = svg.querySelector('path[fill="#FF773C"], path[fill="#ff773c"]');
    if (orangePath) orangeCount++;
  }

  return orangeCount >= 1 && orangeCount <= 5 ? orangeCount : null;
}
```

### Извлечение текста отзыва

```javascript
function getReviewText(row) {
  const textSpans = row.querySelectorAll('span[data-name="Text"]');

  // Исключаем дату и служебные тексты
  const datePattern = /\d{2}\.\d{2}\.\d{4}\s+в\s+\d{2}:\d{2}/;

  for (const span of textSpans) {
    const text = span.textContent.trim();

    // Пропускаем дату
    if (datePattern.test(text)) continue;
    // Пропускаем короткие тексты
    if (text.length < 10) continue;
    // Пропускаем служебные надписи
    if (text.includes('Оставить ответ')) continue;
    if (text.includes('Отзыв оставили конкуренты')) continue;

    return text;
  }

  return null;
}
```

### Полное извлечение данных

```javascript
function extractReviewData(row, articleId) {
  return {
    productId: articleId,
    rating: getRating(row),
    reviewDate: getReviewDate(row),  // ISO 8601
    text: getReviewText(row),
    key: `${articleId}_${getRating(row)}_${getReviewDate(row)}`
  };
}
```

---

## 8. Работающие паттерны для React

### Ввод в input (универсальный)

```javascript
function setInputValue(input, value) {
  // 1. Фокус обязателен
  input.focus();

  // 2. Используем prototype setter
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;
  setter.call(input, value);

  // 3. Диспатчим событие
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
```

### Ввод в textarea

```javascript
function setTextareaValue(textarea, value) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  ).set;
  setter.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}
```

### Усиленный клик для React кнопок

```javascript
async function clickReactButton(element) {
  element.scrollIntoView({ behavior: 'instant', block: 'center' });
  await sleep(100);

  const rect = element.getBoundingClientRect();
  const options = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };

  element.focus();

  // PointerEvents (современный React)
  element.dispatchEvent(new PointerEvent('pointerdown', options));
  element.dispatchEvent(new PointerEvent('pointerup', options));

  // MouseEvents (fallback)
  element.dispatchEvent(new MouseEvent('mousedown', options));
  element.dispatchEvent(new MouseEvent('mouseup', options));
  element.dispatchEvent(new MouseEvent('click', options));

  // Нативный клик
  element.click();
}
```

### Отправка Enter

```javascript
function sendEnterKey(element) {
  element.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true
  }));

  element.dispatchEvent(new KeyboardEvent('keyup', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true
  }));
}
```

---

## 9. Тайминги и задержки

### Рекомендуемые задержки

| Операция | Минимум | Рекомендуется | Примечание |
|----------|---------|---------------|------------|
| После поиска (Enter) | 3000ms | **5000ms** | API WB медленный |
| После клика пагинации | 2000ms | **4000ms** | Загрузка новых данных |
| После открытия dropdown | 300ms | **500ms** | Анимация React |
| После клика "Пожаловаться" | 500ms | **800ms** | Открытие модального окна |
| После выбора категории | 300ms | **500ms** | Появление textarea |
| Между действиями (общий) | 100ms | **200ms** | Стабильность |

### Функция sleep

```javascript
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## 10. Troubleshooting

### Поиск не работает

**Симптом:** Артикул введён, но таблица не фильтруется

**Решение:**
1. Убедитесь что вызван `input.focus()` ПЕРЕД вводом
2. Используйте prototype setter, не прямое присвоение
3. Обязательно отправьте Enter после ввода
4. Увеличьте задержку после Enter до 5-7 секунд

### Пагинация не переключает страницу

**Симптом:** Клик выполнен, но данные не изменились

**Решение:**
1. Проверьте что используете кнопку с индексом [3], а не [2]
2. Убедитесь что кнопка не disabled
3. Увеличьте задержку после клика до 4-5 секунд
4. Проверяйте изменение по дате первой строки, а не по количеству строк

### Dropdown не открывается

**Симптом:** Клик по троеточию не показывает меню

**Решение:**
1. Используйте усиленный клик (PointerEvents + MouseEvents)
2. Убедитесь что элемент в viewport (scrollIntoView)
3. Вызовите focus() перед кликом
4. Увеличьте задержку до 500-700ms

### Модальное окно не находится

**Симптом:** Модальное окно открылось визуально, но селектор не находит

**Решение:**
1. Модальное окно может рендериться как React Portal в конце body
2. Используйте селектор `[class*="Complaint-form"]` вместо поиска внутри dropdown
3. Добавьте задержку 800ms после клика "Пожаловаться"

### Textarea не появляется

**Симптом:** После выбора категории textarea не найден

**Решение:**
1. Textarea появляется ТОЛЬКО после выбора категории (radio button)
2. Добавьте задержку 500ms после клика по категории
3. Ищите по `textarea` без указания id (id может отсутствовать)

---

## Связанные файлы в проекте

| Файл | Описание |
|------|----------|
| `src/contents/complaints/utils.js` | Базовые утилиты (sleep, click, setNativeValue) |
| `src/contents/complaints/dom/element-finder.js` | Поиск элементов WB |
| `src/contents/complaints/dom/data-extractor.js` | Парсинг данных отзывов |
| `src/contents/complaints/services/navigation-service.js` | Поиск и пагинация |
| `src/contents/complaints/services/complaint-service.js` | Работа с формой жалобы |
| `src/contents/complaints/handlers/optimized-handler.js` | Основной обработчик |

---

## История изменений

| Дата | Изменение |
|------|-----------|
| 31.01.2026 | Создание документации |
| 31.01.2026 | Исправлен индекс кнопки пагинации: [2] → [3] |
| 31.01.2026 | Добавлен focus() перед вводом в input |
| 31.01.2026 | Увеличены тайминги для стабильности |
