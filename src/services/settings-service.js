/**
 * Сервис для работы с настройками расширения
 * Централизованный доступ к chrome.storage.sync с кешированием
 *
 * @version 1.2.0
 * @description Управляет всеми настройками расширения с поддержкой кеша для производительности
 */

/**
 * Сервис для работы с настройками
 */
class SettingsService {
  constructor() {
    this.cache = null;
    this.cacheTime = null;
    this.CACHE_TTL = 5000; // 5 секунд
  }

  /**
   * Получить все настройки из storage
   * @param {boolean} useCache - Использовать кеш
   * @returns {Promise<Object|null>}
   */
  async getSettings(useCache = true) {
    // Проверяем кеш
    if (useCache && this.cache && Date.now() - this.cacheTime < this.CACHE_TTL) {
      return this.cache;
    }

    try {
      const result = await chrome.storage.sync.get('settings');
      this.cache = result.settings || null;
      this.cacheTime = Date.now();

      return this.cache;
    } catch (error) {
      console.error('[SettingsService] ❌ Ошибка получения настроек:', error);
      return null;
    }
  }

  /**
   * Получить токен Pilot Entry API
   * @returns {Promise<string>}
   * @throws {Error} Если токен не настроен
   */
  async getPilotToken() {
    const settings = await this.getSettings();

    if (!settings?.pilotToken) {
      throw new Error('API токен не настроен. Перейдите в настройки расширения (иконка → правый клик → Параметры).');
    }

    return settings.pilotToken;
  }

  /**
   * Получить endpoint Pilot Entry API
   * @returns {Promise<string>}
   */
  async getPilotEndpoint() {
    const settings = await this.getSettings();
    const defaultEndpoint = 'https://pilot-entry.ru/api';

    return settings?.pilotEndpoint || defaultEndpoint;
  }

  /**
   * Получить Backend API endpoint (новый backend)
   * @returns {Promise<string>}
   */
  async getBackendEndpoint() {
    const settings = await this.getSettings();
    const defaultEndpoint = 'https://rating5.ru';
    const endpoint = settings?.backendEndpoint || defaultEndpoint;

    return endpoint;
  }

  /**
   * Получить Backend API token (новый backend)
   * @returns {Promise<string>}
   * @throws {Error} Если токен не настроен
   */
  async getBackendToken() {
    // 🔒 ХАРДКОД Backend Token для единственного пользователя (ВРЕМЕННОЕ РЕШЕНИЕ)
    // Актуальный токен получен от Backend команды 2026-01-29
    const HARDCODED_TOKEN = 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
    return HARDCODED_TOKEN;

    /* Старый код (закомментирован, так как используется хардкод):
    const settings = await this.getSettings();

    if (!settings?.backendToken) {
      throw new Error('Backend API токен не настроен. Перейдите в настройки расширения.');
    }

    return settings.backendToken;
    */
  }

  /**
   * Получить Backend Store ID (новый backend)
   * @returns {Promise<string>}
   * @throws {Error} Если Store ID не настроен
   */
  async getBackendStoreId() {
    // Читаем из chrome.storage.local (там хранится выбранный магазин из dropdown)
    const currentStoreId = await this.getCurrentStoreId();

    if (!currentStoreId) {
      throw new Error('Магазин не выбран. Пожалуйста, выберите магазин из выпадающего списка.');
    }

    return currentStoreId;

    /* Старый код (закомментирован, так как используется currentStoreId):
    const settings = await this.getSettings();

    if (!settings?.backendStoreId) {
      throw new Error('Backend Store ID не настроен. Перейдите в настройки расширения.');
    }

    return settings.backendStoreId;
    */
  }

  /**
   * Получить настройки Google Sheets
   * @returns {Promise<Object|null>} Конфигурация или null если не настроено
   */
  async getSheetsConfig() {
    const settings = await this.getSettings();

    if (!settings?.sheetsEnabled || !settings?.sheetsUrl) {
      return null;
    }

    return {
      enabled: settings.sheetsEnabled,
      url: settings.sheetsUrl,
      token: settings.sheetsToken || 'wb-reports-2024'
    };
  }

