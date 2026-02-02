# 🚀 Multi-Store Integration Plan - Frontend Implementation

**Дата:** 28 января 2026
**Backend Status:** ✅ Production Ready
**Frontend Status:** 📋 Ready to Start
**Estimated Time:** 7.5 hours (1 рабочий день)
**Priority:** High

---

## 📋 Executive Summary

После успешного деплоя нового backend endpoint `/api/extension/stores`, необходимо интегрировать multi-store функционал в Chrome Extension.

**Цель:** Пользователь может переключаться между магазинами через dropdown, без ручного ввода Store ID.

**Что будет реализовано:**
1. ✅ Загрузка списка магазинов из backend
2. ✅ Dropdown для выбора магазина в complaints-page.html
3. ✅ Автоматическое сохранение выбора пользователя
4. ✅ Кеширование списка магазинов (5 минут)
5. ✅ Обработка неактивных магазинов (disabled в UI)
6. ✅ Error handling (401, 429)

---

## 🎯 Phases Overview

| Phase | Description | Time | Files Modified | Status |
|-------|-------------|------|----------------|--------|
| **Phase 1** | UI Updates | 2h | complaints-page.html, complaints-page.js | ⏳ Pending |
| **Phase 2** | Settings Management | 2h | settings-service.js, options.js | ⏳ Pending |
| **Phase 3** | Store Manager Service | 2h | store-manager.js (new) | ⏳ Pending |
| **Phase 4** | Testing & QA | 1h | All files | ⏳ Pending |
| **Phase 5** | Documentation | 0.5h | README.md, TESTING_INSTRUCTIONS.md | ⏳ Pending |

**Total:** 7.5 hours

---

## 📦 Phase 1: UI Updates (2 hours)

### Цель
Обновить complaints-page для загрузки и отображения списка магазинов из backend.

### Files to Modify

#### 1. `complaints-page.html`

**Current State:**
```html
<div class="form-group">
  <label for="store-select">Выберите магазин:</label>
  <select id="store-select">
    <option value="">Загрузка магазинов...</option>
  </select>
</div>
```

**Changes Needed:**
```html
<div class="form-group">
  <label for="store-select">Выберите магазин:</label>
  <select id="store-select">
    <option value="">Загрузка магазинов...</option>
  </select>
  <button type="button" id="refresh-stores-btn" class="secondary-btn" style="margin-left: 10px;">
    🔄 Обновить
  </button>
  <small style="display: block; color: #666; font-size: 12px; margin-top: 5px;">
    💡 Выберите магазин для работы. Неактивные магазины отображаются серым.
  </small>
  <div id="store-load-error" style="color: red; font-size: 12px; margin-top: 5px; display: none;"></div>
</div>
```

**Новые элементы:**
- `#refresh-stores-btn` — кнопка принудительного обновления списка
- `<small>` — подсказка для пользователя
- `#store-load-error` — блок для отображения ошибок

---

#### 2. `src/complaints-page.js`

**Location:** Функция `loadStores()`

**Current Implementation:**
```javascript
async function loadStores() {
  try {
    const endpoint = settings.pilotEndpoint || DEFAULT_PILOT_ENDPOINT;
    const pilotToken = settings.pilotToken || DEFAULT_PILOT_TOKEN;

    const response = await fetch(`${endpoint}/stores`, {
      headers: {
        Authorization: `Bearer ${pilotToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const stores = await response.json();

    storeSelect.innerHTML = '<option value="">Выберите магазин</option>';
    stores.forEach((store) => {
      const option = document.createElement("option");
      option.value = store.id;
      option.textContent = store.name;
      storeSelect.appendChild(option);
    });

    storeSelect.disabled = false;
  } catch (error) {
    console.error("[Complaints Page] Failed to load stores:", error);
    storeSelect.innerHTML = '<option value="">Ошибка загрузки магазинов</option>';
  }
}
```

**New Implementation:**
```javascript
/**
 * Загрузка списка магазинов из нового Backend API
 * Endpoint: GET /api/extension/stores
 */
