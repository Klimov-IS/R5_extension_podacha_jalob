/**
 * Сервис управления магазинами для complaints-page
 * Загрузка, выбор и управление состоянием магазинов
 *
 * @version 1.0.0
 */

import { BACKEND_ENDPOINT, BACKEND_TOKEN } from '../config/complaints-config.js';
import { complaintsLogger } from './complaints-logger-service.js';

/**
 * Сервис для работы с магазинами
 */
export class ComplaintsStoreService {
  constructor() {
    this.stores = [];
    this.selectedStoreId = null;
    this.storeSelectElement = null;
    this.errorElement = null;
  }

  /**
   * Инициализация DOM элементов
   * @param {HTMLSelectElement} storeSelectElement - Dropdown элемент
   * @param {HTMLElement} errorElement - Элемент для отображения ошибок
   */
  initializeElements(storeSelectElement, errorElement) {
    this.storeSelectElement = storeSelectElement;
    this.errorElement = errorElement;
  }

  /**
   * Загрузка списка магазинов из Backend API
   * @param {boolean} forceRefresh - Игнорировать кеш
   * @returns {Promise<Array>} - Массив магазинов
   */
  async loadStores(forceRefresh = false) {
    try {
      console.log('[StoreService] 🔄 Начинаем загрузку магазинов...');

      // Очищаем предыдущие ошибки
      this._clearError();

      // Показываем "Загрузка..."
      this._showLoading();

      // 🔒 Используем захардкоженные константы (ВРЕМЕННОЕ РЕШЕНИЕ)
      const backendEndpoint = BACKEND_ENDPOINT;
      const backendToken = BACKEND_TOKEN;

      console.log(`[StoreService] 🌐 Запрос: ${backendEndpoint}/api/extension/stores`);
      console.log(`[StoreService] 🔑 Токен длина: ${backendToken.length}`);

      // Запрос к Backend API
      const response = await fetch(`${backendEndpoint}/api/extension/stores`, {
        headers: {
          'Authorization': `Bearer ${backendToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`[StoreService] 📡 Ответ: ${response.status} ${response.statusText}`);

      // Обработка ошибок HTTP
      if (!response.ok) {
        const errorMessage = await this._handleHTTPError(response);
        throw new Error(errorMessage);
      }

      // Парсинг ответа
      this.stores = await response.json();
      console.log(`[StoreService] ✅ Получено магазинов: ${this.stores.length}`, this.stores);

      // Проверка rate limit
      this._checkRateLimit(response);

      // Заполняем dropdown
      await this._populateDropdown();

      // Восстанавливаем/автовыбираем магазин
      await this._restoreSelection();

      return this.stores;

    } catch (err) {
      console.error('[StoreService] ❌ Ошибка загрузки магазинов:', err);

      // Показываем ошибку в UI
      this._showError(err.message);

      // Логируем через logger service
      complaintsLogger.error(`❌ Ошибка загрузки магазинов: ${err.message}`);

      throw err;
    }
  }

  /**
   * Обработка HTTP ошибок
   * @private
   * @param {Response} response
   * @returns {Promise<string>} - Сообщение об ошибке
   */
  async _handleHTTPError(response) {
    let errorMessage = `HTTP ${response.status}`;

    if (response.status === 401) {
      errorMessage = 'Неверный Backend Token. Проверьте настройки.';
    } else if (response.status === 429) {
      const resetAt = response.headers.get('X-RateLimit-Reset');
      const resetTime = resetAt
        ? new Date(resetAt).toLocaleTimeString('ru-RU')
        : 'через минуту';
      errorMessage = `Rate limit превышен. Попробуйте в ${resetTime}`;
    } else {
      const errorText = await response.text().catch(() => '');
      console.error(`[StoreService] ❌ Ошибка HTTP:`, response.status, errorText);
      errorMessage = `HTTP ${response.status}: ${errorText}`;
    }

    return errorMessage;
  }

  /**
   * Проверка rate limit headers
   * @private
   */
  _checkRateLimit(response) {
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
    const rateLimitLimit = response.headers.get('X-RateLimit-Limit');

    if (rateLimitRemaining && rateLimitLimit) {
      console.log(`[StoreService] Rate limit: ${rateLimitRemaining}/${rateLimitLimit}`);

      if (parseInt(rateLimitRemaining) < 10) {
        console.warn(`[StoreService] ⚠️ Rate limit warning: осталось ${rateLimitRemaining} запросов`);
      }
    }
  }

  /**
   * Заполнение dropdown списка магазинов
   * @private
   */
  async _populateDropdown() {
    if (!this.storeSelectElement) {
      console.warn('[StoreService] ⚠️ storeSelectElement не инициализирован');
      return;
    }

    this.storeSelectElement.innerHTML = '<option value="">Выберите магазин</option>';

    if (this.stores.length === 0) {
      this.storeSelectElement.innerHTML = '<option value="">Нет доступных магазинов</option>';
      this.storeSelectElement.disabled = true;
      complaintsLogger.warn('⚠️ У вас нет доступных магазинов');
      return;
    }

    // Добавляем магазины в dropdown
    this.stores.forEach((store) => {
      const option = document.createElement('option');
      option.value = store.id;
      option.textContent = store.name;

      // Обработка неактивных магазинов
      if (!store.isActive) {
        option.disabled = true;
        option.textContent += ' (неактивен)';
        option.style.color = '#999';
      }

      this.storeSelectElement.appendChild(option);
    });

    // Включаем dropdown
    this.storeSelectElement.disabled = false;
  }

  /**
   * Восстановление последнего выбора или автовыбор
   * @private
   */
  async _restoreSelection() {
    if (!this.storeSelectElement) return;

    // Восстанавливаем последний выбор из storage
    const lastSelected = await chrome.storage.local.get('currentStoreId');

    if (lastSelected.currentStoreId) {
      this.storeSelectElement.value = lastSelected.currentStoreId;
      this.selectedStoreId = lastSelected.currentStoreId;
      console.log(`[StoreService] ✅ Восстановлен выбор: ${lastSelected.currentStoreId}`);
      complaintsLogger.info(`✅ Загружено ${this.stores.length} магазинов (восстановлен выбор)`);
    } else if (this.stores.length === 1 && this.stores[0].isActive) {
      // Если только один активный магазин — выбираем автоматически
      this.storeSelectElement.value = this.stores[0].id;
      this.selectedStoreId = this.stores[0].id;
      await chrome.storage.local.set({ currentStoreId: this.stores[0].id });
      console.log(`[StoreService] ✅ Автовыбор: ${this.stores[0].name}`);
      complaintsLogger.success(`✅ Загружено ${this.stores.length} магазинов (автовыбор: ${this.stores[0].name})`);
    } else {
      complaintsLogger.info(`✅ Загружено ${this.stores.length} магазинов`);
    }
  }

  /**
   * Выбор магазина пользователем
   * @param {string} storeId - ID магазина
   * @returns {Promise<void>}
   */
  async selectStore(storeId) {
    if (!storeId) {
      console.log('[StoreService] No store selected');
      return;
    }

    try {
      // Сохраняем в storage
      await chrome.storage.local.set({ currentStoreId: storeId });
      this.selectedStoreId = storeId;

      // Получаем название магазина для логирования
      const store = this.stores.find(s => s.id === storeId);
      const storeName = store ? store.name : storeId;

      console.log(`[StoreService] ✅ Выбран магазин: ${storeName} (${storeId})`);
      complaintsLogger.info(`✅ Выбран магазин: ${storeName}`);

    } catch (error) {
      console.error('[StoreService] ❌ Ошибка сохранения выбора:', error);
      complaintsLogger.error(`❌ Не удалось сохранить выбор магазина: ${error.message}`);
    }
  }

  /**
   * Получить текущий выбранный магазин
   * @returns {string|null} - ID магазина или null
   */
  getSelectedStoreId() {
    return this.selectedStoreId || this.storeSelectElement?.value || null;
  }

  /**
   * Получить информацию о магазине по ID
   * @param {string} storeId - ID магазина
   * @returns {Object|null} - Объект магазина или null
   */
  getStoreById(storeId) {
    return this.stores.find(s => s.id === storeId) || null;
  }

  /**
   * Получить название магазина по ID
   * @param {string} storeId - ID магазина
   * @returns {string} - Название магазина
   */
  getStoreName(storeId) {
    const store = this.getStoreById(storeId);
    return store ? store.name : 'Unknown';
  }

  /**
   * Очистка ошибки
   * @private
   */
  _clearError() {
    if (this.errorElement) {
      this.errorElement.style.display = 'none';
      this.errorElement.textContent = '';
    }
  }

  /**
   * Показ ошибки
   * @private
   */
  _showError(message) {
    if (this.errorElement) {
      this.errorElement.textContent = `❌ ${message}`;
      this.errorElement.style.display = 'block';
    }

    if (this.storeSelectElement) {
      this.storeSelectElement.innerHTML = '<option value="">Ошибка загрузки магазинов</option>';
      this.storeSelectElement.disabled = true;

      // Предлагаем перейти в настройки
      if (message.includes('Backend Token')) {
        this.storeSelectElement.innerHTML = '<option value="">Настройте Backend Token</option>';
      }
    }
  }

  /**
   * Показ состояния загрузки
   * @private
   */
  _showLoading() {
    if (this.storeSelectElement) {
      this.storeSelectElement.innerHTML = '<option value="">Загрузка магазинов...</option>';
      this.storeSelectElement.disabled = true;
    }
  }
}

/**
 * Singleton экземпляр сервиса магазинов
 */
export const complaintsStoreService = new ComplaintsStoreService();
