/**
 * Утилиты для фильтрации жалоб
 * Фильтрация по длине текста, артикулам, звездам
 *
 * @version 1.0.0
 */

import { MAX_COMPLAINT_TEXT } from '../config/complaints-config.js';
import { parseComplaintText } from './complaints-parser.js';

/**
 * Фильтрация жалоб по длине текста
 * @param {Array} complaints - Массив жалоб
 * @param {number} maxLength - Максимальная длина текста
 * @returns {Object} - Результат фильтрации
 */
export function filterByTextLength(complaints, maxLength = MAX_COMPLAINT_TEXT) {
  const result = {
    valid: [],
    tooLong: [],
    parseErrors: [],
    stats: {
      total: complaints.length,
      validCount: 0,
      tooLongCount: 0,
      parseErrorCount: 0
    }
  };

  complaints.forEach(complaint => {
    try {
      const parsed = parseComplaintText(complaint.complaintText);
      const textLength = (parsed.complaintText || '').length;

      if (textLength > maxLength) {
        result.tooLong.push({
          complaint,
          productId: complaint.productId,
          id: complaint.id,
          length: textLength
        });
        result.stats.tooLongCount++;
      } else {
        result.valid.push(complaint);
        result.stats.validCount++;
      }
    } catch (err) {
      result.parseErrors.push({
        complaint,
        error: err.message
      });
      result.stats.parseErrorCount++;
    }
  });

  return result;
}

/**
 * Фильтрация жалоб по артикулам
 * @param {Array} complaints - Массив жалоб
 * @param {Array<string>} articles - Массив артикулов
 * @returns {Array} - Отфильтрованные жалобы
 */
export function filterByArticles(complaints, articles) {
  if (!articles || articles.length === 0) {
    return complaints;
  }

  return complaints.filter(complaint =>
    articles.includes(complaint.productId)
  );
}

/**
 * Фильтрация жалоб по звездам
 * @param {Array} complaints - Массив жалоб
 * @param {Array<number>} stars - Массив рейтингов (1-5)
 * @returns {Array} - Отфильтрованные жалобы
 */
export function filterByStars(complaints, stars) {
  if (!stars || stars.length === 0) {
    return complaints;
  }

  return complaints.filter(complaint =>
    stars.includes(complaint.rating)
  );
}

/**
 * Комбинированная фильтрация жалоб
 * @param {Array} complaints - Массив жалоб
 * @param {Object} options - Опции фильтрации
 * @param {Array<string>} [options.articles] - Артикулы
 * @param {Array<number>} [options.stars] - Звезды
 * @param {number} [options.maxTextLength] - Максимальная длина текста
 * @returns {Object} - Результат фильтрации
 */
export function filterComplaints(complaints, options = {}) {
  const {
    articles = [],
    stars = [],
    maxTextLength = MAX_COMPLAINT_TEXT
  } = options;

  // Шаг 1: Фильтруем по длине текста
  const lengthFiltered = filterByTextLength(complaints, maxTextLength);

  // Шаг 2: Фильтруем по артикулам (если указаны)
  let articlesFiltered = lengthFiltered.valid;
  if (articles.length > 0) {
    articlesFiltered = filterByArticles(articlesFiltered, articles);
  }

  // Шаг 3: Фильтруем по звездам (если указаны)
  let starsFiltered = articlesFiltered;
  if (stars.length > 0) {
    starsFiltered = filterByStars(starsFiltered, stars);
  }

  return {
    filtered: starsFiltered,
    stats: {
      ...lengthFiltered.stats,
      afterArticlesFilter: articlesFiltered.length,
      afterStarsFilter: starsFiltered.length,
      finalCount: starsFiltered.length
    },
    tooLong: lengthFiltered.tooLong,
    parseErrors: lengthFiltered.parseErrors
  };
}

/**
 * Статистика по артикулам
 * @param {Array} complaints - Массив жалоб
 * @returns {Object} - Статистика: { articleId: count }
 */
export function calculateArticleStats(complaints) {
  const stats = {};

  complaints.forEach(complaint => {
    const articleId = complaint.productId;
    if (!stats[articleId]) {
      stats[articleId] = 0;
    }
    stats[articleId]++;
  });

  return stats;
}

/**
 * Статистика по звездам
 * @param {Array} complaints - Массив жалоб
 * @returns {Object} - Статистика: { rating: count }
 */
export function calculateStarStats(complaints) {
  const stats = {};

  complaints.forEach(complaint => {
    const rating = complaint.rating;
    if (!stats[rating]) {
      stats[rating] = 0;
    }
    stats[rating]++;
  });

  return stats;
}

/**
 * Парсинг артикулов из текста (textarea)
 * @param {string} text - Текст с артикулами
 * @returns {Array<string>} - Массив артикулов
 */
export function parseArticlesFromText(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  return text
    .trim()
    .split(/[\s,\n]+/) // Разделители: пробел, запятая, перенос строки
    .map(a => a.trim())
    .filter(a => a.length > 0);
}
