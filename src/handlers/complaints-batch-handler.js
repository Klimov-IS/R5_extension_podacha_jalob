/**
 * Обработчик батчей жалоб
 * Загрузка следующих батчей, фильтрация, отправка на обработку
 *
 * @version 1.0.0
 */

import { BATCH_SIZE, MAX_EMPTY_BATCHES, EMPTY_BATCH_DELAY } from '../config/complaints-config.js';
import { complaintsLogger } from '../services/complaints-logger-service.js';
import { complaintsAPIService } from '../services/complaints-api-service.js';
import { filterComplaints } from '../utils/complaints-filters.js';

/**
 * Обработчик для управления батчами жалоб
 */
export class ComplaintsBatchHandler {
  constructor() {
    this.currentBatch = 0;
    this.totalProcessedGlobal = 0;
    this.totalSentGlobal = 0;
    this.consecutiveEmptyBatches = 0;
    this.batchesHistory = [];
    this.isProcessing = false;
    this.previewData = null;
  }

  /**
   * Сброс состояния для новой сессии
   */
  reset() {
    this.currentBatch = 0;
    this.totalProcessedGlobal = 0;
    this.totalSentGlobal = 0;
    this.consecutiveEmptyBatches = 0;
    this.batchesHistory = [];
    this.isProcessing = false;
    this.previewData = null;

    complaintsLogger.info('🔄 Состояние батчей сброшено');
  }

  /**
   * Сохранить данные превью
   * @param {Object} data - Данные превью
   */
  setPreviewData(data) {
    this.previewData = data;
  }

  /**
   * Загрузка следующего батча
   * @returns {Promise<Object>} - Результат загрузки
   */
  async loadNextBatch() {
    if (!this.previewData) {
      throw new Error('Нет данных для загрузки следующего пакета');
    }

    try {
      const skip = this.currentBatch * BATCH_SIZE;
      complaintsLogger.info(`📡 Запрос к API: skip=${skip}, take=${BATCH_SIZE}`);

      // Загружаем жалобы из API
      const result = await complaintsAPIService.loadComplaints(
        this.previewData.selectedStore,
        skip,
        BATCH_SIZE,
        'draft',
        this.previewData.checkedStars
      );

      const allComplaints = result.data;

      // Если пришло 0 жалоб - значит больше нет
      if (allComplaints.length === 0) {
        complaintsLogger.success(`🎉 Все жалобы обработаны! Больше нет данных в API.`);
        complaintsLogger.info(`📊 Итого за сессию: обработано ${this.totalProcessedGlobal}, отправлено ${this.totalSentGlobal}`);
        this.isProcessing = false;
        return { hasMore: false, complaints: [] };
      }

      // Если пришло меньше чем BATCH_SIZE - это последний батч
      if (allComplaints.length < BATCH_SIZE) {
        complaintsLogger.info(`ℹ️ Получен неполный батч (${allComplaints.length}/${BATCH_SIZE}) - возможно это последняя порция`);
      }

      // Фильтруем жалобы
      const filterOptions = {
        articles: this.previewData.isFilterByArticles ? this.previewData.articlesArray : [],
        stars: this.previewData.checkedStars
      };

      const filtered = filterComplaints(allComplaints, filterOptions);

      complaintsLogger.info(`🔍 После фильтрации: ${filtered.filtered.length} жалоб`);

      // Логируем слишком длинные тексты
      if (filtered.tooLong.length > 0) {
        complaintsLogger.warn(`⚠️ Слишком длинных текстов: ${filtered.tooLong.length}`);
        const top3 = filtered.tooLong.slice(0, 3);
        top3.forEach(item => {
          complaintsLogger.warn(`    📦 Арт ${item.productId}, ID ${item.id}: ${item.length} символов`);
        });
      }

      // Если после фильтрации ничего не осталось - загружаем следующий пакет
      if (filtered.filtered.length === 0) {
        this.consecutiveEmptyBatches++;
        complaintsLogger.warn(`⚠️ В пакете #${this.currentBatch + 1} нет подходящих жалоб, пропускаем... (${this.consecutiveEmptyBatches}/${MAX_EMPTY_BATCHES})`);

        // Проверяем лимит пустых пакетов
        if (this.consecutiveEmptyBatches >= MAX_EMPTY_BATCHES) {
          complaintsLogger.error(`❌ Достигнут лимит пустых пакетов (${MAX_EMPTY_BATCHES}). Останавливаем обработку.`);
          complaintsLogger.info(`💡 Возможно, все жалобы обработаны или фильтры слишком строгие`);
          this.isProcessing = false;
          return { hasMore: false, complaints: [] };
        }

        // Ждем перед следующим запросом
        complaintsLogger.info(`⏱️ Задержка ${EMPTY_BATCH_DELAY}ms перед следующим запросом...`);
        await new Promise(resolve => setTimeout(resolve, EMPTY_BATCH_DELAY));

        this.currentBatch++;
        return await this.loadNextBatch(); // Рекурсивный вызов
      }

      // Если есть жалобы - сбрасываем счетчик пустых пакетов
      this.consecutiveEmptyBatches = 0;

      return {
        hasMore: true,
        complaints: filtered.filtered,
        stats: filtered.stats
      };

    } catch (error) {
      console.error('[BatchHandler] ❌ Ошибка загрузки следующего пакета:', error);
      complaintsLogger.error(`❌ Ошибка: ${error.message}`);
      this.isProcessing = false;
      throw error;
    }
  }

  /**
   * Добавить батч в историю
   * @param {Object} stats - Статистика батча
   */
  addBatchToHistory(stats) {
    this.batchesHistory.push({
      batchNumber: this.currentBatch,
      processed: stats.processed || 0,
      sent: stats.sent || 0,
      notFound: stats.notFound || 0,
      errors: stats.errors || 0,
      timestamp: new Date().toLocaleTimeString('ru-RU')
    });

    // Обновляем глобальные счетчики
    this.totalProcessedGlobal += stats.processed || 0;
    this.totalSentGlobal += stats.sent || 0;

    complaintsLogger.info(`📊 Батч #${this.currentBatch + 1} добавлен в историю`);
  }

  /**
   * Получить итоговую статистику
   * @returns {Object}
   */
  getFinalStats() {
    const totalNotFound = this.batchesHistory.reduce((sum, b) => sum + (b.notFound || 0), 0);
    const totalErrors = this.batchesHistory.reduce((sum, b) => sum + (b.errors || 0), 0);

    return {
      totalBatches: this.batchesHistory.length,
      totalProcessed: this.totalProcessedGlobal,
      totalSent: this.totalSentGlobal,
      totalNotFound,
      totalErrors,
      batchesHistory: this.batchesHistory
    };
  }

  /**
   * Остановить обработку
   */
  stop() {
    this.isProcessing = false;
    complaintsLogger.warn('⏹️ Обработка остановлена пользователем');
  }

  /**
   * Проверка, идет ли обработка
   * @returns {boolean}
   */
  isRunning() {
    return this.isProcessing;
  }

  /**
   * Запуск обработки
   */
  start() {
    this.isProcessing = true;
    complaintsLogger.info('▶️ Обработка запущена');
  }
}

/**
 * Singleton экземпляр batch handler
 */
export const complaintsBatchHandler = new ComplaintsBatchHandler();
