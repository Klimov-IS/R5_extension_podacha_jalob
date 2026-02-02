/**
 * SearchService - поиск отзывов на странице
 *
 * Этот модуль отвечает за поиск нужных отзывов на текущей странице WB
 * по уникальному ключу: артикул + рейтинг + дата И ВРЕМЯ отзыва (ISO 8601)
 *
 * ВАЖНО: С января 2026 используем полный timestamp для уникальности!
 * Формат ключа: "productId_rating_ISO8601"
 * Пример: "187489568_1_2026-01-18T15:17:00.000Z"
 *
 * @module services/search-service
 * @since 1.3.0 (28.01.2026)
 * @version 1.3.1 - Updated to use ISO 8601 timestamps
 */

'use strict';

/**
 * Сервис поиска отзывов на странице
   */
  class SearchService {
    /**
     * Сканировать страницу и найти нужные отзывы
     *
     * @param {Map} complaintsMap - Map с жалобами (ключ: "productId_rating_ISO8601")
     * @param {string} currentArticle - текущий артикул товара
     * @returns {Array<{complaint: Object, row: HTMLElement}>} - найденные отзывы
     *
     * Ключ формата: "187489568_1_2026-01-18T15:17:00.000Z"
     */
    static scanPageForReviews(complaintsMap, currentArticle) {
      const found = [];
      const table = document.querySelector(".Base-table-body__F-y98zdE6m");

      if (!table || !table.children) {
        console.warn('[SearchService] Таблица не найдена');
        return found;
      }

      const rows = Array.from(table.children);
      console.log(`[SearchService] Всего строк на странице: ${rows.length}`);

      for (const row of rows) {
        if (!row) continue;

        // Получаем ключ отзыва из строки
        const key = window.DataExtractor.getReviewKey(row, currentArticle);

        if (!key) {
          // Не удалось извлечь дату или рейтинг
          continue;
        }

        // Ищем жалобу по ключу
        if (complaintsMap.has(key)) {
          const complaint = complaintsMap.get(key);
          found.push({ complaint, row });
          console.log(`✅ [SearchService] Найден отзыв: ${key}`);
        }
      }

      console.log(`[SearchService] Найдено отзывов: ${found.length} из ${complaintsMap.size} искомых`);
      return found;
    }

    /**
     * Группировать жалобы по артикулам
     *
     * @param {Array} complaints - массив жалоб
     * @returns {Map<string, Array>} - Map (ключ: артикул, значение: массив жалоб)
     */
    static groupComplaintsByArticle(complaints) {
      const grouped = new Map();

      for (const complaint of complaints) {
        if (!complaint.productId) {
          console.warn(`⚠️ Жалоба без productId, пропускаем:`, complaint);
          continue;
        }

        const key = complaint.productId;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key).push(complaint);
      }

      return grouped;
    }

    /**
     * Создать Map жалоб с ключами для поиска
     *
     * @param {Array} articleComplaints - жалобы для одного артикула
     * @returns {{complaintsMap: Map, remainingKeys: Set}} - Map и Set с ключами
     *
     * ВАЖНО: complaint.reviewDate должен быть в ISO 8601 формате!
     * Ожидается формат: "2026-01-18T15:17:00.000Z"
     */
    static createComplaintsMap(articleComplaints) {
      const complaintsMap = new Map();
      const remainingKeys = new Set();

      for (const complaint of articleComplaints) {
        if (!complaint.reviewDate) {
          console.warn(`⚠️ Жалоба без reviewDate, пропускаем:`, complaint);
          continue;
        }

        // complaint.reviewDate уже в ISO 8601 формате из API
        const key = window.DataExtractor.createReviewKey(
          complaint.productId,
          complaint.rating,
          complaint.reviewDate
        );

        console.log(`[SearchService] Created key: ${key}`, complaint);

        complaintsMap.set(key, complaint);
        remainingKeys.add(key);
      }

      console.log(`[SearchService] Created ${complaintsMap.size} complaint keys`);
      return { complaintsMap, remainingKeys };
    }
  }

  // Экспортируем в глобальную область
  window.SearchService = SearchService;

console.log('[SearchService] Модуль успешно загружен');
