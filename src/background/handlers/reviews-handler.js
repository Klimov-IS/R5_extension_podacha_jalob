/**
 * Handler для операций с отзывами
 * Обрабатывает запрос sendReviewsToAPI (отправка спарсенных отзывов)
 *
 * @version 1.2.0
 * @description Отправляет спарсенные отзывы на внешний API
 */

import { externalAPI } from '../../api/external-api.js';

/**
 * Handler для операций с отзывами
 */
export class ReviewsHandler {
  /**
   * Отправить спарсенные отзывы на External API
   * @param {Object} message - Сообщение
   * @param {Object} message.data - Данные отзывов
   * @param {Array} message.data.reviews - Массив отзывов
   * @param {Object} message.data.stats - Статистика парсинга
   * @returns {Promise<Object>} { success: boolean, data?: Object, error?: string }
   */
  async sendReviews(message) {
    const { data } = message;

    if (!data || !data.reviews) {
      console.error('[ReviewsHandler] ❌ Недостаточно данных');
      return { success: false, error: 'Данные отзывов обязательны' };
    }

    console.log('[ReviewsHandler] Отправка отзывов на External API:', {
      reviewsCount: data.reviews.length,
      stats: data.stats
    });

    try {
      const result = await externalAPI.sendReviews(data);

      console.log('[ReviewsHandler] ✅ Отзывы отправлены:', result);
      return result;

    } catch (err) {
      console.error('[ReviewsHandler] ❌ Ошибка отправки отзывов:', err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Проверить подключение к External API
   * @returns {Promise<Object>}
   */
  async testConnection() {
    console.log('[ReviewsHandler] Тест подключения к External API');

    try {
      const result = await externalAPI.testConnection();
      console.log('[ReviewsHandler] ✅ Тест подключения:', result);
      return { data: result };

    } catch (err) {
      console.error('[ReviewsHandler] ❌ Ошибка тестирования:', err);
      return { error: err.message };
    }
  }
}
