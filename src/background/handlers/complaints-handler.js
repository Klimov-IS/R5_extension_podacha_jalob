/**
 * Handler для операций с жалобами
 * Обрабатывает запросы getComplaints и sendComplaint
 *
 * @version 1.2.0
 * @description Координирует получение жалоб из API и отметку их как отправленных
 */

import { pilotAPI } from '../../api/pilot-api.js';

/**
 * Handler для операций с жалобами
 */
export class ComplaintsHandler {
  /**
   * Получить жалобы из Pilot Entry API
   * @param {Object} message - Сообщение
   * @param {string} message.storeId - ID магазина
   * @param {number} [message.skip=0] - Пропустить записей
   * @param {number} [message.take=100] - Взять записей
   * @returns {Promise<Object>} { data: Array } или { error: string }
   */
  async getComplaints(message) {
    const { storeId, skip = 0, take = 100 } = message;

    try {
      const data = await pilotAPI.getComplaints(storeId, { skip, take });
      return { data };

    } catch (err) {
      console.error('[ComplaintsHandler] ❌ Ошибка запроса:', err);
      return { error: err.message };
    }
  }

  /**
   * Получить единый список задач для магазина (Unified Tasks API)
   * @param {Object} message
   * @param {string} message.storeId - ID магазина
   * @returns {Promise<Object>} { data: Object } или { error: string }
   */
  async getTasks(message) {
    const { storeId } = message;

    try {
      const data = await pilotAPI.getTasks(storeId);
      return { data };
    } catch (err) {
      console.error('[ComplaintsHandler] getTasks error:', err);
      return { error: err.message };
    }
  }

  /**
   * Отметить жалобу как отправленную в WB
   * @param {Object} message - Сообщение
   * @param {string} message.storeId - ID магазина
   * @param {string} message.reviewId - ID отзыва
   * @returns {Promise<Object>} { data: Object } или { error: string }
   */
  async sendComplaint(message) {
    const { storeId, reviewId } = message;

    if (!storeId || !reviewId) {
      console.error('[ComplaintsHandler] ❌ Недостаточно параметров:', { storeId, reviewId });
      return { error: 'storeId и reviewId обязательны' };
    }

    try {
      const data = await pilotAPI.markComplaintAsSent(storeId, reviewId);
      return { data };

    } catch (err) {
      console.error('[ComplaintsHandler] ❌ Ошибка при отправке жалобы:', err);
      return { error: err.message };
    }
  }
}