  /**
   * Получить настройки External API для отправки отзывов
   * @returns {Promise<Object|null>} Конфигурация или null если не настроено
   */
  async getExternalAPIConfig() {
    const settings = await this.getSettings();

    if (!settings?.externalApi || !settings?.externalToken) {
      return null;
    }

    return {
      url: settings.externalApi,
      token: settings.externalToken
    };
  }

  /**
   * Сохранить настройки в storage
   * @param {Object} newSettings - Новые настройки
   * @returns {Promise<void>}
   */
  async saveSettings(newSettings) {
    try {
      await chrome.storage.sync.set({ settings: newSettings });
      this.invalidateCache();
    } catch (error) {
      console.error('[SettingsService] ❌ Ошибка сохранения настроек:', error);
      throw error;
    }
  }

  /**
   * Обновить часть настроек (merge)
   * @param {Object} updates - Обновления для слияния
   * @returns {Promise<void>}
   */
  async updateSettings(updates) {
    const current = await this.getSettings(false); // Без кеша
    const updated = { ...current, ...updates };
    await this.saveSettings(updated);
  }

  /**
   * Сбросить кеш (вызывать при обновлении настроек)
   */
  invalidateCache() {
    this.cache = null;
    this.cacheTime = null;
  }

  /**
   * Проверить наличие обязательных настроек
   * @returns {Promise<{isValid: boolean, missing: string[]}>}
   */
  async validateSettings() {
    const settings = await this.getSettings();
    const missing = [];

    if (!settings) {
      return {
        isValid: false,
        missing: ['Настройки не инициализированы']
      };
    }

    if (!settings.pilotToken) {
      missing.push('pilotToken');
    }

    return {
      isValid: missing.length === 0,
      missing
    };
  }

  /**
   * Проверить настройки Backend API
   * @returns {Promise<{isValid: boolean, missing: string[], errors: string[]}>}
   */
  async validateBackendConfig() {
    const settings = await this.getSettings();
    const missing = [];
    const errors = [];

    if (!settings) {
      return {
        isValid: false,
        missing: ['Настройки не инициализированы'],
        errors: ['Settings not initialized']
      };
    }

    const endpoint = settings.backendEndpoint;
    const token = settings.backendToken;
    const storeId = settings.backendStoreId;

    if (!endpoint) {
      missing.push('backendEndpoint');
      errors.push('Backend URL не настроен');
    } else if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      errors.push('Backend URL должен начинаться с http:// или https://');
    }

    if (!token) {
      missing.push('backendToken');
      errors.push('Backend Token не настроен');
    } else if (token.length < 32) {
      errors.push('Backend Token должен быть минимум 32 символа');
    }

    if (!storeId) {
      missing.push('backendStoreId');
      errors.push('Store ID не настроен');
    }

    return {
      isValid: missing.length === 0 && errors.length === 0,
      missing,
      errors
    };
  }

  /**
   * Получить ID текущего выбранного магазина
   * @returns {Promise<string|null>} Store ID или null
   */
  async getCurrentStoreId() {
    try {
      const data = await chrome.storage.local.get('currentStoreId');
      return data.currentStoreId || null;
    } catch (error) {
      console.error('[SettingsService] ❌ Ошибка получения currentStoreId:', error);
      return null;
    }
  }

  /**
   * Сохранить ID текущего выбранного магазина
   * @param {string} storeId - Store ID
   */
  async setCurrentStoreId(storeId) {
    if (!storeId || typeof storeId !== 'string') {
      console.error('[SettingsService] Invalid store ID:', storeId);
      throw new Error('Invalid store ID');
    }

    try {
      await chrome.storage.local.set({ currentStoreId: storeId });
    } catch (error) {
      console.error('[SettingsService] ❌ Ошибка сохранения currentStoreId:', error);
      throw error;
    }
  }

  /**
   * Очистить текущий выбор магазина
   */
  async clearCurrentStoreId() {
    try {
      await chrome.storage.local.remove('currentStoreId');
    } catch (error) {
      console.error('[SettingsService] ❌ Ошибка очистки currentStoreId:', error);
      throw error;
    }
  }
}

// Экспортируем singleton
export const settingsService = new SettingsService();
