/**
 * Handler для операций с жалобами
 * Обрабатывает запросы getComplaints и sendComplaint
 *
 * @version 1.2.0
 * @description Координирует получение жалоб из API и отметку их как отправленных
 */

import { pilotAPI } from '../../api/pilot-api.js';
import { apiSessionTracker } from '../../services/api-session-tracker.js';

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

    console.log('[ComplaintsHandler] Запрос жалоб:', { storeId, skip, take });

    try {
      const data = await pilotAPI.getComplaints(storeId, { skip, take });

      // Записываем в трекер для отчетов
      if (data && Array.isArray(data)) {
        // Если это первый батч (skip = 0) - начинаем новую сессию
        if (skip === 0) {
          apiSessionTracker.startSession(storeId);
        }

        const batchNumber = Math.floor(skip / take);
        apiSessionTracker.recordReceivedComplaints(batchNumber, skip, take, data);
      }

      console.log('[ComplaintsHandler] ✅ Жалобы получены:', data?.length || 0);
      return { data };

    } catch (err) {
      console.error('[ComplaintsHandler] ❌ Ошибка запроса:', err);
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

    console.log('[ComplaintsHandler] 📥 Получен запрос sendComplaint:', { storeId, reviewId });

    if (!storeId || !reviewId) {
      console.error('[ComplaintsHandler] ❌ Недостаточно параметров:', { storeId, reviewId });
      return { error: 'storeId и reviewId обязательны' };
    }

    console.log('[ComplaintsHandler] 🔄 Вызываем pilotAPI.markComplaintAsSent...');

    try {
      const data = await pilotAPI.markComplaintAsSent(storeId, reviewId);
      console.log('[ComplaintsHandler] ✅ API ответ:', data);

      // Записываем успешную отправку в трекер
      apiSessionTracker.recordSentComplaint(reviewId, true, 200);

      console.log('[ComplaintsHandler] ✅ Жалоба отправлена:', reviewId);
      return { data };

    } catch (err) {
      console.error('[ComplaintsHandler] ❌ Ошибка при отправке жалобы:', err);

      // Пытаемся извлечь HTTP статус из ошибки
      const statusMatch = err.message.match(/HTTP (\d+)/);
      const status = statusMatch ? parseInt(statusMatch[1]) : 0;

      // Записываем неудачную попытку в трекер
      apiSessionTracker.recordSentComplaint(reviewId, false, status);

      return { error: err.message };
    }
  }
}
