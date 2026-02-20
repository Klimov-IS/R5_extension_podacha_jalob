/**
 * StatusSyncService - сервис синхронизации статусов отзывов с Backend
 *
 * Отправляет статусы отзывов (спарсенные расширением) на Backend
 * для оптимизации генерации жалоб GPT (~80% экономии токенов).
 *
 * @see docs/Sprint-StatusSync/API-SPEC.md
 * @version 1.0.0
 */

import { settingsService } from './settings-service.js';

/**
 * Статусы жалоб, которые блокируют подачу новой жалобы
 */
const COMPLAINT_STATUSES = [
  'Жалоба отклонена',
  'Жалоба одобрена',
  'Проверяем жалобу',
  'Жалоба пересмотрена'
];

/**
 * Сервис синхронизации статусов отзывов с Backend
 */
export class StatusSyncService {
  constructor() {
    this.endpoint = '/api/extension/review-statuses';
    this.BATCH_SIZE = 100; // Лимит API: 100 отзывов за запрос
  }

  /**
   * Получить базовый URL из настроек
   * @private
   */
  async _getBaseURL() {
    return await settingsService.getBackendEndpoint();
  }

  /**
   * Получить токен из настроек
   * @private
   */
  async _getToken() {
    return await settingsService.getBackendToken();
  }

  /**
   * Синхронизировать статусы отзывов с Backend
   *
   * @param {string} storeId - ID магазина (наш внутренний)
   * @param {Array} reviews - массив отзывов с данными от DataExtractor
   * @returns {Promise<Object>} - результат синхронизации
   *
   * Формат входных данных (reviews):
   * [{
   *   productId: "649502497",
   *   rating: 1,
   *   reviewDate: "2026-01-07T20:09:37.000Z",
   *   key: "649502497_1_2026-01-07T20:09:37.000Z",
   *   statuses: ["Жалоба отклонена", "Выкуп"]
   * }]
   */
  async syncStatuses(storeId, reviews) {
    if (!storeId) {
      console.error('[StatusSync] ❌ storeId обязателен');
      return { success: false, error: 'storeId обязателен' };
    }

    if (!reviews || reviews.length === 0) {
      return { success: true, data: { received: 0, created: 0, updated: 0 } };
    }

    // Преобразуем отзывы в формат API
    const formattedReviews = reviews.map(r => this._formatReviewForAPI(r));

    // Разбиваем на батчи
    const batches = this._splitIntoBatches(formattedReviews, this.BATCH_SIZE);

    // Общая статистика
    const totalStats = {
      received: 0,
      created: 0,
      updated: 0,
      errors: 0
    };

    // Отправляем батчи
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      try {
        const result = await this._sendBatch(storeId, batch);

        if (result.success) {
          totalStats.received += result.data.received || 0;
          totalStats.created += result.data.created || 0;
          totalStats.updated += result.data.updated || 0;
        } else {
          totalStats.errors += batch.length;
          console.error(`[StatusSync] ❌ Батч ${i + 1} ошибка:`, result.error);
        }
      } catch (error) {
        totalStats.errors += batch.length;
        console.error(`[StatusSync] ❌ Батч ${i + 1} exception:`, error);
      }

      // Пауза между батчами (защита от rate limit)
      if (i < batches.length - 1) {
        await this._sleep(500);
      }
    }

    if (totalStats.errors > 0) {
      return {
        success: false,
        error: `Ошибки при синхронизации: ${totalStats.errors} из ${reviews.length}`,
        data: totalStats
      };
    }

    return {
      success: true,
      data: totalStats
    };
  }

  /**
   * Отправить один батч отзывов
   * @private
   */
  async _sendBatch(storeId, reviews) {
    const baseURL = await this._getBaseURL();
    const token = await this._getToken();
    const url = `${baseURL}${this.endpoint}`;

    const payload = {
      storeId: storeId,
      parsedAt: new Date().toISOString(),
      reviews: reviews
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error?.message || data.message || `HTTP ${response.status}`;
        console.error(`[StatusSync] ❌ HTTP Error ${response.status}:`, errorMsg, data);
        return {
          success: false,
          error: errorMsg
        };
      }

      return {
        success: true,
        data: data.data || data
      };

    } catch (error) {
      console.error(`[StatusSync] ❌ Network/Parse Error:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Форматировать отзыв для API
   * @private
   */
  _formatReviewForAPI(review) {
    const statuses = review.statuses || [];

    return {
      reviewKey: this._normalizeReviewKey(review.key),
      productId: review.productId,
      rating: review.rating,
      reviewDate: review.reviewDate,
      statuses: statuses,
      canSubmitComplaint: this._canSubmitComplaint(statuses),
      chatStatus: review.chatStatus || null
    };
  }

  /**
   * Нормализовать ключ отзыва (убрать секунды)
   *
   * API ожидает формат: "productId_rating_2026-01-07T20:09"
   * DataExtractor возвращает: "productId_rating_2026-01-07T20:09:37.000Z"
   *
   * @private
   */
  _normalizeReviewKey(key) {
    if (!key) return key;
    // Убираем секунды и миллисекунды из timestamp
    // "649502497_1_2026-01-07T20:09:37.000Z" → "649502497_1_2026-01-07T20:09"
    return key.replace(/T(\d{2}:\d{2}):\d{2}\.\d{3}Z$/, 'T$1');
  }

  /**
   * Определить, можно ли подать жалобу на отзыв
   *
   * Можно подать = НЕТ ни одного статуса жалобы
   *
   * @private
   */
  _canSubmitComplaint(statuses) {
    if (!statuses || statuses.length === 0) return true;
    return !statuses.some(s => COMPLAINT_STATUSES.includes(s));
  }

  /**
   * Разбить массив на батчи
   * @private
   */
  _splitIntoBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Пауза
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Получить статусы из Backend (для тестирования)
   *
   * @param {string} storeId - ID магазина
   * @param {Object} options - опции запроса
   * @returns {Promise<Object>}
   */
  async getStatuses(storeId, options = {}) {
    const { limit = 50, canSubmit = 'all' } = options;

    const baseURL = await this._getBaseURL();
    const token = await this._getToken();
    const url = `${baseURL}${this.endpoint}?storeId=${storeId}&limit=${limit}&canSubmit=${canSubmit}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || `HTTP ${response.status}`
        };
      }

      return {
        success: true,
        data: data.data || data
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * Singleton экземпляр сервиса
 */
export const statusSyncService = new StatusSyncService();
