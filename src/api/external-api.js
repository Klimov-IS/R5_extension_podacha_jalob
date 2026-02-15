/**
 * API клиент для External API
 * Отправка спарсенных отзывов на внешний сервер
 *
 * @version 1.2.0
 * @description Отправка отзывов из парсера на внешний API для обработки
 */

import { settingsService } from '../services/settings-service.js';

/**
 * API клиент для External API (отправка отзывов)
 */
class ExternalAPI {
  /**
   * Отправить отзывы на внешний API
   * @param {Object} data - Данные отзывов
   * @param {Array} data.reviews - Массив отзывов
   * @param {Object} data.stats - Статистика парсинга
   * @returns {Promise<Object>}
   */
  async sendReviews(data) {
    const config = await settingsService.getExternalAPIConfig();

    // Если External API не настроен - MOCK режим
    if (!config) {
      await this._mockDelay(1000);

      return {
        success: true,
        data: {
          received: data.reviews?.length || 0,
          message: 'MOCK: Данные получены (External API не настроен)'
        }
      };
    }

    const url = `${config.url}/reviews`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.token}`,
        },
        body: JSON.stringify({
          reviews: data.reviews,
          stats: data.stats,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const result = await response.json();

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('[ExternalAPI] ❌ Ошибка отправки:', error);
      throw error;
    }
  }

  /**
   * Проверить подключение к External API
   * @returns {Promise<Object>}
   */
  async testConnection() {
    const config = await settingsService.getExternalAPIConfig();

    if (!config) {
      return {
        success: false,
        message: 'External API не настроен'
      };
    }

    try {
      const response = await fetch(`${config.url}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('[ExternalAPI] ❌ Ошибка проверки подключения:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Вспомогательная функция задержки для MOCK режима
   * @private
   * @param {number} ms - Миллисекунды
   * @returns {Promise<void>}
   */
  _mockDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Экспортируем singleton
export const externalAPI = new ExternalAPI();
