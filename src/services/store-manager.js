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
      return this.cachedStores;
    }

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
if (typeof window !== 'undefined') {
  window.storeManager = storeManager;
}
