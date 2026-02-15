/**
 * OptimizedHandler - обработчик жалоб
 *
 * Этот модуль реализует оптимизированный алгоритм обработки жалоб:
 * - Группировка жалоб по артикулам
 * - Обработка всех отзывов одного артикула за один проход
 * - Синхронизация статусов отзывов с Backend
 *
 * @module handlers/optimized-handler
 * @since 1.3.0 (28.01.2026)
 */

'use strict';

/**
 * Обработчик жалоб
 */
class OptimizedHandler {
    /**
     * Нормализация ключа отзыва (убирает секунды и миллисекунды для сравнения)
     *
     * Страница WB: "649502497_1_2026-01-07T20:09" (без секунд)
     * API: "649502497_1_2026-01-07T20:09:37.000Z" → "649502497_1_2026-01-07T20:09"
     * @param {string} key - ключ вида "productId_rating_ISO8601"
     * @returns {string} - нормализованный ключ без секунд
     */
    static normalizeReviewKey(key) {
      if (!key) return key;
      // Формат: productId_rating_2026-01-07T20:09:37.000Z
      // Нужно: productId_rating_2026-01-07T20:09
      return key.replace(/T(\d{2}:\d{2}):\d{2}\.\d{3}Z$/, 'T$1');
    }

    static async runTest4Diagnostics(options = {}) {
      const complaints = options.complaints || [];
      const storeId = options.storeId || null;

      const report = {
        timestamp: new Date().toISOString(),
        complaintsReceived: complaints.length,
        uniqueArticles: 0,
        reviewsFound: 0,
        reviewsNotFound: 0,
        canSubmitComplaint: 0,
        alreadyProcessed: 0,
        submitted: 0,
        skipped: 0,
        errors: 0,
        cancelled: false,
        tabSwitches: 0,
        statusStats: {},
        articleResults: [],
        overallStatus: null,
        totalReviewsSynced: 0
      };

      if (complaints.length === 0) {
        report.overallStatus = 'FAILED - нет жалоб от API';
        return report;
      }

      // Группируем по артикулам
      const groupedByArticle = new Map();
      for (const complaint of complaints) {
        if (!complaint.productId) continue;
        if (!groupedByArticle.has(complaint.productId)) {
          groupedByArticle.set(complaint.productId, []);
        }
        groupedByArticle.get(complaint.productId).push(complaint);
      }

      report.uniqueArticles = groupedByArticle.size;

      // Создаем контекст для ComplaintService
      // processedComplaints: используем минимальный массив, очищаем после каждого артикула
      const processedComplaints = [];
      const context = {
        storeId,
        progressService: {
          log: () => {},
          incrementSent: () => report.submitted++,
          incrementSkipped: () => report.skipped++,
          incrementErrors: () => report.errors++,
          getStats: () => ({ remaining: report.complaintsReceived - report.submitted - report.skipped - report.errors }),
          totalComplaints: complaints.length
        },
        processedComplaints
      };

      // Обрабатываем каждый артикул
      let articleIndex = 0;
      for (const [productId, articleComplaints] of groupedByArticle) {
        if (window.stopProcessing || report.cancelled) {
          break;
        }

        articleIndex++;

        const articleResult = {
          productId,
          complaintsCount: articleComplaints.length,
          found: [],
          notFound: [],
          submitted: [],
          skipped: []
        };

        // Поиск по артикулу
        const searchSuccess = await window.NavigationService.searchByArticle(productId);
        if (!searchSuccess) {
          articleResult.notFound = articleComplaints.map(c => c.reviewKey);
          report.reviewsNotFound += articleComplaints.length;
          report.articleResults.push(articleResult);
          continue;
        }

        // Создаем Set для быстрого поиска по НОРМАЛИЗОВАННОМУ reviewKey
        const remainingKeys = new Set(articleComplaints.map(c => this.normalizeReviewKey(c.reviewKey)));
        const complaintsMap = new Map(articleComplaints.map(c => [this.normalizeReviewKey(c.reviewKey), c]));

        // ========== ЦИКЛ ПО ВКЛАДКАМ ==========
        // Обрабатываем текущую вкладку, затем вторую (если остались ненайденные)
        const currentTab = window.NavigationService.getCurrentTab();
        const otherTab = currentTab === 'Есть ответ' ? 'Ждут ответа' : 'Есть ответ';
        const tabOrder = [null, otherTab]; // null = текущая вкладка (без переключения)

        for (const targetTab of tabOrder) {
          if (remainingKeys.size === 0 || window.stopProcessing || report.cancelled) break;

          if (targetTab !== null) {
            const switched = await window.NavigationService.switchToTab(targetTab);
            if (!switched) break;
            report.tabSwitches++;
          }

        let pageNumber = 1;
        const MAX_PAGES = 10;

        while (pageNumber <= MAX_PAGES && !window.stopProcessing && !report.cancelled) {
          const table = window.ElementFinder.findReviewsTable();
          if (!table) {
            break;
          }

          const rows = Array.from(table.querySelectorAll('[class*="table-row"]'));

          // Массив для отзывов текущей страницы (для фоновой синхронизации)
          const pageReviewsToSync = [];

          // Сканируем строки
          for (const row of rows) {
            if (window.stopProcessing || report.cancelled) break;

            const reviewData = window.DataExtractor.extractReviewData(row, productId);
            if (!reviewData || !reviewData.key) continue;

            const normalizedPageKey = this.normalizeReviewKey(reviewData.key);
            const statuses = reviewData.statuses || [];

            // ========== СОБИРАЕМ ВСЕ ОТЗЫВЫ ДЛЯ СИНХРОНИЗАЦИИ ==========
            // Синхронизируем статусы ВСЕХ отзывов на странице (не только совпавших с жалобами)
            // Это нужно для того, чтобы БД была единым источником правды
            pageReviewsToSync.push({
              productId: productId,
              rating: reviewData.rating,
              reviewDate: reviewData.date || reviewData.reviewDate,
              key: reviewData.key,
              statuses: statuses
            });
            report.totalReviewsSynced++;

            if (remainingKeys.has(normalizedPageKey)) {
              const complaint = complaintsMap.get(normalizedPageKey);

              // Обновляем статистику статусов
              for (const status of statuses) {
                report.statusStats[status] = (report.statusStats[status] || 0) + 1;
              }

              // Определяем возможность подачи жалобы
              const COMPLAINT_STATUSES = [
                'Жалоба отклонена',
                'Жалоба одобрена',
                'Проверяем жалобу',
                'Жалоба пересмотрена'
              ];

              const hasComplaintStatus = statuses.some(s => COMPLAINT_STATUSES.includes(s));

              if (!hasComplaintStatus) {
                // МОЖНО подать жалобу
                report.canSubmitComplaint++;

                // Создаем ComplaintService
                const complaintService = new window.ComplaintService(context);

                // Автоматическая подача без подтверждения
                const result = await complaintService.submitComplaint(
                  row,
                  complaint,
                  report.submitted + 1,
                  false // pauseBeforeSubmit отключён
                );

                if (result === 'CANCELLED') {
                  report.cancelled = true;
                  break;
                } else if (result === 'NEED_RELOAD') {
                  report.errors++;
                } else if (result === true) {
                  articleResult.submitted.push(normalizedPageKey);
                } else {
                  report.errors++;
                }

                // Пауза между жалобами
                if (!window.stopProcessing && !report.cancelled) {
                  await window.WBUtils.sleep(1000);
                }
              } else {
                // Уже есть статус жалобы - пропускаем
                report.alreadyProcessed++;
                articleResult.skipped.push(normalizedPageKey);
              }

              articleResult.found.push({
                key: reviewData.key,
                rating: reviewData.rating,
                statuses: statuses,
                canSubmit: !hasComplaintStatus
              });

              remainingKeys.delete(normalizedPageKey);
              report.reviewsFound++;
            }
          }

          // ========== ФОНОВАЯ СИНХРОНИЗАЦИЯ СТАТУСОВ ПОСЛЕ КАЖДОЙ СТРАНИЦЫ ==========
          // Синхронизируем ВСЕ отзывы страницы (не только совпавшие с жалобами)
          if (pageReviewsToSync.length > 0 && storeId) {
            // Запускаем синхронизацию в фоне (не ждём завершения)
            // Копируем данные чтобы pageReviewsToSync мог быть GC'd после цикла
            const syncData = pageReviewsToSync.splice(0);
            this.syncReviewStatuses(storeId, syncData)
              .catch(() => {
                // sync error handled silently
              });
          }

          // ВРЕМЕННОЕ РЕШЕНИЕ: Всегда переходим на следующую страницу для полного парсинга
          // TODO: Вернуть условие remainingKeys.size > 0 после парсинга всех клиентов
          if (!window.stopProcessing && !report.cancelled) {
            const hasNext = await window.NavigationService.goToNextPage();
            if (!hasNext) {
              break;
            }
            pageNumber++;
          } else {
            break;
          }
        }

        } // end tab loop

        // Сохраняем ненайденные
        for (const key of remainingKeys) {
          articleResult.notFound.push(key);
          report.reviewsNotFound++;
        }

        report.articleResults.push(articleResult);

        // Memory cleanup: очищаем processedComplaints после каждого артикула
        processedComplaints.length = 0;

        // Пауза между артикулами
        if (articleIndex < report.uniqueArticles && !window.stopProcessing && !report.cancelled) {
          await window.WBUtils.sleep(1500);
        }
      }

      // Очищаем поиск
      await window.NavigationService.clearSearch();

      // Memory cleanup: освобождаем тяжёлые структуры
      groupedByArticle.clear();
      processedComplaints.length = 0;

      // Сжимаем articleResults — оставляем только счётчики, убираем массивы ключей
      for (const ar of report.articleResults) {
        ar.foundCount = ar.found.length;
        ar.notFoundCount = ar.notFound.length;
        ar.submittedCount = ar.submitted.length;
        ar.skippedCount = ar.skipped.length;
        ar.found = [];
        ar.notFound = [];
        ar.submitted = [];
        ar.skipped = [];
      }

      // Финальный статус
      if (report.cancelled) {
        report.overallStatus = 'CANCELLED - отменено пользователем';
      } else if (report.submitted > 0) {
        report.overallStatus = `SUCCESS - подано ${report.submitted} жалоб`;
      } else if (report.canSubmitComplaint === 0) {
        report.overallStatus = 'NO_AVAILABLE - нет отзывов для подачи жалоб';
      } else {
        report.overallStatus = 'FAILED - не удалось подать жалобы';
      }

      return report;
    }

