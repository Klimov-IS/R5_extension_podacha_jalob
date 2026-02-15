/**
 * API клиент для Backend API
 * Централизованная работа с Backend API
 *
 * @version 1.3.0
 * @description Единая точка входа для всех запросов к Backend API
 * Обновлено для работы с новым backend: http://158.160.217.236
 */

import { fetchWithRetry } from '../utils/fetch-retry.js';
import { settingsService } from '../services/settings-service.js';
import { processComplaints } from '../utils/api-helpers.js';

/**
 * API клиент для Backend API
 */
class PilotAPI {
  constructor() {
    this.baseURL = null;
    this.token = null;
    this.storeId = null;
  }

  /**
   * Инициализация API клиента с настройками
   * Загружает endpoint, token и storeId из настроек
   * @throws {Error} Если настройки не сконфигурированы
   */
  async initialize() {
    try {
      this.baseURL = await settingsService.getBackendEndpoint();
      this.token = await settingsService.getBackendToken();
      this.storeId = await settingsService.getBackendStoreId();

      // Initialization complete
    } catch (error) {
      console.error('[PilotAPI] ❌ Ошибка инициализации:', error);
      throw new Error(`API не настроен: ${error.message}`);
    }
  }

  /**
   * Получить список магазинов (Legacy method - для обратной совместимости)
   * В новом API токен привязан к одному магазину
   * @returns {Promise<Array>}
   * @deprecated Используйте getStoreId() для получения текущего Store ID
   */
  async getStores() {
    await this.initialize();

    // Возвращаем "виртуальный" магазин для совместимости
    return [{
      id: this.storeId,
      name: 'Current Store',
      isActive: true
    }];
  }

  /**
   * Получить текущий Store ID
   * @returns {Promise<string>}
   */
  async getStoreId() {
    await this.initialize();
    return this.storeId;
  }

  /**
   * Получить жалобы для магазина с пагинацией
   * @param {string} [storeId] - ID магазина (опционально, используется текущий storeId)
   * @param {Object} options - Опции пагинации
   * @param {number} [options.skip=0] - Пропустить записей
   * @param {number} [options.take=100] - Взять записей
   * @returns {Promise<Array>} - Массив жалоб с дополнительными полями (reviewKey, complaintData, reviewDateFormatted)
   * @throws {Error} При ошибке сети или API
   */
  async getComplaints(storeId, { skip = 0, take = 100 } = {}) {
    await this.initialize();

    // Если storeId не указан, используем текущий
    const targetStoreId = storeId || this.storeId;
    // ✅ Обновлено согласно BACKEND_DATA_RESPONSE.md (2026-01-29)
    // Backend поддерживает: limit, filter, rating (НЕ skip/take)
    const url = `${this.baseURL}/api/extension/stores/${targetStoreId}/complaints?limit=${take}&filter=draft&rating=1,2,3`;

    const response = await fetchWithRetry(
      url,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
      },
      {
        maxRetries: 3,
        baseDelay: 1000,
        shouldRetry: (res) => res.status === 503
      }
    );

    // Проверяем rate limit headers
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
    const rateLimitLimit = response.headers.get('X-RateLimit-Limit');
    const rateLimitReset = response.headers.get('X-RateLimit-Reset');

    if (rateLimitRemaining && parseInt(rateLimitRemaining) < 10) {
      console.warn(`[PilotAPI] Rate limit warning: ${rateLimitRemaining} запросов осталось`);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[PilotAPI] ❌ Ошибка HTTP:', response.status, errorText);

      // Специальная обработка ошибок
      if (response.status === 401) {
        throw new Error('Ошибка авторизации: проверьте Backend Token в настройках');
      } else if (response.status === 404) {
        throw new Error('Магазин не найден: проверьте Store ID в настройках');
      } else if (response.status === 429) {
        throw new Error('Превышен лимит запросов. Пожалуйста, подождите.');
      }

      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }

    const data = await response.json();

    // ✅ API теперь возвращает объект: { complaints: [], total: N, stats: {...} }
    // Извлекаем массив complaints
    const complaints = data.complaints || data; // Fallback на старый формат (массив)

    // Обработка жалоб: парсинг complaintText, генерация reviewKey, форматирование дат
    const processed = processComplaints(complaints);

    return processed;
  }

  /**
   * Отметить жалобу как отправленную в WB
   * @param {string} [storeId] - ID магазина (опционально, используется текущий storeId)
   * @param {string} reviewId - ID отзыва
   * @param {Object} [metadata] - Дополнительная информация
   * @param {string} [metadata.sentAt] - Время отправки (ISO 8601)
   * @param {number} [metadata.duration] - Длительность отправки в секундах
   * @returns {Promise<Object>}
   * @throws {Error} При ошибке сети или API
   */
  async markComplaintAsSent(storeId, reviewId, metadata = {}) {
    await this.initialize();

    // Если storeId не указан, используем текущий
    const targetStoreId = storeId || this.storeId;
    // ВАЖНО: Используем /api/extension/... endpoint (исправлено 2026-02-03)
    const url = `${this.baseURL}/api/extension/stores/${targetStoreId}/reviews/${reviewId}/complaint/sent`;

    const body = {
      sentAt: metadata.sentAt || new Date().toISOString(),
      duration: metadata.duration || 0
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Не удалось получить тело ответа');

      // Специальная обработка для идемпотентности (409 ALREADY_SENT)
      if (response.status === 409) {
        return {
          success: true,
          message: 'Complaint already sent',
          duplicate: true,
          reviewId
        };
      }

      console.error(`[PilotAPI] ❌ Ошибка HTTP при отправке жалобы:`, {
        status: response.status,
        statusText: response.statusText,
        storeId: targetStoreId,
        reviewId,
        url,
        errorBody
      });

      // Специальная обработка ошибок
      if (response.status === 401) {
        throw new Error('Ошибка авторизации: проверьте Backend Token в настройках');
      } else if (response.status === 404) {
        throw new Error('Отзыв не найден в базе данных');
      }

      throw new Error(`HTTP ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Health check - проверка работоспособности API
   * @returns {Promise<Object>} - Статус API
   */
  async healthCheck() {
    await this.initialize();

    const url = `${this.baseURL}/api/health`;

    const response = await fetch(url, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Health check failed: HTTP ${response.status}`);
    }

    const health = await response.json();
    return health;
  }
}

// Экспортируем singleton
export const pilotAPI = new PilotAPI();
