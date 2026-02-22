# TASK: Параллельное открытие чатов

**Дата:** 2026-02-22
**Статус:** В работе
**Базовый коммит:** `509a7ef` (feat: centralize blocking statuses, detect transparent stars)

---

## Проблема

Чаты открываются строго последовательно. Каждый чат занимает 20-35 секунд:

```
Клик → ожидание window.open (5-15с) → обработка вкладки background (15-25с) → cooldown (10с)
```

При тысячах чатов в неделю это неприемлемо медленно (~3 чата/минуту).

### Дополнительная проблема

Иконки кнопок чата рендерятся на 2-3 секунды позже остальной таблицы. `_waitForTableReady()` не ждёт их появления, что может приводить к неверному определению `chatStatus`.

---

## Текущая архитектура (до изменений)

### Последовательный flow на каждый чат

```
MAIN world (ChatService.openChat):
  1. Monkey-patch window.open → одна переменная capturedUrl
  2. Клик по кнопке чата в строке отзыва
  3. Поллинг 500ms для capturedUrl (макс 25с)
  4. WB вызывает window.open(chatUrl) → перехват URL
  5. Dispatch wb-create-tab → background создаёт вкладку (fire-and-forget)
  6. _requestChatProcessing() → AWAIT ответа (60с таймаут)

ISOLATED world (content.js bridge):
  - wb-create-tab → chrome.runtime.sendMessage({type: 'createTab'}) → tabId НЕ возвращается
  - wb-chat-request → chrome.runtime.sendMessage({type: 'processChatTab'}) → await response

Background (ChatHandler.processChatTab):
  1. _findChatTab(25с) — поллинг chrome.tabs.query, берёт НОВЕЙШУЮ вкладку
  2. Ожидание tab.status=complete (15с)
  3. Sleep 6с — рендеринг WB JS
  4. POST /chat/opened → chatRecordId
  5. executeScript для парсинга якоря (с retry)
  6. POST /chat/{id}/anchor
  7. Закрытие вкладки

OptimizedHandler (runTaskWorkflow):
  - for...of цикл по строкам
  - await chatService.openChat() ← БЛОКИРУЕТ
  - await sleep(max(cooldown, 10000)) ← 10с минимум
```

### Race conditions, блокирующие параллелизм

1. **Одна переменная `capturedUrl`** — второй window.open перезаписывает первый
2. **`_findChatTab` берёт новейшую вкладку** — при N вызовах processChatTab все найдут одну
3. **`wb-create-tab` fire-and-forget** — tabId не возвращается в MAIN world

---

## Решение: Двухфазный подход

### Фаза 0 (Предпосылка): Direct tabId passing

**Цель:** Устранить race condition — передавать tabId напрямую вместо поллинга.

**Файлы:**
- `src/contents/complaints/content.js` — relay tabId через wb-create-tab-response
- `src/contents/complaints/services/chat-service.js` — correlationId, получение tabId
- `src/background/handlers/chat-handler.js` — принимать tabId, пропускать _findChatTab

**Суть:**
```
MAIN world: click → window.open intercepted → wb-create-tab {url, correlationId}
ISOLATED:   createTab → получить tabId → wb-create-tab-response {correlationId, tabId}
MAIN world: получить tabId → wb-chat-request {tabId, reviewData}
Background: processChatTab({tabId}) → chrome.tabs.get(tabId) — БЕЗ поллинга
```

### Фаза 1: Pipeline (последовательные клики, параллельная обработка)

**Цель:** Background обработка чатов идёт параллельно пока MAIN world кликает следующие кнопки.

**Файлы:**
- `src/contents/complaints/services/chat-service.js` — clickAndCapture(), processCaptured()
- `src/contents/complaints/handlers/optimized-handler.js` — pipeline loop

**Новый flow:**
```
Клик 1 → capture URL1 → fire background (НЕ await) → 3с пауза
Клик 2 → capture URL2 → fire background (НЕ await) → 3с пауза
Клик 3 → capture URL3 → fire background (НЕ await)
... все клики завершены ...
Promise.allSettled(bg1, bg2, bg3) → собрать результаты
```

**Тайминг:**
| Кол-во чатов | Текущий (последовательный) | Pipeline | Ускорение |
|---|---|---|---|
| 3 | ~105с | 61с | 1.7x |
| 5 | ~175с | 85с | 2.1x |
| 10 | ~350с | 145с | 2.4x |

### Фаза 2 (будущее): Batch clicking (5-10 одновременных)

**Цель:** Кликать кнопки БЕЗ ожидания window.open, все API вызовы WB параллельно.

**Суть:**
- Queue-based window.open interceptor (массив вместо одной переменной)
- Быстрые клики (1-2с между ними)
- Все window.open вызовы от WB приходят параллельно
- Все вкладки обрабатываются одновременно

**Тайминг:**
| Кол-во чатов | Pipeline (Фаза 1) | Batch (Фаза 2) | Ускорение |
|---|---|---|---|
| 5 | 85с | ~48с | 3.7x от текущего |
| 10 | 145с | ~55с | 6.4x от текущего |

**Риски Фазы 2:**
- WB может сериализовать chat creation API (кнопки disabled после первого клика?)
- Нет корреляции между кликом и window.open (решается через nmId из якоря или URL парсинг)
- Требует стабильности Фазы 1 как основы

---

## Дополнительный фикс: ожидание иконок чатов

**Файл:** `src/contents/complaints/handlers/optimized-handler.js`

Добавить `requireChatButtons` опцию в `_waitForTableReady()`:
- Проверять наличие SVG кнопки чата в первой строке таблицы
- Использовать при наличии задач на чаты

---

## Конфигурация

Новые параметры в `selectors.catalog.js`:

```js
const CHAT_PARALLEL = {
  maxConcurrent: 5,          // Макс одновременных фоновых обработок
  clickIntervalMs: 3000,     // Пауза между кликами (Фаза 1)
  urlCaptureTimeoutMs: 25000 // Таймаут на перехват window.open
};
```

---

## Файлы для изменения

| Файл | Фаза | Изменения |
|------|------|-----------|
| `src/contents/complaints/content.js` | 0 | wb-create-tab-response relay, tabId forwarding |
| `src/contents/complaints/services/chat-service.js` | 0+1 | correlationId, tabId capture, clickAndCapture(), processCaptured() |
| `src/background/handlers/chat-handler.js` | 0 | Принимать tabId, пропускать _findChatTab |
| `src/contents/complaints/handlers/optimized-handler.js` | 1 | Pipeline loop, _waitForTableReady fix |
| `src/contents/complaints/dom/selectors.catalog.js` | 1 | CHAT_PARALLEL config |
| `docs/DOM_CONTRACT.md` | 1 | Документация flow |
| `docs/UI_CHANGELOG.md` | 1 | Changelog entry |

---

## Git коммиты (план)

1. `feat(chat): pass tabId directly from createTab to processChatTab`
2. `feat(chat): pipeline chat opening — sequential clicks, parallel background`
3. `fix(ui): wait for chat button SVG render in _waitForTableReady`
4. `docs(chat): document parallel chat architecture`
