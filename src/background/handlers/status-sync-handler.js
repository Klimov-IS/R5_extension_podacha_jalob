/**
 * StatusSyncHandler - обработчик синхронизации статусов отзывов
 *
 * Обрабатывает сообщения от content scripts для отправки
 * статусов отзывов в Backend API.
 *
 * @see docs/Sprint-StatusSync/API-SPEC.md
 * @version 1.0.0
 */

import { statusSyncService } from '../../services/status-sync-service.js';

/**
 * Handler для синхронизации статусов
 */
export class StatusSyncHandler {
  constructor() {
  }

  /**
   * Синхронизировать статусы отзывов с Backend
   *
   * @param {Object} message - сообщение от content script
   * @param {string} message.storeId - ID магазина
   * @param {Array} message.reviews - массив отзывов со статусами
   * @returns {Promise<Object>} - результат синхронизации
   */
  async syncStatuses(message) {
    const { storeId, reviews, notFoundReviewKeys } = message;

    if (!storeId) {
      return {
        success: false,
        error: 'storeId обязателен'
      };
    }

    if ((!reviews || reviews.length === 0) && (!notFoundReviewKeys || notFoundReviewKeys.length === 0)) {
      return {
        success: true,
        data: { received: 0, created: 0, updated: 0 }
      };
    }

    try {
      const result = await statusSyncService.syncStatuses(storeId, reviews || [], notFoundReviewKeys);
      return result;
    } catch (error) {
      console.error(`[StatusSyncHandler] ❌ Ошибка синхронизации:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получить синхронизированные статусы из Backend (для тестирования)
   *
   * @param {Object} message - сообщение
   * @param {string} message.storeId - ID магазина
   * @param {number} message.limit - лимит записей
   * @param {string} message.canSubmit - фильтр ('true', 'false', 'all')
   * @returns {Promise<Object>}
   */
  async getStatuses(message) {
    const { storeId, limit, canSubmit } = message;

    if (!storeId) {
      return {
        success: false,
        error: 'storeId обязателен'
      };
    }

    try {
      const result = await statusSyncService.getStatuses(storeId, { limit, canSubmit });
      return result;
    } catch (error) {
      console.error(`[StatusSyncHandler] ❌ Ошибка получения статусов:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