async function loadStores(forceRefresh = false) {
  try {
    console.log('[Complaints Page] Loading stores from backend...');

    // Очищаем предыдущие ошибки
    const errorElement = document.getElementById('store-load-error');
    if (errorElement) {
      errorElement.style.display = 'none';
      errorElement.textContent = '';
    }

    // Показываем "Загрузка..."
    storeSelect.innerHTML = '<option value="">Загрузка магазинов...</option>';
    storeSelect.disabled = true;

    // Получаем конфигурацию из настроек
    const backendEndpoint = await settingsService.getBackendEndpoint();
    const backendToken = await settingsService.getBackendToken();

    // Запрос к новому endpoint
    const response = await fetch(`${backendEndpoint}/api/extension/stores`, {
      headers: {
        'Authorization': `Bearer ${backendToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Обработка ошибок
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;

      if (response.status === 401) {
        errorMessage = 'Неверный Backend Token. Проверьте настройки.';
      } else if (response.status === 429) {
        const resetAt = response.headers.get('X-RateLimit-Reset');
        const resetTime = resetAt ? new Date(resetAt).toLocaleTimeString('ru-RU') : 'через минуту';
        errorMessage = `Rate limit превышен. Попробуйте в ${resetTime}`;
      }

      throw new Error(errorMessage);
    }

    // Парсим ответ
    const stores = await response.json();
    console.log(`[Complaints Page] Loaded ${stores.length} stores:`, stores);

    // Проверяем rate limit headers
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
    if (rateLimitRemaining && parseInt(rateLimitRemaining) < 10) {
      console.warn(`[Complaints Page] ⚠️ Rate limit warning: осталось ${rateLimitRemaining} запросов`);
    }

    // Заполняем dropdown
    storeSelect.innerHTML = '<option value="">Выберите магазин</option>';

    if (stores.length === 0) {
      storeSelect.innerHTML = '<option value="">Нет доступных магазинов</option>';
      storeSelect.disabled = true;
      return;
    }

    stores.forEach((store) => {
      const option = document.createElement('option');
      option.value = store.id; // Store ID для API
      option.textContent = store.name; // Название для UI

      // Обработка неактивных магазинов
      if (!store.isActive) {
        option.disabled = true;
        option.textContent += ' (неактивен)';
        option.style.color = '#999';
      }

      storeSelect.appendChild(option);
    });

    // Включаем dropdown
    storeSelect.disabled = false;

    // Восстанавливаем последний выбор (если был)
    const lastSelectedStoreId = await settingsService.getCurrentStoreId();
    if (lastSelectedStoreId) {
      storeSelect.value = lastSelectedStoreId;
      console.log(`[Complaints Page] Restored last selection: ${lastSelectedStoreId}`);
    } else if (stores.length === 1 && stores[0].isActive) {
      // Если только один активный магазин — выбираем автоматически
      storeSelect.value = stores[0].id;
      await settingsService.setCurrentStoreId(stores[0].id);
      console.log(`[Complaints Page] Auto-selected single store: ${stores[0].name}`);
    }

  } catch (error) {
    console.error('[Complaints Page] Failed to load stores:', error);

    // Показываем ошибку в UI
    const errorElement = document.getElementById('store-load-error');
    if (errorElement) {
      errorElement.textContent = `❌ Ошибка: ${error.message}`;
      errorElement.style.display = 'block';
    }

    // Dropdown с сообщением об ошибке
    storeSelect.innerHTML = '<option value="">Ошибка загрузки магазинов</option>';
    storeSelect.disabled = true;

    // Предлагаем перейти в настройки
    if (error.message.includes('Backend Token')) {
      storeSelect.innerHTML = '<option value="">Настройте Backend Token</option>';
    }
  }
}
```

**Key Changes:**
1. ✅ Использует новый endpoint `/api/extension/stores`
2. ✅ Обрабатывает `isActive` field (disabled опции)
3. ✅ Показывает rate limit warnings
4. ✅ Автоматически выбирает магазин, если он один
5. ✅ Восстанавливает последний выбор пользователя
6. ✅ Детальные сообщения об ошибках (401, 429)

---

#### 3. Add Event Listener for Store Selection

**Location:** `src/complaints-page.js` — в конце файла

**New Code:**
```javascript
/**
 * Обработка выбора магазина
 * Сохраняем выбор пользователя для следующего запуска
 */
storeSelect.addEventListener('change', async (event) => {
  const selectedStoreId = event.target.value;

  if (!selectedStoreId) {
    console.log('[Complaints Page] No store selected');
    return;
  }

  try {
    // Сохраняем выбор в chrome.storage
    await settingsService.setCurrentStoreId(selectedStoreId);

    // Получаем название магазина для логирования
    const selectedOption = storeSelect.options[storeSelect.selectedIndex];
    const storeName = selectedOption ? selectedOption.textContent : selectedStoreId;

    console.log(`[Complaints Page] Selected store: ${storeName} (${selectedStoreId})`);

    // Опционально: можно сразу загрузить жалобы для выбранного магазина
    // await loadComplaintsForStore(selectedStoreId);

  } catch (error) {
    console.error('[Complaints Page] Failed to save store selection:', error);
  }
});
```

---

#### 4. Add Refresh Button Handler

**Location:** `src/complaints-page.js`

**New Code:**
```javascript
/**
 * Кнопка принудительного обновления списка магазинов
 * Игнорирует кеш (если будет реализован в Phase 3)
 */
const refreshStoresBtn = document.getElementById('refresh-stores-btn');
if (refreshStoresBtn) {
  refreshStoresBtn.addEventListener('click', async () => {
    console.log('[Complaints Page] Manual refresh triggered');

    // Блокируем кнопку на время загрузки
    refreshStoresBtn.disabled = true;
    refreshStoresBtn.textContent = '⏳ Обновление...';

    try {
      await loadStores(true); // forceRefresh = true
      refreshStoresBtn.textContent = '✅ Обновлено';
      setTimeout(() => {
        refreshStoresBtn.textContent = '🔄 Обновить';
        refreshStoresBtn.disabled = false;
      }, 2000);
    } catch (error) {
      refreshStoresBtn.textContent = '❌ Ошибка';
      setTimeout(() => {
        refreshStoresBtn.textContent = '🔄 Обновить';
        refreshStoresBtn.disabled = false;
      }, 2000);
    }
  });
}
```

---

### Testing Phase 1

**Test Cases:**

1. ✅ **Load Stores on Page Open**
   - Открыть complaints-page.html
   - **Expected:** Dropdown заполнен названиями магазинов

2. ✅ **Inactive Store Display**
   - Backend возвращает магазин с `isActive: false`
   - **Expected:** Опция disabled + "(неактивен)" в названии + серый цвет

3. ✅ **Single Store Auto-Selection**
   - У пользователя только один активный магазин
   - **Expected:** Магазин выбран автоматически

4. ✅ **401 Error Handling**
   - Неверный Backend Token в настройках
   - **Expected:** Сообщение "Настройте Backend Token"

5. ✅ **429 Rate Limit Error**
   - Превышен лимит (101-й запрос)
   - **Expected:** Сообщение "Попробуйте в HH:MM"

6. ✅ **Refresh Button**
   - Нажать кнопку "🔄 Обновить"
   - **Expected:** Список магазинов перезагружен

---

## 📦 Phase 2: Settings Management (2 hours)

### Цель
Добавить методы для сохранения/загрузки текущего выбранного магазина.

### Files to Modify

#### 1. `src/services/settings-service.js`

**Location:** Добавить новые методы в класс `SettingsService`

**New Methods:**
```javascript
/**
 * Получить ID текущего выбранного магазина
 * @returns {Promise<string|null>} Store ID или null
 */
async getCurrentStoreId() {
  const data = await chrome.storage.local.get('currentStoreId');
  return data.currentStoreId || null;
}

/**
 * Сохранить ID текущего выбранного магазина
 * @param {string} storeId - Store ID
 */
async setCurrentStoreId(storeId) {
  if (!storeId || typeof storeId !== 'string') {
    console.error('[SettingsService] Invalid store ID:', storeId);
    return;
  }

  await chrome.storage.local.set({ currentStoreId: storeId });
  console.log(`[SettingsService] Current store ID saved: ${storeId}`);
}

/**
 * Очистить текущий выбор магазина
 */
async clearCurrentStoreId() {
  await chrome.storage.local.remove('currentStoreId');
  console.log('[SettingsService] Current store ID cleared');
}
```

**Важно:** Используем `chrome.storage.local` (не `sync`), так как выбор магазина специфичен для текущего устройства.

---

#### 2. `src/options/options.js`

**Location:** Добавить отображение текущего магазина в настройках

**New Code (в функцию `loadSettings()`):**
```javascript
async function loadSettings() {
  // ... existing code ...

  // Показываем текущий выбранный магазин
  await displayCurrentStore();
}

/**
 * Отображает информацию о текущем выбранном магазине
 */
async function displayCurrentStore() {
  const currentStoreId = await settingsService.getCurrentStoreId();

  if (!currentStoreId) {
    console.log('[Options] No store currently selected');
    return;
  }

  // Можно добавить UI элемент для отображения
  console.log(`[Options] Current store: ${currentStoreId}`);

  // Опционально: загрузить название магазина из backend
  // и показать в UI: "Текущий магазин: 20Grace ИП Ширазданова Г. М."
}
```

**Опционально:** Добавить в `options.html` информационный блок:
```html
<!-- Показываем текущий выбранный магазин -->
<div class="info-block" style="background: #f0f9ff; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
  <h3>📍 Текущий магазин</h3>
  <p id="current-store-info">Магазин не выбран</p>
  <button type="button" id="change-store-btn" style="margin-top: 10px;">
    🔄 Изменить магазин
  </button>
</div>
```

**Handler для кнопки:**
```javascript
const changeStoreBtn = document.getElementById('change-store-btn');
if (changeStoreBtn) {
  changeStoreBtn.addEventListener('click', async () => {
    // Открываем complaints-page.html для выбора магазина
    chrome.tabs.create({
      url: chrome.runtime.getURL('complaints-page.html')
    });
  });
}
```

---

### Testing Phase 2

**Test Cases:**

1. ✅ **Save Store Selection**
   - Выбрать магазин в complaints-page
   - **Expected:** `chrome.storage.local` содержит `currentStoreId`

2. ✅ **Load Store Selection**
   - Перезагрузить complaints-page
   - **Expected:** Последний выбранный магазин автоматически selected

3. ✅ **Display in Settings**
   - Открыть options.html
   - **Expected:** Показано название текущего магазина

4. ✅ **Clear Selection**
   - Вызвать `clearCurrentStoreId()`
   - **Expected:** `currentStoreId` удален из storage

---

## 📦 Phase 3: Store Manager Service (2 hours)

### Цель
Создать отдельный service для управления списком магазинов с кешированием.

### New File: `src/services/store-manager.js`

**Implementation:**
```javascript
/**
 * StoreManager - управление списком магазинов
 *
 * Функции:
 * - Загрузка списка магазинов из Backend API
 * - Кеширование списка (TTL: 5 минут)
 * - Получение информации о конкретном магазине
 * - Обработка ошибок и rate limiting
 *
 * @version 1.0.0
 */

import { settingsService } from './settings-service.js';

class StoreManager {
  constructor() {
    this.cachedStores = null;
    this.cacheExpiry = null;
    this.CACHE_TTL = 5 * 60 * 1000; // 5 минут
  }

  /**
   * Загрузить список магазинов из Backend API
   * @param {boolean} forceRefresh - Игнорировать кеш и загрузить заново
   * @returns {Promise<Array>} Список магазинов
   */
  async loadStores(forceRefresh = false) {
    // Проверяем кеш
    if (!forceRefresh && this.cachedStores && Date.now() < this.cacheExpiry) {
      console.log('[StoreManager] Returning cached stores');
      return this.cachedStores;
    }

    console.log('[StoreManager] Fetching stores from backend...');

    try {
      // Получаем конфиг
      const backendEndpoint = await settingsService.getBackendEndpoint();
      const backendToken = await settingsService.getBackendToken();

      // Запрос к API
      const response = await fetch(`${backendEndpoint}/api/extension/stores`, {
        headers: {
          'Authorization': `Bearer ${backendToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Обработка ошибок
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid backend token. Please check settings.');
        } else if (response.status === 429) {
          const resetAt = response.headers.get('X-RateLimit-Reset');
          const resetTime = resetAt ? new Date(resetAt).toLocaleTimeString('ru-RU') : 'через минуту';
          throw new Error(`Rate limit exceeded. Try again at ${resetTime}`);
        }
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const stores = await response.json();

      // Обновляем кеш
      this.cachedStores = stores;
      this.cacheExpiry = Date.now() + this.CACHE_TTL;

      console.log(`[StoreManager] Loaded ${stores.length} stores (cached for ${this.CACHE_TTL / 1000}s)`);

      // Логируем rate limit info
      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
      const rateLimitLimit = response.headers.get('X-RateLimit-Limit');
      if (rateLimitRemaining && rateLimitLimit) {
        console.log(`[StoreManager] Rate limit: ${rateLimitRemaining}/${rateLimitLimit}`);
      }

      return stores;

    } catch (error) {
      console.error('[StoreManager] Failed to load stores:', error);
      throw error; // Пробрасываем ошибку для обработки в UI
    }
  }

  /**
   * Получить информацию о конкретном магазине по ID
   * @param {string} storeId - Store ID
   * @returns {Promise<Object|null>} Информация о магазине или null
   */
  async getStoreById(storeId) {
    if (!storeId) {
      return null;
    }

    const stores = await this.loadStores();
    return stores.find(s => s.id === storeId) || null;
  }

  /**
   * Получить только активные магазины
   * @returns {Promise<Array>} Список активных магазинов
   */
  async getActiveStores() {
    const stores = await this.loadStores();
    return stores.filter(s => s.isActive);
  }

  /**
   * Проверить, активен ли магазин
   * @param {string} storeId - Store ID
   * @returns {Promise<boolean>} true если активен
   */
  async isStoreActive(storeId) {
    const store = await this.getStoreById(storeId);
    return store ? store.isActive : false;
  }

  /**
   * Очистить кеш (принудительное обновление при следующем запросе)
   */
  clearCache() {
    this.cachedStores = null;
    this.cacheExpiry = null;
    console.log('[StoreManager] Cache cleared');
  }

  /**
   * Получить время до истечения кеша
   * @returns {number|null} Миллисекунды до истечения или null если кеш пуст
   */
  getCacheTimeRemaining() {
    if (!this.cacheExpiry) {
      return null;
    }
    return Math.max(0, this.cacheExpiry - Date.now());
  }

  /**
   * Проверить, есть ли валидный кеш
   * @returns {boolean}
   */
  hasCachedStores() {
    return this.cachedStores !== null && Date.now() < this.cacheExpiry;
  }
}

// Singleton instance
export const storeManager = new StoreManager();

// For debugging
window.storeManager = storeManager;
```

---

### Integration with complaints-page.js

**Update `loadStores()` to use StoreManager:**

```javascript
import { storeManager } from './services/store-manager.js';

/**
 * Загрузка списка магазинов (теперь с кешированием)
 */
async function loadStores(forceRefresh = false) {
  try {
    console.log('[Complaints Page] Loading stores...');

    // Очищаем ошибки
    const errorElement = document.getElementById('store-load-error');
    if (errorElement) {
      errorElement.style.display = 'none';
    }

    // Показываем "Загрузка..."
    storeSelect.innerHTML = '<option value="">Загрузка магазинов...</option>';
    storeSelect.disabled = true;

    // Используем StoreManager (с кешированием!)
    const stores = await storeManager.loadStores(forceRefresh);

    // ... остальной код заполнения dropdown ...
    // (см. Phase 1)

  } catch (error) {
    // ... обработка ошибок ...
  }
}
```

**Benefits:**
- ✅ Кеширование (5 минут) — меньше запросов к backend
- ✅ Централизованное управление
- ✅ Легко использовать в других частях расширения
- ✅ Rate limit мониторинг

---

### Testing Phase 3

**Test Cases:**

1. ✅ **Cache Hit**
   - Загрузить магазины
   - Обновить страницу в течение 5 минут
   - **Expected:** Нет запроса к backend, используется кеш

2. ✅ **Cache Miss**
   - Подождать >5 минут
   - Обновить страницу
   - **Expected:** Новый запрос к backend

3. ✅ **Force Refresh**
   - Нажать кнопку "🔄 Обновить"
   - **Expected:** Игнорируется кеш, новый запрос

4. ✅ **getStoreById()**
   - Вызвать `storeManager.getStoreById('ss6Y8orHTX6vS7SgJl4k')`
   - **Expected:** Возвращает объект магазина

5. ✅ **getActiveStores()**
   - Вызвать `storeManager.getActiveStores()`
   - **Expected:** Только магазины с `isActive: true`

6. ✅ **Debug Console**
   - Открыть DevTools, ввести `storeManager.hasCachedStores()`
   - **Expected:** `true` если кеш валиден

---

## 📦 Phase 4: Testing & QA (1 hour)

### End-to-End Test Scenarios

#### Scenario 1: First Time User
**Steps:**
1. Установить расширение
2. Настроить Backend Token в options.html
3. Открыть complaints-page.html

**Expected:**
- ✅ Dropdown загружается автоматически
- ✅ Если один магазин → выбран автоматически
- ✅ Если несколько → показан список

---

#### Scenario 2: Multi-Store User
**Steps:**
1. Открыть complaints-page.html
2. Выбрать "Магазин A" из dropdown
3. Закрыть страницу
4. Открыть complaints-page.html снова

**Expected:**
- ✅ "Магазин A" выбран автоматически
- ✅ Список загружен из кеша (нет задержки)

---

#### Scenario 3: Inactive Store Handling
**Steps:**
1. Backend возвращает магазин с `isActive: false`
2. Открыть complaints-page.html

**Expected:**
- ✅ Опция отображается в dropdown
- ✅ Disabled (нельзя выбрать)
- ✅ Текст "(неактивен)" в названии
- ✅ Серый цвет

---

#### Scenario 4: Error Handling - Invalid Token
**Steps:**
1. Удалить Backend Token из настроек
2. Открыть complaints-page.html

**Expected:**
- ✅ Dropdown показывает "Ошибка загрузки"
- ✅ Сообщение: "Настройте Backend Token"
- ✅ Красный текст ошибки под dropdown

---

#### Scenario 5: Rate Limit Handling
**Steps:**
1. Отправить 101 запрос к `/api/extension/stores`
2. Попробовать загрузить магазины

**Expected:**
- ✅ Сообщение: "Rate limit превышен. Попробуйте в HH:MM"
- ✅ Кнопка "🔄 Обновить" disabled до сброса лимита

---

#### Scenario 6: Cache Performance
**Steps:**
1. Загрузить магазины (первый запрос)
2. Обновить страницу 10 раз в течение 5 минут

**Expected:**
- ✅ Только 1 запрос к backend
- ✅ Остальные 9 загрузок из кеша
- ✅ Мгновенная загрузка dropdown

---

#### Scenario 7: Refresh Button
**Steps:**
1. Загрузить магазины
2. Добавить новый магазин в backend (через другой инструмент)
3. Нажать "🔄 Обновить" в расширении

**Expected:**
- ✅ Новый магазин появился в dropdown
- ✅ Кеш обновлен
- ✅ Кнопка показывает "✅ Обновлено" на 2 секунды

---

### Performance Testing

**Metrics to Track:**

1. **Page Load Time:**
   - Time from page open to dropdown populated
   - Target: <2 seconds (first load)
   - Target: <200ms (cached load)

2. **API Response Time:**
   - Time for `/api/extension/stores` to respond
   - Target: <500ms

3. **Cache Hit Rate:**
   - % of loads served from cache
   - Target: >80% after first load

4. **Memory Usage:**
   - Monitor cache size in memory
   - Target: <100KB for typical store list

---

### Browser Compatibility Testing

Test on all supported browsers:

- ✅ Google Chrome (latest)
- ✅ Microsoft Edge (latest)
- ✅ Brave (latest)
- ✅ Opera (latest)

**Note:** Manifest V3 required for all.

---

## 📦 Phase 5: Documentation (30 minutes)

### Files to Update

#### 1. `README.md`

**Add Section: Multi-Store Support**

```markdown
## 🏪 Multi-Store Support

Расширение поддерживает работу с несколькими магазинами:

### Как Использовать

1. **Настройте Backend API:**
   - Откройте настройки расширения (правый клик на иконке → Настройки)
   - Введите Backend Token
   - Сохраните настройки

2. **Выберите Магазин:**
   - Откройте страницу подачи жалоб
   - Выберите нужный магазин из выпадающего списка
   - Расширение автоматически запомнит ваш выбор

3. **Переключение Между Магазинами:**
   - Просто выберите другой магазин из dropdown
   - Нет необходимости менять настройки!

### Кеширование

Список магазинов кешируется на 5 минут для быстрой загрузки.

Чтобы принудительно обновить список, нажмите кнопку "🔄 Обновить".

### Неактивные Магазины

Магазины с статусом "неактивен" отображаются в списке серым цветом и недоступны для выбора.
```

---

#### 2. `TESTING_INSTRUCTIONS.md`

**Add Section: Testing Multi-Store**

```markdown
## 🏪 Тестирование Multi-Store

### Предусловия

1. Backend API деплоен: http://158.160.217.236
2. Backend Token настроен в расширении
3. У пользователя есть доступ к 2+ магазинам

### Test Cases

#### TC-MS-001: Загрузка Списка Магазинов

**Steps:**
1. Открыть complaints-page.html
2. Дождаться загрузки dropdown

**Expected:**
- Dropdown заполнен названиями магазинов
- Магазины отсортированы по алфавиту
- Неактивные магазины помечены "(неактивен)"

**Pass/Fail:** _______

---

#### TC-MS-002: Выбор Магазина

**Steps:**
1. Выбрать магазин из dropdown
2. Закрыть страницу
3. Открыть снова

**Expected:**
- Последний выбор восстановлен автоматически

**Pass/Fail:** _______

---

#### TC-MS-003: Кеширование

**Steps:**
1. Загрузить магазины (открыть DevTools Network tab)
2. Обновить страницу 3 раза в течение 5 минут

**Expected:**
- Только 1 запрос к `/api/extension/stores`
- Остальные загрузки из кеша (no network request)

**Pass/Fail:** _______

---

#### TC-MS-004: Error Handling (401)

**Steps:**
1. Удалить Backend Token
2. Открыть complaints-page.html

**Expected:**
- Сообщение: "Настройте Backend Token"
- Dropdown disabled

**Pass/Fail:** _______
```

---

#### 3. Create `MULTI_STORE_USER_GUIDE.md` (Optional)

User-facing documentation with screenshots:

```markdown
# 📖 Руководство Пользователя - Работа с Несколькими Магазинами

## Зачем Это Нужно?

Если у вас несколько магазинов на Wildberries, теперь вы можете легко переключаться между ними без ручного ввода ID.

## Быстрый Старт

### 1. Первая Настройка (1 раз)

1. Правый клик на иконке расширения
2. Выберите "Настройки"
3. Введите Backend Token (получите у администратора)
4. Нажмите "Сохранить"

### 2. Выбор Магазина

1. Откройте страницу подачи жалоб
2. В выпадающем списке выберите нужный магазин
3. Готово! Расширение запомнит ваш выбор

### 3. Переключение Магазинов

Просто выберите другой магазин из списка — всё!

## Часто Задаваемые Вопросы

**Q: Сколько магазинов я могу добавить?**
A: Неограниченно. Список загружается автоматически из backend.

**Q: Что значит "(неактивен)" рядом с названием?**
A: Этот магазин временно недоступен. Свяжитесь с администратором.

**Q: Как обновить список магазинов?**
A: Нажмите кнопку "🔄 Обновить" на странице подачи жалоб.

**Q: Ошибка "Rate limit превышен"?**
A: Слишком много запросов. Подождите 1 минуту и попробуйте снова.
```

---

## 📊 Success Criteria

Интеграция считается успешной, когда:

- ✅ Все 5 phases завершены
- ✅ Все test cases passed
- ✅ Нет critical bugs
- ✅ Performance targets достигнуты (<2s load time)
- ✅ Документация обновлена
- ✅ User acceptance testing пройдено

---

## 🚀 Deployment Checklist

### Pre-Deployment

- [ ] Все тесты passed (Phase 4)
- [ ] Code review завершен
- [ ] Документация обновлена (Phase 5)
- [ ] Performance проверен
- [ ] Cross-browser тестирование пройдено

### Deployment

- [ ] Обновить версию в manifest.json (1.3.0 → 1.4.0)
- [ ] Создать git commit: "feat: Add multi-store support"
- [ ] Создать git tag: v1.4.0
- [ ] Собрать extension package (zip)
- [ ] Загрузить в Chrome Web Store (if published)

### Post-Deployment

- [ ] Мониторить логи в production (первые 24 часа)
- [ ] Собрать feedback от пользователей
- [ ] Отследить success metrics:
  - Cache hit rate
  - Error rate (401, 429)
  - Average page load time

---

## 🔧 Troubleshooting

### Issue 1: Dropdown Пустой

**Symptoms:**
- Dropdown показывает "Загрузка магазинов..."
- Не обновляется

**Possible Causes:**
- Network error
- Invalid Backend Token
- Backend endpoint unavailable

**Solution:**
1. Открыть DevTools Console
2. Проверить ошибки
3. Проверить Network tab для `/api/extension/stores`
4. Проверить Backend Token в настройках

---

### Issue 2: Cache Не Обновляется

**Symptoms:**
- Новые магазины не появляются
- Старые данные в dropdown

**Solution:**
1. Нажать "🔄 Обновить"
2. Или подождать 5 минут (TTL)
3. Или вызвать `storeManager.clearCache()` в console

---

### Issue 3: Rate Limit 429

**Symptoms:**
- Ошибка "Rate limit превышен"
- Dropdown не загружается

**Solution:**
1. Проверить `X-RateLimit-Reset` header
2. Подождать до времени сброса
3. Увеличить CACHE_TTL в store-manager.js (если часто происходит)

---

## 📞 Support

### Technical Questions
- **Documentation:** См. MULTI_STORE_ENDPOINT.md
- **Backend API:** http://158.160.217.236
- **Health Check:** http://158.160.217.236/api/health

### Bug Reports
- **GitHub Issues:** (ваш репозиторий)
- **Priority:** High (multi-store is core functionality)

---

## 🎯 Summary

**Total Time Estimate:** 7.5 hours (1 рабочий день)

**Key Deliverables:**
1. ✅ Updated UI (complaints-page.html + .js)
2. ✅ Settings management (getCurrentStoreId/setCurrentStoreId)
3. ✅ StoreManager service (с кешированием)
4. ✅ Comprehensive testing (E2E scenarios)
5. ✅ Updated documentation (README, testing guide)

**Benefits:**
- 👍 Лучший UX (dropdown vs ручной ввод ID)
- 👍 Быстрое переключение между магазинами
- 👍 Кеширование (меньше нагрузка на backend)
- 👍 Robust error handling
- 👍 Production-ready code

---

**План готов к выполнению! Начинаем с Phase 1.** 🚀

**Next Step:** Создать новую ветку `feature/multi-store` и начать имплементацию.