    /**
     * Синхронизация статусов отзывов с Backend
     *
     * Отправляет спарсенные статусы отзывов в Backend API
     * для оптимизации генерации жалоб GPT (~80% экономии токенов).
     *
     * @param {string} storeId - ID магазина
     * @param {Array} reviews - массив отзывов с данными от DataExtractor
     * @returns {Promise<Object>} - результат синхронизации
     */
    static async syncReviewStatuses(storeId, reviews) {
      if (!storeId) {
        console.error('[StatusSync] storeId обязателен');
        return { success: false, error: 'storeId обязателен' };
      }

      if (!reviews || reviews.length === 0) {
        return { success: true, data: { received: 0, created: 0, updated: 0 } };
      }

      // Используем bridge через custom events (MAIN world → ISOLATED world → Background)
      const requestId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('wb-sync-response', responseHandler);
          console.error('[StatusSync] Таймаут ожидания ответа');
          resolve({ success: false, error: 'Таймаут ожидания ответа' });
        }, 10000); // 10 секунд таймаут

        const responseHandler = (event) => {
          if (event.detail.requestId === requestId) {
            clearTimeout(timeout);
            window.removeEventListener('wb-sync-response', responseHandler);

            const response = event.detail.response;
            if (!response?.success) {
              console.error('[StatusSync] Ошибка синхронизации:', response?.error);
            }

            resolve(response);
          }
        };

        window.addEventListener('wb-sync-response', responseHandler);

        // Отправляем запрос в ISOLATED world через bridge
        window.dispatchEvent(new CustomEvent('wb-sync-request', {
          detail: {
            requestId: requestId,
            type: 'syncReviewStatuses',
            storeId: storeId,
            reviews: reviews
          }
        }));
      });
    }

    /**
     * Получить синхронизированные статусы из Backend (для тестирования)
     *
     * @param {string} storeId - ID магазина
     * @param {Object} options - опции запроса
     * @returns {Promise<Object>}
     */
    static async getReviewStatuses(storeId, options = {}) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'getReviewStatuses',
            storeId: storeId,
            limit: options.limit || 50,
            canSubmit: options.canSubmit || 'all'
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('[StatusSync] Ошибка получения:', chrome.runtime.lastError);
              resolve({ success: false, error: chrome.runtime.lastError.message });
              return;
            }
            resolve(response);
          }
        );
      });
    }
  }

  // Экспортируем в глобальную область
  window.OptimizedHandler = OptimizedHandler;

// Module loaded silently (memory optimization: reduce console accumulation)
