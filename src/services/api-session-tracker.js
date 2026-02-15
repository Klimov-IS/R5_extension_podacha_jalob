/**
 * Трекер API сессий
 * Отслеживает полученные и отправленные жалобы для отчётов
 *
 * @version 1.0.0
 * @description Записывает статистику работы с Backend API
 */

/**
 * Класс для отслеживания API сессий
 */
class APISessionTracker {
  constructor() {
    this.reset();
  }

  /**
   * Сбросить все данные сессии
   */
  reset() {
    this.session = {
      storeId: null,
      startTime: null,
      endTime: null,
      totalReceived: 0,
      totalSent: 0,
      successCount: 0,
      failedCount: 0
    };

    this.batches = [];
    this.sentComplaints = [];

    // [APISessionTracker] Сессия сброшена');
  }

  /**
   * Начать новую сессию
   * @param {string} storeId - ID магазина
   */
  startSession(storeId) {
    this.reset();
    this.session.storeId = storeId;
    this.session.startTime = new Date().toISOString();

    // [APISessionTracker] Сессия начата:', {
      storeId,
      startTime: this.session.startTime
    });
  }

  /**
   * Записать полученные жалобы (батч)
   * @param {number} batchNumber - Номер батча
   * @param {number} skip - Смещение
   * @param {number} take - Количество
   * @param {Array} data - Массив жалоб
   */
  recordReceivedComplaints(batchNumber, skip, take, data) {
    const count = data?.length || 0;

    const batch = {
      batchNumber,
      skip,
      take,
      received: count,
      timestamp: new Date().toISOString()
    };

    this.batches.push(batch);
    this.session.totalReceived += count;

    // [APISessionTracker] Батч записан:', batch);
  }

  /**
   * Записать отправленную жалобу
   * @param {string} reviewId - ID отзыва
   * @param {boolean} success - Успешно ли
   * @param {number} status - HTTP статус
   */
  recordSentComplaint(reviewId, success, status) {
    const record = {
      reviewId,
      success,
      status,
      timestamp: new Date().toISOString()
    };

    this.sentComplaints.push(record);
    this.session.totalSent++;

    if (success) {
      this.session.successCount++;
    } else {
      this.session.failedCount++;
    }

    // [APISessionTracker] Жалоба записана:', record);
  }

  /**
   * Завершить сессию
   */
  endSession() {
    this.session.endTime = new Date().toISOString();

    // [APISessionTracker] Сессия завершена:', {
      duration: this.getSessionDuration(),
      totalReceived: this.session.totalReceived,
      totalSent: this.session.totalSent
    });
  }

  /**
   * Получить длительность сессии в секундах
   * @returns {number}
   */
  getSessionDuration() {
    if (!this.session.startTime) return 0;

    const start = new Date(this.session.startTime);
    const end = this.session.endTime ? new Date(this.session.endTime) : new Date();

    return Math.round((end - start) / 1000);
  }

  /**
   * Получить текущее состояние сессии
   * @returns {Object}
   */
  getCurrentState() {
    return {
      isActive: !!this.session.startTime && !this.session.endTime,
      storeId: this.session.storeId,
      duration: this.getSessionDuration(),
      received: this.session.totalReceived,
      sent: this.session.totalSent,
      pending: this.session.totalReceived - this.session.totalSent
    };
  }

  /**
   * Сгенерировать отчёт о сессии
   * @returns {Object}
   */
  generateReport() {
    const successRate = this.session.totalSent > 0
      ? Math.round((this.session.successCount / this.session.totalSent) * 100)
      : 0;

    const report = {
      sessionInfo: {
        storeId: this.session.storeId,
        startTime: this.session.startTime,
        endTime: this.session.endTime,
        durationSeconds: this.getSessionDuration(),
        totalReceived: this.session.totalReceived,
        totalSent: this.session.totalSent,
        successCount: this.session.successCount,
        failedCount: this.session.failedCount,
        successRate: `${successRate}%`
      },
      batches: this.batches,
      sentDetails: this.sentComplaints.slice(-50) // Последние 50 записей
    };

    // [APISessionTracker] Отчёт сгенерирован:', report.sessionInfo);

    return report;
  }
}

// Экспортируем singleton
export const apiSessionTracker = new APISessionTracker();
