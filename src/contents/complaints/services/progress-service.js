/**
 * ProgressService - отслеживание прогресса обработки жалоб
 *
 * Этот модуль отвечает за:
 * - Отправку прогресса в UI (complaints-page.js)
 * - Логирование в UI
 * - Отслеживание статистики (обработано, успешно, ошибки)
 *
 * @module services/progress-service
 * @since 1.3.0 (28.01.2026)
 */

'use strict';

/**
 * Сервис отслеживания прогресса
   */
  class ProgressService {
    constructor() {
      this.processed = 0;
      this.sent = 0;
      this.skipped = 0;
      this.errors = 0;
      this.totalComplaints = 0;
    }

    /**
     * Инициализировать счетчики
     *
     * @param {number} total - общее количество жалоб
     */
    init(total) {
      this.processed = 0;
      this.sent = 0;
      this.skipped = 0;
      this.errors = 0;
      this.totalComplaints = total;
    }

    /**
     * Отправить прогресс в UI
     * Использует CustomEvent bridge для отправки из MAIN world в ISOLATED world
     */
    sendProgress() {
      // MAIN world → ISOLATED world bridge
      window.dispatchEvent(new CustomEvent('wb-send-message', {
        detail: {
          type: "complaintProgress",
          data: {
            processed: this.processed,
            sent: this.sent,
            skipped: this.skipped,
            errors: this.errors,
            total: this.totalComplaints
          }
        }
      }));
    }

    /**
     * Логирование в UI
     * Использует CustomEvent bridge для отправки из MAIN world в ISOLATED world
     *
     * @param {string} level - уровень лога (info, warn, error, success)
     * @param {string} message - сообщение
     */
    log(level, message) {
      console.log(message);

      // MAIN world → ISOLATED world bridge
      window.dispatchEvent(new CustomEvent('wb-send-message', {
        detail: {
          type: "complaintLog",
          data: {
            level: level,
            message: message,
            timestamp: new Date().toLocaleTimeString('ru-RU')
          }
        }
      }));
    }

    /**
     * Увеличить счетчик обработанных
     */
    incrementProcessed() {
      this.processed++;
      this.sendProgress();
    }

    /**
     * Увеличить счетчик успешных
     */
    incrementSent() {
      this.sent++;
      this.processed++;
      this.sendProgress();
    }

    /**
     * Увеличить счетчик пропущенных
     */
    incrementSkipped() {
      this.skipped++;
      this.processed++;
      this.sendProgress();
    }

    /**
     * Увеличить счетчик ошибок
     */
    incrementErrors() {
      this.errors++;
      this.processed++;
      this.sendProgress();
    }

    /**
     * Получить текущую статистику
     *
     * @returns {Object} - объект со статистикой
     */
    getStats() {
      return {
        processed: this.processed,
        sent: this.sent,
        skipped: this.skipped,
        errors: this.errors,
        total: this.totalComplaints,
        remaining: this.totalComplaints - this.processed
      };
    }

    /**
     * Отправить финальную статистику
     *
     * @param {Date} startTime - время начала обработки
     */
    sendFinalStats(startTime) {
      const endTime = new Date();
      const duration = Math.round((endTime - startTime) / 1000); // в секундах

      const stats = this.getStats();

      this.log("success", `\n========================================`);
      this.log("success", `✅ Обработка завершена за ${duration} секунд`);
      this.log("success", `📊 Статистика:`);
      this.log("success", `   • Всего: ${stats.total}`);
      this.log("success", `   • Обработано: ${stats.processed}`);
      this.log("success", `   • Успешно: ${stats.sent}`);
      this.log("success", `   • Пропущено: ${stats.skipped}`);
      this.log("success", `   • Ошибок: ${stats.errors}`);
      this.log("success", `========================================\n`);

      // Отправляем финальное сообщение через bridge
      window.dispatchEvent(new CustomEvent('wb-send-message', {
        detail: {
          type: "complaintComplete",
          data: {
            stats: stats,
            duration: duration,
            timestamp: endTime.toISOString()
          }
        }
      }));
    }
  }

  // Создаем глобальный экземпляр для использования в handlers
  window.ProgressService = ProgressService;

console.log('[ProgressService] Модуль успешно загружен');
