/**
 * Сервис для работы с Backend API
 * Загрузка жалоб, отметка отправленных
 *
 * @version 1.0.1 - Fixed API response format handling (complaints.map bug)
 */

import { BACKEND_ENDPOINT, BACKEND_TOKEN, BATCH_SIZE } from '../config/complaints-config.js';
import { complaintsLogger } from './complaints-logger-service.js';
import { parseComplaintText } from '../utils/complaints-parser.js';

/**
 * Сервис для работы с Backend API жалоб
 */
export class ComplaintsAPIService {
  constructor() {
    this.baseURL = BACKEND_ENDPOINT;
    this.token = BACKEND_TOKEN;
  }

  /**
   * Загрузка жалоб из Backend API
   * @param {string} storeId - ID магазина
   * @param {number} skip - Сколько пропустить (НЕ используется Backend API)
   * @param {number} take - Сколько загрузить (используется как limit)
   * @param {string} filter - Фильтр: 'draft' или 'all'
   * @param {Array<number>} ratings - Массив рейтингов для фильтрации (1-5)
   * @returns {Promise<Object>} - { data: Array, total: number, stats: Object }
   */
  async loadComplaints(storeId, skip = 0, take = BATCH_SIZE, filter = 'draft', ratings = [1, 2, 3]) {
    try {
      const ratingsParam = ratings.join(',');
      const url = `${this.baseURL}/api/extension/stores/${storeId}/complaints?limit=${take}&filter=${filter}&rating=${ratingsParam}`;

      console.log('[APIService] 📡 Запрос жалоб:', {
        storeId,
        skip,
        take,
        url,
        token: this.token
      });

      complaintsLogger.info(`📡 Загрузка батча #${Math.floor(skip / take)} (skip: ${skip}, take: ${take})...`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('[APIService] 📥 Ответ сервера:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Backend API возвращает объект { complaints: [], total: number, stats: {} }
      const complaints = data.complaints || [];
      console.log('[APIService] ✅ Получено жалоб от API:', complaints.length);
      console.log('[APIService] 📊 Всего жалоб (total):', data.total);
      console.log('[APIService] 📊 Статистика:', data.stats);

      // Обработка жалоб (парсинг complaintText, добавление уникальных ключей)
      const processedComplaints = this._processComplaints(complaints);

      complaintsLogger.success(`✅ Загружено ${processedComplaints.length} жалоб`);

      return {
        data: processedComplaints,
        total: data.total || processedComplaints.length,  // Используем total из API
        stats: data.stats || {}  // Добавляем статистику из API
      };

    } catch (error) {
      console.error('[APIService] ❌ Ошибка загрузки жалоб:', error);
      complaintsLogger.error(`❌ Ошибка загрузки жалоб: ${error.message}`);
      throw error;
    }
  }

  /**
   * Обработка жалоб после загрузки
   * @private
   * @param {Array} complaints - Массив жалоб
   * @returns {Array} - Обработанные жалобы
   */
  _processComplaints(complaints) {
    let withKeys = 0;
    let withParsedData = 0;

    const processed = complaints.map(complaint => {
      try {
        // Парсим complaintText
        const parsed = parseComplaintText(complaint.complaintText);

        // Добавляем распарсенные поля
        complaint.parsedComplaintText = parsed.complaintText;
        complaint.reasonName = parsed.reasonName;
        complaint.reasonId = parsed.reasonId;

        withParsedData++;

        // Создаем уникальный ключ
        complaint.uniqueKey = this._generateUniqueKey(complaint);
        withKeys++;

        return complaint;
      } catch (error) {
        console.error('[APIService] ⚠️ Ошибка обработки жалобы:', complaint.id, error);
        return complaint; // Возвращаем как есть
      }
    });

    console.log('[APIService] ✅ Жалобы обработаны:', {
      total: complaints.length,
      withKeys,
      withParsedData
    });

    return processed;
  }

  /**
   * Генерация уникального ключа для жалобы
   * Формат: productId_rating_datetime
   * @private
   */
  _generateUniqueKey(complaint) {
    return `${complaint.productId}_${complaint.rating}_${complaint.datetime}`;
  }

  /**
   * Отметка жалобы как отправленной
   * @param {string} storeId - ID магазина
   * @param {string} reviewId - ID отзыва
   * @returns {Promise<boolean>} - true если успешно
   */
  async markComplaintAsSent(storeId, reviewId) {
    try {
      const url = `${this.baseURL}/api/extension/stores/${storeId}/complaints/${reviewId}/sent`;

      console.log('[APIService] 📤 Отметка жалобы как отправленной:', { storeId, reviewId });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('[APIService] ✅ Жалоба отмечена как отправленная:', reviewId);
      return true;

    } catch (error) {
      console.error('[APIService] ❌ Ошибка отметки жалобы:', error);
      // Не бросаем ошибку, чтобы не останавливать обработку
      return false;
    }
  }

  /**
   * Пакетная отметка жалоб как отправленных
   * @param {string} storeId - ID магазина
   * @param {Array<string>} reviewIds - Массив ID отзывов
   * @returns {Promise<Object>} - { success: number, failed: number }
   */
  async markComplaintsAsSent(storeId, reviewIds) {
    let success = 0;
    let failed = 0;

    complaintsLogger.info(`📤 Отмечаем ${reviewIds.length} жалоб как отправленные...`);

    for (const reviewId of reviewIds) {
      const result = await this.markComplaintAsSent(storeId, reviewId);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    complaintsLogger.info(`✅ Отмечено: ${success} успешно, ${failed} ошибок`);

    return { success, failed };
  }

  /**
   * Получение статистики по жалобам
   * @param {string} storeId - ID магазина
   * @returns {Promise<Object>} - Статистика
   */
  async getComplaintsStats(storeId) {
    try {
      const url = `${this.baseURL}/api/extension/stores/${storeId}/complaints/stats`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const stats = await response.json();
      console.log('[APIService] 📊 Статистика жалоб:', stats);

      return stats;

    } catch (error) {
      console.error('[APIService] ❌ Ошибка получения статистики:', error);
      return null;
    }
  }
}

/**
 * Singleton экземпляр API сервиса
 */
export const complaintsAPIService = new ComplaintsAPIService();
