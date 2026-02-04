# 🧪 Команды для тестирования расширения

**Версия:** v2.0.1 (Webpack Bundle Optimization)
**Дата:** 30 января 2026

---

## 📋 **1. Проверка доступности модулей в консоли WB**

Откройте `https://seller.wildberries.ru/feedbacks` в Chrome
Откройте DevTools Console (F12)

### Тест 1: Проверка типов модулей

```javascript
console.log('=== Проверка модулей ===');
console.log('WBUtils:', typeof window.WBUtils);               // → 'object' ✅
console.log('DataExtractor:', typeof window.DataExtractor);   // → 'function' ✅
console.log('ElementFinder:', typeof window.ElementFinder);   // → 'function' ✅
console.log('SearchService:', typeof window.SearchService);   // → 'function' ✅
console.log('NavigationService:', typeof window.NavigationService); // → 'function' ✅
console.log('ProgressService:', typeof window.ProgressService);     // → 'function' ✅
console.log('ComplaintService:', typeof window.ComplaintService);   // → 'function' ✅
console.log('OptimizedHandler:', typeof window.OptimizedHandler);   // → 'function' ✅
```

**Ожидаемый результат:** Все модули должны быть 'object' или 'function' ✅

---

### Тест 2: Проверка методов WBUtils

```javascript
console.log('=== Проверка методов WBUtils ===');
console.log('sleep:', typeof window.WBUtils.sleep);           // → 'function' ✅
console.log('setNativeValue:', typeof window.WBUtils.setNativeValue); // → 'function' ✅
console.log('waitForElement:', typeof window.WBUtils.waitForElement); // → 'function' ✅
console.log('clearInput:', typeof window.WBUtils.clearInput); // → 'function' ✅
console.log('clickElement:', typeof window.WBUtils.clickElement); // → 'function' ✅
```

---

### Тест 3: Проверка методов DataExtractor

```javascript
console.log('=== Проверка методов DataExtractor ===');
console.log('getReviewDate:', typeof window.DataExtractor.getReviewDate); // → 'function' ✅
console.log('getRating:', typeof window.DataExtractor.getRating); // → 'function' ✅
console.log('createReviewKey:', typeof window.DataExtractor.createReviewKey); // → 'function' ✅
console.log('getReviewKey:', typeof window.DataExtractor.getReviewKey); // → 'function' ✅
console.log('extractReviewData:', typeof window.DataExtractor.extractReviewData); // → 'function' ✅
```

---

### Тест 4: Проверка работы sleep (асинхронный тест)

```javascript
console.log('=== Тест функции sleep ===');
console.time('sleep-test');
await window.WBUtils.sleep(1000);
console.timeEnd('sleep-test');
console.log('✅ Sleep 1 секунда прошла успешно');
```

**Ожидаемый результат:** `sleep-test: ~1000ms` ✅

---

### Тест 5: Проверка логов загрузки bundle

```javascript
console.log('=== Поиск логов bundle ===');
// Прокрутите консоль вверх и найдите логи:
// [Complaints] 🔵 content.js начал загрузку в ISOLATED world
// [Complaints] 📦 Инжектим bundle в MAIN world...
// [MainWorldBundle] 🚀 Начинаем загрузку модулей в MAIN world...
// [WBUtils] Утилиты успешно загружены
// [DataExtractor] Модуль успешно загружен
// [ElementFinder] Модуль успешно загружен
// [SearchService] Модуль успешно загружен
// [NavigationService] Модуль успешно загружен
// [ProgressService] Модуль успешно загружен
// [ComplaintService] Модуль успешно загружен
// [OptimizedHandler] Модуль успешно загружен
// [MainWorldBundle] ✅ Все модули загружены в MAIN world
// [MainWorldBundle] 📡 Событие wb-content-bundle-ready отправлено
// [Complaints] ✅ Bundle готов в MAIN world
// [Complaints] ✅ Bundle успешно загружен. Модули: WBUtils, DataExtractor, ...
// [Complaints] ✅ Message listener успешно зарегистрирован
// [Complaints] ✅ Content script полностью инициализирован
```

---

## 📊 **2. Проверка размера и времени загрузки bundle**

### Шаг 1: Откройте Network tab
1. Откройте DevTools → вкладка **Network**
2. Обновите страницу WB (F5)

### Шаг 2: Найдите bundle в списке
1. В фильтре поиска введите: `content-main-world`
2. Найдите файл: **content-main-world.bundle.js**

### Шаг 3: Проверьте метрики
```
Файл: content-main-world.bundle.js
├── Size: ~37.1 KB ✅
├── Time: < 100ms ✅
└── Status: 200 OK ✅
```

