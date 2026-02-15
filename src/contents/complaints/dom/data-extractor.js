/**
 * DataExtractor - извлечение данных из строк таблицы отзывов
 *
 * Этот модуль отвечает за извлечение данных из DOM элементов
 * страницы Wildberries (дата отзыва, рейтинг, создание ключей)
 *
 * ВАЖНО: С января 2026 WB показывает дату И ВРЕМЯ отзыва: "14.08.2025 в 15:17"
 * Используем полный timestamp для уникальной идентификации (может быть несколько
 * отзывов с одной датой, но время будет разное).
 *
 * @module dom/data-extractor
 * @since 1.3.0 (28.01.2026)
 * @version 1.3.1 - Added datetime extraction
 */

'use strict';

/**
 * Parse WB datetime format to ISO 8601
   * WB format: "14.08.2025 в 15:17"
   * Output: "2025-08-14T15:17:00.000Z"
   */
  function parseWBDatetime(wbDatetime) {
    if (!wbDatetime || typeof wbDatetime !== 'string') {
      return null;
    }

    // Pattern: "14.08.2025 в 15:17"
    const match = wbDatetime.match(/(\d{2})\.(\d{2})\.(\d{4})\s+в\s+(\d{2}):(\d{2})/);

    if (!match) {
      return null;
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // Months are 0-indexed
    const year = parseInt(match[3], 10);
    const hours = parseInt(match[4], 10);
    const minutes = parseInt(match[5], 10);

    try {
      // WB показывает время в MSK (UTC+3), конвертируем в UTC
      const date = new Date(Date.UTC(year, month, day, hours - 3, minutes, 0, 0));

      if (isNaN(date.getTime())) {
        return null;
      }

      return date.toISOString();
    } catch (error) {
      console.error('[DataExtractor] parseWBDatetime error:', error);
      return null;
    }
  }

  /**
   * Класс для извлечения данных из строк таблицы отзывов
   */
  class DataExtractor {
    /**
     * Получить дату и время отзыва из строки таблицы
     *
     * WB формат (январь 2026): "27.01.2026 в 15:05"
     * Возвращает ISO 8601: "2026-01-27T12:05:00.000Z"
     *
     * СТРУКТУРА HTML:
     * <span class="Text__xxx" data-name="Text">27.01.2026 в 15:05</span>
     *
     * @param {HTMLElement} row - строка таблицы (<tr> или аналог)
     * @returns {string|null} - дата в формате ISO 8601 или null
     */
    static getReviewDate(row) {
      try {
        // Ищем все span с data-name="Text" - WB использует этот атрибут для текстовых элементов
        const textSpans = row.querySelectorAll('span[data-name="Text"]');

        // Паттерн даты WB: "27.01.2026 в 15:05"
        const datePattern = /\d{2}\.\d{2}\.\d{4}\s+в\s+\d{2}:\d{2}/;

        for (const span of textSpans) {
          const text = span.textContent.trim();
          if (datePattern.test(text)) {
            // Парсим WB формат в ISO 8601
            const isoDate = parseWBDatetime(text);

            if (isoDate) {
              return isoDate;
            }
          }
        }

        // Fallback: старый метод с разделёнными датой и временем
        const parentContainer = row.querySelector('[class*="Col-date-time-with-readmark__"]');
        if (parentContainer) {
          const dateMarkerContainer = parentContainer.querySelector('[class*="date-with-marker"]');
          const dateSpan = dateMarkerContainer?.querySelector('span');
          const dateText = dateSpan?.textContent?.trim();

          if (dateText) {
            const timeSpans = parentContainer.querySelectorAll(':scope > span');
            for (const span of timeSpans) {
              const text = span.textContent.trim();
              if (/^\d{2}:\d{2}$/.test(text)) {
                const fullDatetime = `${dateText} в ${text}`;
                return parseWBDatetime(fullDatetime);
              }
            }
          }
        }

        return null;

      } catch (error) {
        console.error('[DataExtractor] Ошибка при извлечении даты отзыва:', error);
        return null;
      }
    }

    /**
     * Получить рейтинг отзыва из строки таблицы
     * Подсчитывает количество активных (заполненных) звезд
     *
     * СТРУКТУРА HTML (январь 2026):
     * <div class="Rating__xxx">
     *   <div class="Rating--active__xxx">...</div>  <!-- заполненная звезда -->
     *   <div class="Rating--not-active__xxx">...</div>  <!-- пустая звезда -->
     * </div>
     *
     * @param {HTMLElement} row - строка таблицы
     * @returns {number|null} - рейтинг (1-5) или null
     */
    static getRating(row) {
      try {
        // Ищем контейнер с рейтингом (класс начинается с Rating__)
        const ratingContainer = row.querySelector('[class*="Rating__"]');

        if (!ratingContainer) {
          return null;
        }

        // Способ 1 (январь 2026): Подсчитываем элементы с классом Rating--active__
        const activeStars = ratingContainer.querySelectorAll('[class*="Rating--active__"]');
        let starsCount = activeStars.length;

        if (starsCount >= 1 && starsCount <= 5) {
          return starsCount;
        }

        // Fallback: Подсчитываем SVG с оранжевым цветом
        const allStarsSvg = ratingContainer.querySelectorAll('svg');
        let orangeStarsCount = 0;

        for (const svg of allStarsSvg) {
          const orangePath = svg.querySelector('path[fill="#FF773C"], path[fill="#ff773c"]');
          if (orangePath) {
            orangeStarsCount++;
          }
        }

        if (orangeStarsCount >= 1 && orangeStarsCount <= 5) {
          return orangeStarsCount;
        }

        return null;
      } catch (error) {
        console.error('[DataExtractor] Ошибка при извлечении рейтинга:', error);
        return null;
      }
    }

    /**
     * Создать уникальный ключ для отзыва
     *
     * Формат: "productId_rating_reviewDateISO8601"
     * Пример: "187489568_1_2026-01-18T15:17:00.000Z"
     *
     * ВАЖНО: Используем ПОЛНЫЙ ISO 8601 timestamp для уникальности!
     * Может быть несколько отзывов с одной датой, но разным временем.
     *
     * @param {string} productId - артикул товара
     * @param {number} rating - рейтинг (1-5)
     * @param {string} reviewDate - дата отзыва в ISO 8601 формате
     * @returns {string} - уникальный ключ
     */
    static createReviewKey(productId, rating, reviewDate) {
      return `${productId}_${rating}_${reviewDate}`;
    }

    /**
     * Получить ключ отзыва из строки таблицы
     *
     * @param {HTMLElement} row - строка таблицы
     * @param {string} currentArticle - текущий артикул (из контекста обработки)
     * @returns {string|null} - уникальный ключ или null
     */
    static getReviewKey(row, currentArticle) {
      const reviewDate = this.getReviewDate(row);
      const rating = this.getRating(row);

      if (!reviewDate || !rating) {
        return null;
      }

      return this.createReviewKey(currentArticle, rating, reviewDate);
    }

    /**
     * Получить статусы отзыва из строки таблицы
     *
     * Статусы отображаются как Chips (теги) в контейнере Feedback-statuses.
     * Каждый отзыв может иметь несколько статусов одновременно:
     * - Статусы видимости: "Виден", "Снят с публикации", "Исключён из рейтинга"
     * - Статусы жалобы: "Жалоба отклонена", "Жалоба одобрена", "Проверяем жалобу"
     * - Статусы товара: "Выкуп", "Отказ", "Возврат"
     *
     * СТРУКТУРА HTML (январь 2026):
     * <div class="Feedback-statuses__...">
     *   <div class="Switchable-portal-tooltip__...">
     *     <div class="Portal-tooltip__text">
     *       <div class="Base-status__...">
     *         <div class="Chips__..." data-name="Chips">
     *           <div class="Chips__text__...">Отказ</div>
     *         </div>
     *       </div>
     *     </div>
     *   </div>
     * </div>
     *
     * @param {HTMLElement} row - строка таблицы
     * @returns {string[]} - массив статусов (может быть пустым)
     */
    static getReviewStatuses(row) {
      const statuses = [];

      try {
        // Способ 1: Ищем контейнер статусов Feedback-statuses
        const statusContainer = row.querySelector('[class*="Feedback-statuses"]');

        if (statusContainer) {
          // Ищем все Chips с data-name="Chips"
          const chips = statusContainer.querySelectorAll('[data-name="Chips"]');

          for (const chip of chips) {
            // Текст статуса находится в div с классом Chips__text
            const textEl = chip.querySelector('[class*="Chips__text"]');
            if (textEl) {
              const text = textEl.textContent.trim();
              if (text && !statuses.includes(text)) {
                statuses.push(text);
              }
            }
          }
        }

        // Способ 2 (fallback): Ищем по Extended-article-info-card__statuses
        if (statuses.length === 0) {
          const extendedContainer = row.querySelector('[class*="Extended-article-info-card__statuses"]');
          if (extendedContainer) {
            const chips = extendedContainer.querySelectorAll('[data-name="Chips"]');
            for (const chip of chips) {
              const textEl = chip.querySelector('[class*="Chips__text"]');
              if (textEl) {
                const text = textEl.textContent.trim();
                if (text && !statuses.includes(text)) {
                  statuses.push(text);
                }
              }
            }
          }
        }

        // Способ 3 (fallback): Ищем любые Chips в строке
        if (statuses.length === 0) {
          const allChips = row.querySelectorAll('[data-name="Chips"]');
          for (const chip of allChips) {
            const textEl = chip.querySelector('[class*="Chips__text"]');
            if (textEl) {
              const text = textEl.textContent.trim();
              // Фильтруем только известные статусы
              const knownStatuses = [
                'Виден', 'Снят с публикации', 'Исключён из рейтинга', 'Временно скрыт',
                'Жалоба отклонена', 'Жалоба одобрена', 'Проверяем жалобу', 'Жалоба пересмотрена',
                'Выкуп', 'Отказ', 'Возврат', 'Запрошен возврат'
              ];
              if (text && knownStatuses.includes(text) && !statuses.includes(text)) {
                statuses.push(text);
              }
            }
          }
        }

        return statuses;

      } catch (error) {
        console.error('[DataExtractor] Ошибка при извлечении статусов:', error);
        return [];
      }
    }

    /**
     * Получить текст отзыва из строки таблицы
     *
     * @param {HTMLElement} row - строка таблицы
     * @returns {string|null} - текст отзыва или null
     */
    static getReviewText(row) {
      try {
        // Ищем ячейку с текстом отзыва (обычно содержит класс "text" или находится после рейтинга)
        // Текст отзыва обычно в span[data-name="Text"] внутри ячейки с длинным текстом
        const textSpans = row.querySelectorAll('span[data-name="Text"]');

        // Паттерн даты - исключаем эти span
        const datePattern = /\d{2}\.\d{2}\.\d{4}\s+в\s+\d{2}:\d{2}/;

        for (const span of textSpans) {
          const text = span.textContent.trim();
          // Пропускаем дату, короткие тексты и служебные надписи
          if (datePattern.test(text)) continue;
          if (text.length < 10) continue;
          if (text.includes('Оставить ответ')) continue;
          if (text.includes('Отзыв оставили конкуренты')) continue;

          // Нашли текст отзыва
          return text;
        }

        return null;
      } catch (error) {
        console.error('[DataExtractor] Ошибка при извлечении текста отзыва:', error);
        return null;
      }
    }

    /**
     * Извлечь все данные из строки отзыва
     *
     * @param {HTMLElement} row - строка таблицы
     * @param {string} currentArticle - текущий артикул
     * @returns {Object|null} - объект с данными или null
     *
     * Возвращает:
     * {
     *   productId: "187489568",
     *   rating: 1,
     *   reviewDate: "2026-01-18T15:17:00.000Z", // ISO 8601
     *   key: "187489568_1_2026-01-18T15:17:00.000Z",
     *   statuses: ["Виден", "Жалоба отклонена", "Выкуп"]
     * }
     *
     * Note: text field removed for memory optimization (not used in complaint flow).
     * Use getReviewText(row) directly if needed.
     */
    static extractReviewData(row, currentArticle) {
      const reviewDate = this.getReviewDate(row); // Теперь возвращает ISO 8601
      const rating = this.getRating(row);
      const statuses = this.getReviewStatuses(row);

      if (!reviewDate || !rating) {
        return null;
      }

      const reviewKey = this.createReviewKey(currentArticle, rating, reviewDate);

      return {
        productId: currentArticle,
        rating: rating,
        reviewDate: reviewDate, // ISO 8601 формат
        key: reviewKey,
        statuses: statuses
      };
    }
  }

  // Экспортируем в глобальную область для использования в content scripts
  window.DataExtractor = DataExtractor;

// Module loaded
