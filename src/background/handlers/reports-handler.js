/**
 * Handler для операций с отчетами
 * Обрабатывает запросы getAPIReport и resetAPISession
 *
 * @version 1.2.0
 * @description Генерирует отчеты о работе с API и управляет сессиями
 */

import { apiSessionTracker } from '../../services/api-session-tracker.js';

/**
 * Handler для операций с отчетами
 */
export class ReportsHandler {
  /**
   * Получить отчет о текущей API сессии
   * @returns {Promise<Object>} { data: Object } - Детальный отчет
   */
  async getAPIReport() {
    console.log('[ReportsHandler] Запрос отчета API сессии');

    try {
      // Завершаем сессию перед генерацией отчета
      apiSessionTracker.endSession();

      // Генерируем отчет
      const report = apiSessionTracker.generateReport();

      console.log('[ReportsHandler] ✅ Отчет сформирован:', {
        batches: report.batches.length,
        received: report.sessionInfo.totalReceived,
        sent: report.sessionInfo.totalSent
      });

      return { data: report };

    } catch (err) {
      console.error('[ReportsHandler] ❌ Ошибка формирования отчета:', err);
      return { error: err.message };
    }
  }

  /**
   * Сбросить текущую API сессию
   * @returns {Promise<Object>} { success: boolean }
   */
  async resetAPISession() {
    console.log('[ReportsHandler] Сброс API сессии');

    try {
      apiSessionTracker.reset();
      console.log('[ReportsHandler] ✅ Сессия сброшена');
      return { success: true };

    } catch (err) {
      console.error('[ReportsHandler] ❌ Ошибка сброса сессии:', err);
      return { error: err.message };
    }
  }

  /**
   * Получить текущее состояние сессии
   * @returns {Promise<Object>} { data: Object }
   */
  async getSessionState() {
    console.log('[ReportsHandler] Запрос состояния сессии');

    try {
      const state = apiSessionTracker.getCurrentState();
      console.log('[ReportsHandler] ✅ Состояние:', state);
      return { data: state };

    } catch (err) {
      console.error('[ReportsHandler] ❌ Ошибка получения состояния:', err);
      return { error: err.message };
    }
  }
}