**Что проверяем:**
- ✅ Размер bundle ~37 KB (минифицирован)
- ✅ Время загрузки < 100ms (быстрая загрузка)
- ✅ HTTP статус 200 (успешно загружен)

---

## 🚀 **3. Тест полного workflow (подача жалоб)**

### Шаг 1: Подготовка
1. Откройте `https://seller.wildberries.ru/feedbacks/feedbacks-tab/answered`
2. Убедитесь что страница полностью загружена
3. Откройте DevTools Console (F12)

### Шаг 2: Открыть страницу подачи жалоб
1. Кликните иконку расширения в Chrome
2. Нажмите **"Пожаловаться на отзывы"**
3. Откроется страница `complaints-page.html`

### Шаг 3: Настроить фильтры
1. Выберите магазин из выпадающего списка
2. Выберите рейтинг (1-5 звёзд)
3. (Опционально) Укажите артикулы

### Шаг 4: Запустить обработку
1. Нажмите **"Начать обработку жалоб"**
2. Переключитесь на вкладку WB
3. Следите за логами в консоли

### Ожидаемые логи в консоли WB:

```javascript
[OptimizedHandler] 🎯 Получен запрос на обработку отфильтрованных жалоб
[OptimizedHandler] 📦 Получено X жалоб для обработки
[OptimizedHandler] ⭐ Фильтр по звездам: 1, 2
[OptimizedHandler] Поле поиска найдено: Да

[SearchService] 🔍 Сканируем страницу...
[SearchService] ✅ Отзыв найден на странице!

[ComplaintService] 📝 Начинаем подачу жалобы...
[ComplaintService] ✅ Меню открыто
[ComplaintService] ✅ Dropdown найден
[ComplaintService] ✅ Кнопка "Пожаловаться" найдена и нажата
[ComplaintService] ✅ Модальное окно жалобы открыто
[ComplaintService] ✅ Форма заполнена
[ComplaintService] 🧪 TEST_MODE: Пропускаем отправку
[ComplaintService] ✅ Жалоба успешно подана (TEST_MODE)

[ProgressService] 📊 Прогресс: 1/10 обработано
```

### Шаг 5: Проверка результатов
1. На странице `complaints-page.html` должна обновляться статистика
2. Логи должны показывать прогресс
3. После завершения должен показаться финальный отчёт

---

## ✅ **Чеклист успешного тестирования**

### Тест 1: Модули доступны ✅
- [x] `window.WBUtils` - 'object'
- [x] `window.DataExtractor` - 'function'
- [x] `window.OptimizedHandler` - 'function'
- [x] Все методы доступны

### Тест 2: Bundle оптимизирован ✅
- [x] Размер bundle ~37 KB
- [x] Время загрузки < 100ms
- [x] HTTP статус 200

### Тест 3: Workflow работает ✅
- [x] Страница подачи жалоб открывается
- [x] Content script отвечает на ping
- [x] OptimizedHandler запускается
- [x] SearchService находит отзывы
- [x] ComplaintService подаёт жалобы (TEST_MODE)
- [x] Прогресс отображается корректно

---

## 🐛 **Troubleshooting**

### Проблема: Модули 'undefined'

**Решение:**
```bash
# 1. Пересобрать bundle
npm run build

# 2. Проверить что файл создан
ls dist/content-main-world.bundle.js

# 3. Перезагрузить расширение
# chrome://extensions → кнопка Reload

# 4. Обновить страницу WB
# F5

# 5. Проверить логи
# Должны быть логи: [MainWorldBundle] ✅ Все модули загружены
```

---

### Проблема: Bundle не загружается

**Проверка:**
```javascript
// В консоли WB:
console.log('Bundle URL:', chrome.runtime.getURL('dist/content-main-world.bundle.js'));
```

**Решение:**
1. Проверьте что `dist/content-main-world.bundle.js` существует
2. Проверьте `manifest.json` - должен быть `web_accessible_resources`
3. Перезагрузите расширение

---

### Проблема: Content script не отвечает

**Решение:**
1. Откройте страницу WB: `seller.wildberries.ru/feedbacks`
2. Проверьте логи: `[Complaints] ✅ Content script полностью инициализирован`
3. Если логов нет - перезагрузите страницу (F5)
4. Если всё равно нет - перезагрузите расширение

---

## 📝 **Примечания**

- ✅ TEST_MODE по умолчанию = `true` (жалобы не отправляются)
- ✅ Для продакшена измените в `complaint-service.js:21` на `false`
- ✅ Bundle пересобирается автоматически при `npm run build:dev` (watch mode)
- ✅ Всегда запускайте `npm run build` перед тестированием production версии

---

**Сделано с ❤️ для автоматизации работы с Wildberries**
