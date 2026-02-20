/**
 * OptimizedHandler - обработчик жалоб + чатов (merged workflow)
 *
 * Этот модуль реализует оптимизированный алгоритм обработки:
 * - Группировка жалоб по артикулам
 * - Обработка всех отзывов одного артикула за один проход
 * - Подача жалоб (ComplaintService)
 * - Открытие чатов (ChatService) — MVP Sprint 2
 * - Синхронизация статусов отзывов с Backend
 *
 * @module handlers/optimized-handler
 * @since 1.3.0 (28.01.2026)
 * @updated 2.1.0 (19.02.2026) — merged complaints + chats workflow
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
        totalReviewsSynced: 0,
        // Chat workflow stats (Sprint 2)
        chatsOpened: 0,
        chatsSkipped: 0,
        chatErrors: 0,
        chatRulesLoaded: false
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

      // ========== ЗАГРУЗКА ПРАВИЛ ЧАТОВ ==========
      let chatRulesMap = new Map();
      let chatGlobalLimits = null;

      if (storeId) {
        try {
          console.log('[Chat] Загрузка правил чатов для storeId:', storeId);
          const chatRules = await this._fetchChatRules(storeId);
          if (chatRules && chatRules.items) {
            chatGlobalLimits = chatRules.globalLimits || {};
            for (const item of chatRules.items) {
              chatRulesMap.set(String(item.nmId), item);
            }
            report.chatRulesLoaded = true;
            console.log(`[Chat] Правила загружены: ${chatRulesMap.size} артикулов, лимиты:`, chatGlobalLimits);
          } else {
            console.warn('[Chat] Правила пришли, но items отсутствует:', chatRules);
          }
        } catch (err) {
          console.error('[Chat] Ошибка загрузки правил:', err.message);
        }
      } else {
        console.warn('[Chat] storeId отсутствует — чаты отключены');
      }

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
              statuses: statuses,
              chatStatus: reviewData.chatStatus || null
            });
            report.totalReviewsSynced++;

            // Статистика по статусам чата
            if (reviewData.chatStatus) {
              report.chatStatusStats = report.chatStatusStats || {};
              report.chatStatusStats[reviewData.chatStatus] = (report.chatStatusStats[reviewData.chatStatus] || 0) + 1;
            }

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

            // ========== CHAT: Открытие чатов ==========
            // Проверяем ВСЕ отзывы на странице (не только совпавшие с жалобами)
            if (chatRulesMap.size > 0 && !window.stopProcessing && !report.cancelled) {
              await this._tryOpenChat(
                row, reviewData, statuses, productId, chatRulesMap, chatGlobalLimits, context, report
              );
            } else if (chatRulesMap.size === 0) {
              // Логируем один раз на артикул
              if (!report._chatSkipLogged) {
                console.warn('[Chat] chatRulesMap пуст — чаты не обрабатываются');
                report._chatSkipLogged = true;
              }
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
      chatRulesMap.clear();
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
      } else if (report.submitted > 0 || report.chatsOpened > 0) {
        const parts = [];
        if (report.submitted > 0) parts.push(`подано ${report.submitted} жалоб`);
        if (report.chatsOpened > 0) parts.push(`открыто ${report.chatsOpened} чатов`);
        report.overallStatus = `SUCCESS - ${parts.join(', ')}`;
      } else if (report.canSubmitComplaint === 0 && report.chatsOpened === 0) {
        report.overallStatus = 'NO_AVAILABLE - нет отзывов для обработки';
      } else {
        report.overallStatus = 'FAILED - не удалось обработать';
      }

      return report;
    }

    /**
     * Проверить условия и открыть чат для отзыва
     *
     * Условия открытия (все должны быть выполнены):
     * 1. Артикул есть в правилах бэкенда (chatEnabled = true)
     * 2. Рейтинг отзыва входит в starsAllowed
     * 3. Статус чата = chat_available (серая кнопка — новый чат)
     * 4. Есть статус «Жалоба отклонена» (requiredComplaintStatus = rejected)
     * 5. НЕТ блокирующих статусов
     *
     * @param {HTMLElement} row
     * @param {Object} reviewData
     * @param {Array<string>} statuses
     * @param {string} productId
     * @param {Map} chatRulesMap
     * @param {Object} chatGlobalLimits
     * @param {Object} context
     * @param {Object} report
     * @private
     */
    static async _tryOpenChat(row, reviewData, statuses, productId, chatRulesMap, chatGlobalLimits, context, report) {
      const logKey = `[Chat ${productId}/${reviewData.rating}★]`;

      // 1. Артикул есть в правилах?
      const articleRule = chatRulesMap.get(productId);
      if (!articleRule || !articleRule.chatEnabled) {
        console.log(`${logKey} SKIP: нет правила или chatEnabled=false`);
        return;
      }

      // 2. Рейтинг входит в разрешённые?
      const starsAllowed = articleRule.starsAllowed || [];
      if (starsAllowed.length > 0 && !starsAllowed.includes(reviewData.rating)) {
        console.log(`${logKey} SKIP: рейтинг ${reviewData.rating} не в starsAllowed=${JSON.stringify(starsAllowed)}`);
        return;
      }

      // 3. Кнопка чата = серая (chat_available)?
      if (reviewData.chatStatus !== 'chat_available') {
        console.log(`${logKey} SKIP: chatStatus=${reviewData.chatStatus} (нужен chat_available)`);
        return;
      }

      // 4. Обязательный статус: «Жалоба отклонена»
      if (!statuses.includes('Жалоба отклонена')) {
        console.log(`${logKey} SKIP: нет статуса "Жалоба отклонена", есть: [${statuses}]`);
        return;
      }

      // 5. Блокирующие статусы
      const CHAT_BLOCKING_STATUSES = [
        'Жалоба одобрена',
        'Исключен из рейтинга',
        'Исключён из рейтинга',
        'Дополнен',
        'Снят с публикации'
      ];
      const blockingFound = statuses.filter(s => CHAT_BLOCKING_STATUSES.includes(s));
      if (blockingFound.length > 0) {
        console.log(`${logKey} SKIP: блокирующие статусы: [${blockingFound}]`);
        report.chatsSkipped++;
        return;
      }

      // Все условия выполнены — открываем чат
      console.log(`${logKey} ✅ ВСЕ УСЛОВИЯ ПРОШЛИ — открываем чат...`);
      try {
        const chatService = new window.ChatService(context);
        const result = await chatService.openChat(row, {
          productId,
          rating: reviewData.rating,
          reviewDate: reviewData.date || reviewData.reviewDate,
          reviewKey: reviewData.key
        });

        if (result?.success) {
          report.chatsOpened++;
          console.log(`${logKey} ✅ Чат открыт:`, result);
        } else {
          report.chatErrors++;
          console.warn(`${logKey} ❌ Ошибка открытия:`, result?.error || result);
        }

        // Cooldown между чатами
        const cooldown = chatGlobalLimits?.cooldownBetweenChatsMs || 3000;
        if (!window.stopProcessing && !report.cancelled) {
          await window.WBUtils.sleep(cooldown);
        }
      } catch (err) {
        console.error(`${logKey} ❌ Exception:`, err);
        report.chatErrors++;
      }
    }

    /**
     * Получить правила чатов из Backend через bridge
     *
     * MAIN world → wb-chat-rules-request → content.js → Background → response
     *
     * @param {string} storeId
     * @returns {Promise<Object>} { globalLimits, items: [{nmId, chatEnabled, starsAllowed, ...}] }
     * @private
     */
    static _fetchChatRules(storeId) {
      return new Promise((resolve, reject) => {
        const requestId = `rules_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const timeout = setTimeout(() => {
          window.removeEventListener('wb-chat-rules-response', handler);
          reject(new Error('Chat rules fetch timeout'));
        }, 10000);

        const handler = (event) => {
          if (event.detail.requestId === requestId) {
            clearTimeout(timeout);
            window.removeEventListener('wb-chat-rules-response', handler);
            const response = event.detail.response;
            if (response && response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response?.error || 'Failed to fetch chat rules'));
            }
          }
        };

        window.addEventListener('wb-chat-rules-response', handler);

        window.dispatchEvent(new CustomEvent('wb-chat-rules-request', {
          detail: { requestId, storeId }
        }));
      });
    }

    // ========================================================================
    // UNIFIED TASK WORKFLOW (v3.1)
    // Бэкенд — мозг, расширение — исполнитель.
    // GET /tasks возвращает 3 типа задач: statusParses, chatOpens, complaints
    // ========================================================================

    /**
     * Ждёт пока таблица отзывов загрузится и будет содержать строки.
     * Поллинг каждые 500мс вместо фиксированного sleep.
     *
     * @param {number} maxWaitMs - Максимальное время ожидания (по умолч. 15с)
     * @returns {Promise<{rows: number}|null>} - Количество строк или null если таймаут
     */
    static async _waitForTableReady(maxWaitMs = 15000) {
      const start = Date.now();
      let lastRowCount = 0;
      while (Date.now() - start < maxWaitMs) {
        const table = window.ElementFinder.findReviewsTable();
        if (table) {
          const rows = table.querySelectorAll('[class*="table-row"]');
          if (rows.length > 0) {
            // Даём ещё 1с чтобы убедиться что данные не обновляются
            lastRowCount = rows.length;
            await window.WBUtils.sleep(1000);
            const table2 = window.ElementFinder.findReviewsTable();
            const rows2 = table2 ? table2.querySelectorAll('[class*="table-row"]') : [];
            return { rows: rows2.length || lastRowCount };
          }
        }
        await window.WBUtils.sleep(500);
      }
      return null;
    }

    /**
     * Unified Task Workflow: обработка задач от GET /tasks API
     *
     * Порядок выполнения для каждого артикула:
     * 1. statusParses — пассивный парсинг ВСЕХ видимых отзывов + sync
     * 2. chatOpens — клик кнопки чата (type: "link" перед "open")
     * 3. complaints — подача жалоб с AI-текстом
     *
     * @param {Object} options
     * @param {Object} options.tasks - { storeId, articles, totals, limits }
     * @param {string} options.storeId
     * @returns {Promise<Object>} report
     */
    static async runTaskWorkflow(options = {}) {
      const { tasks, storeId, enabledTaskTypes } = options;
      const articles = tasks?.articles || {};
      const limits = tasks?.limits || {};
      const articleIds = Object.keys(articles);

      // Фильтр типов задач (UI checkboxes)
      if (enabledTaskTypes && enabledTaskTypes.length > 0) {
        console.log(`[TW] Фильтр типов задач: [${enabledTaskTypes.join(', ')}]`);
        for (const pid of articleIds) {
          if (!enabledTaskTypes.includes('statusParses')) articles[pid].statusParses = [];
          if (!enabledTaskTypes.includes('chatOpens')) articles[pid].chatOpens = [];
          if (!enabledTaskTypes.includes('complaints')) articles[pid].complaints = [];
        }
      }

      const report = {
        timestamp: new Date().toISOString(),
        mode: 'tasks',
        uniqueArticles: articleIds.length,
        // Status parse
        statusParsesRequested: tasks?.totals?.statusParses || 0,
        totalReviewsSynced: 0,
        // Chat
        chatOpensRequested: tasks?.totals?.chatOpens || 0,
        chatsOpened: 0,
        chatsSkipped: 0,
        chatErrors: 0,
        // Complaints
        complaintsRequested: tasks?.totals?.complaints || 0,
        complaintsSubmitted: 0,
        complaintsSkipped: 0,
        complaintsErrors: 0,
        // General
        tabSwitches: 0,
        cancelled: false,
        articleResults: [],
        overallStatus: null
      };

      if (articleIds.length === 0) {
        report.overallStatus = 'NO_TASKS';
        return report;
      }

      console.log(`%c[TW] === НАЧАЛО ОБРАБОТКИ ЗАДАЧ ===`, 'color:#8b5cf6;font-weight:bold');
      console.log(`[TW] Артикулов: ${articleIds.length} | Парсинг: ${report.statusParsesRequested} | Чаты: ${report.chatOpensRequested} | Жалобы: ${report.complaintsRequested}`);
      console.log(`[TW] Лимиты: cooldownChats=${limits.cooldownBetweenChatsMs || 3000}мс, cooldownComplaints=${limits.cooldownBetweenComplaintsMs || 1000}мс`);

      const processedComplaints = [];
      const context = {
        storeId,
        progressService: {
          log: (level, msg) => console.log(`[TW][ComplaintService] ${msg}`),
          incrementSent: () => report.complaintsSubmitted++,
          incrementSkipped: () => report.complaintsSkipped++,
          incrementErrors: () => report.complaintsErrors++,
          getStats: () => ({ remaining: report.complaintsRequested - report.complaintsSubmitted - report.complaintsSkipped - report.complaintsErrors }),
          totalComplaints: report.complaintsRequested
        },
        processedComplaints
      };

      let articleIndex = 0;
      for (const productId of articleIds) {
        if (window.stopProcessing || report.cancelled) break;
        articleIndex++;

        const articleData = articles[productId];
        const articleResult = {
          productId,
          reviewsSynced: 0,
          chatsOpened: 0,
          chatErrors: 0,
          complaintsSubmitted: 0,
          complaintsSkipped: 0,
          complaintsErrors: 0
        };

        const aParse = (articleData.statusParses || []).length;
        const aChat = (articleData.chatOpens || []).length;
        const aCompl = (articleData.complaints || []).length;

        console.log(`%c[TW] ── Артикул ${articleIndex}/${articleIds.length}: ${productId} ──`, 'color:#2563eb;font-weight:bold');
        console.log(`[TW]   Задачи: парсинг=${aParse}, чаты=${aChat}, жалобы=${aCompl}`);

        // === ПОИСК АРТИКУЛА ===
        console.log(`[TW]   Поиск артикула ${productId}...`);
        const searchSuccess = await window.NavigationService.searchByArticle(productId);
        if (!searchSuccess) {
          console.error(`[TW]   Поиск не удался (input не найден)`);
          report.articleResults.push(articleResult);
          continue;
        }

        // Ждём реальной загрузки таблицы (вместо надежды на 7.5с sleep)
        console.log(`[TW]   Ожидание загрузки таблицы...`);
        const tableReady = await this._waitForTableReady(15000);
        if (!tableReady) {
          console.error(`[TW]   Таблица не загрузилась за 15с после поиска`);
          report.articleResults.push(articleResult);
          continue;
        }
        console.log(`[TW]   Таблица загружена: ${tableReady.rows} строк`);

        // === ПОДГОТОВКА LOOKUP MAPS ===
        const chatOpensMap = new Map();
        for (const chat of (articleData.chatOpens || [])) {
          const nk = this.normalizeReviewKey(chat.reviewKey);
          if (nk) chatOpensMap.set(nk, chat);
        }

        const complaintsMap = new Map();
        for (const complaint of (articleData.complaints || [])) {
          const nk = this.normalizeReviewKey(complaint.reviewKey);
          if (nk) complaintsMap.set(nk, complaint);
        }

        // StatusParse tracking: ключи которые нужно найти на странице
        const statusParseKeys = new Set();
        for (const sp of (articleData.statusParses || [])) {
          const nk = this.normalizeReviewKey(sp.reviewKey);
          if (nk) statusParseKeys.add(nk);
        }

        console.log(`[TW]   Lookup Maps: chatOpens=${chatOpensMap.size} ключей, complaints=${complaintsMap.size} ключей, statusParses=${statusParseKeys.size} ключей`);

        // Tracking Sets — prevent re-processing across pages
        const processedChatKeys = new Set();
        const processedComplaintKeys = new Set();

        // Circuit breaker: stop trying chats after N consecutive failures (WB rate-limit)
        const MAX_CONSECUTIVE_CHAT_FAILURES = 3;
        let consecutiveChatFailures = 0;
        let chatCircuitBroken = false;

        // === TAB LOOP ===
        const currentTab = window.NavigationService.getCurrentTab();
        const otherTab = currentTab === 'Есть ответ' ? 'Ждут ответа' : 'Есть ответ';
        const tabOrder = [null, otherTab];
        console.log(`[TW]   Текущая вкладка: "${currentTab}", порядок: [текущая, "${otherTab}"]`);

        for (const targetTab of tabOrder) {
          if (window.stopProcessing || report.cancelled) break;

          if (targetTab !== null) {
            console.log(`[TW]   Переключение на вкладку "${targetTab}"...`);
            const switched = await window.NavigationService.switchToTab(targetTab);
            if (!switched) {
              console.warn(`[TW]   Не удалось переключить на "${targetTab}", пропуск`);
              break;
            }
            report.tabSwitches++;

            // Ждём загрузки новых данных после переключения
            console.log(`[TW]   Ожидание загрузки таблицы после переключения...`);
            const tabReady = await this._waitForTableReady(10000);
            if (!tabReady) {
              console.warn(`[TW]   Таблица не загрузилась после переключения на "${targetTab}"`);
              break;
            }
            console.log(`[TW]   Вкладка "${targetTab}": ${tabReady.rows} строк`);
          } else {
            console.log(`[TW]   Сканирование текущей вкладки "${currentTab}"`);
          }

          let pageNumber = 1;
          const MAX_PAGES = 10;

          while (pageNumber <= MAX_PAGES && !window.stopProcessing && !report.cancelled) {
            const table = window.ElementFinder.findReviewsTable();
            if (!table) {
              console.warn(`[TW]   Стр.${pageNumber}: таблица не найдена, завершение`);
              break;
            }

            const rows = Array.from(table.querySelectorAll('[class*="table-row"]'));
            console.log(`[TW]   Стр.${pageNumber}: ${rows.length} строк`);

            if (rows.length === 0) {
              console.warn(`[TW]   Стр.${pageNumber}: 0 строк, завершение`);
              break;
            }

            const pageReviewsToSync = [];
            let pageChatMatches = 0;
            let pageComplaintMatches = 0;

            // === ROW SCAN ===
            for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
              const row = rows[rowIdx];
              if (window.stopProcessing || report.cancelled) break;

              const reviewData = window.DataExtractor.extractReviewData(row, productId);
              if (!reviewData || !reviewData.key) {
                // Строка без данных — пропускаем тихо
                continue;
              }

              const normalizedKey = this.normalizeReviewKey(reviewData.key);
              const statuses = reviewData.statuses || [];

              // --- PHASE 1: STATUS PARSE (passive — collect ALL visible reviews) ---
              pageReviewsToSync.push({
                productId,
                rating: reviewData.rating,
                reviewDate: reviewData.reviewDate,
                key: reviewData.key,
                statuses: statuses,
                chatStatus: reviewData.chatStatus || null
              });
              report.totalReviewsSynced++;
              articleResult.reviewsSynced++;

              // Отмечаем найденный statusParse ключ
              statusParseKeys.delete(normalizedKey);

              // --- PHASE 2: CHAT OPENS ---
              if (chatOpensMap.has(normalizedKey) && !processedChatKeys.has(normalizedKey)) {
                processedChatKeys.add(normalizedKey);
                pageChatMatches++;
                const chatTask = chatOpensMap.get(normalizedKey);

                console.log(`[TW]     Строка ${rowIdx + 1}: ЧАТЫ совпадение! type="${chatTask.type}" key=${normalizedKey} chatStatus="${reviewData.chatStatus}" statuses=[${statuses.join(', ')}]`);

                // Circuit breaker: WB rate-limits chat creation heavily
                if (chatCircuitBroken) {
                  console.warn(`[TW]     Строка ${rowIdx + 1}: ЧАТЫ пропуск — circuit breaker (${MAX_CONSECUTIVE_CHAT_FAILURES} провалов подряд)`);
                  report.chatsSkipped++;
                  articleResult.chatsSkipped = (articleResult.chatsSkipped || 0) + 1;
                // Pre-check 1: skip if chat is not activated (button disabled)
                } else if (reviewData.chatStatus === 'chat_not_activated') {
                  console.warn(`[TW]     Строка ${rowIdx + 1}: ЧАТЫ пропуск — кнопка disabled (chat_not_activated)`);
                  report.chatsSkipped++;
                  articleResult.chatsSkipped = (articleResult.chatsSkipped || 0) + 1;
                // Pre-check 2: skip if review has blocking statuses (safety net — backend should filter these)
                } else if (statuses.some(s => ['Жалоба одобрена', 'Снят с публикации', 'Исключён из рейтинга', 'Исключен из рейтинга', 'Дополнен'].includes(s))) {
                  const blockingFound = statuses.filter(s => ['Жалоба одобрена', 'Снят с публикации', 'Исключён из рейтинга', 'Исключен из рейтинга', 'Дополнен'].includes(s));
                  console.warn(`[TW]     Строка ${rowIdx + 1}: ЧАТЫ пропуск — блокирующий статус: [${blockingFound.join(', ')}]`);
                  report.chatsSkipped++;
                  articleResult.chatsSkipped = (articleResult.chatsSkipped || 0) + 1;
                } else {
                  const chatService = new window.ChatService(context);
                  try {
                    const result = await chatService.openChat(row, {
                      productId,
                      rating: reviewData.rating,
                      reviewDate: reviewData.reviewDate,
                      reviewKey: reviewData.key
                    });

                    if (result?.success) {
                      report.chatsOpened++;
                      articleResult.chatsOpened++;
                      consecutiveChatFailures = 0; // Reset on success
                      console.log(`[TW]     Чат открыт: ${normalizedKey}`);
                    } else {
                      report.chatErrors++;
                      articleResult.chatErrors++;
                      consecutiveChatFailures++;
                      console.warn(`[TW]     Чат ошибка (${consecutiveChatFailures}/${MAX_CONSECUTIVE_CHAT_FAILURES}): ${normalizedKey} — ${result?.error || 'unknown'}`);

                      if (consecutiveChatFailures >= MAX_CONSECUTIVE_CHAT_FAILURES) {
                        chatCircuitBroken = true;
                        console.error(`%c[TW]     CIRCUIT BREAKER: ${consecutiveChatFailures} провалов подряд — чаты остановлены для этого артикула (WB rate-limit)`, 'color:#dc2626;font-weight:bold');
                      }
                    }
                  } catch (err) {
                    console.error(`[TW]     Чат исключение: ${normalizedKey}`, err.message);
                    report.chatErrors++;
                    articleResult.chatErrors++;
                    consecutiveChatFailures++;

                    if (consecutiveChatFailures >= MAX_CONSECUTIVE_CHAT_FAILURES) {
                      chatCircuitBroken = true;
                      console.error(`%c[TW]     CIRCUIT BREAKER: ${consecutiveChatFailures} провалов подряд — чаты остановлены`, 'color:#dc2626;font-weight:bold');
                    }
                  }

                  // Cooldown between chats — 10с минимум (WB rate-limit)
                  const chatCooldown = Math.max(limits.cooldownBetweenChatsMs || 3000, 10000);
                  if (!window.stopProcessing && !report.cancelled && !chatCircuitBroken) {
                    console.log(`[TW]     Пауза ${chatCooldown / 1000}с перед следующим чатом...`);
                    await window.WBUtils.sleep(chatCooldown);
                  }
                }
              }

              // --- PHASE 3: COMPLAINTS ---
              if (complaintsMap.has(normalizedKey) && !processedComplaintKeys.has(normalizedKey)) {
                processedComplaintKeys.add(normalizedKey);
                pageComplaintMatches++;
                const complaint = complaintsMap.get(normalizedKey);

                // Check for blocking statuses on the DOM (double-check)
                const COMPLAINT_STATUSES = [
                  'Жалоба отклонена', 'Жалоба одобрена',
                  'Проверяем жалобу', 'Жалоба пересмотрена'
                ];
                const hasComplaintStatus = statuses.some(s => COMPLAINT_STATUSES.includes(s));

                if (hasComplaintStatus) {
                  report.complaintsSkipped++;
                  articleResult.complaintsSkipped++;
                  console.log(`[TW]     Строка ${rowIdx + 1}: ЖАЛОБА пропущена (статус: ${statuses.join(', ')}) key=${normalizedKey}`);
                } else {
                  console.log(`[TW]     Строка ${rowIdx + 1}: ЖАЛОБА подача! reasonId=${complaint.reasonId} key=${normalizedKey}`);

                  // Build complaint object compatible with ComplaintService
                  // submitComplaint() calls _parseComplaintText(complaint.complaintText)
                  // which expects object { reasonId, reasonName, complaintText }
                  // API уже возвращает complaintText как объект { reasonId, reasonName, complaintText }
                  const complaintForService = {
                    id: complaint.reviewId,
                    productId,
                    rating: complaint.rating,
                    reviewDate: complaint.date || complaint.createdAt,
                    reviewKey: complaint.reviewKey,
                    complaintText: complaint.complaintText
                  };

                  const complaintService = new window.ComplaintService(context);
                  const result = await complaintService.submitComplaint(
                    row, complaintForService, report.complaintsSubmitted + 1, false
                  );

                  if (result === 'CANCELLED') {
                    report.cancelled = true;
                    console.warn(`[TW]     Жалоба отменена пользователем`);
                    break;
                  } else if (result === true) {
                    articleResult.complaintsSubmitted++;
                    console.log(`[TW]     Жалоба подана: ${normalizedKey}`);
                  } else if (result === 'NEED_RELOAD') {
                    report.complaintsErrors++;
                    articleResult.complaintsErrors++;
                    console.error(`[TW]     Жалоба: NEED_RELOAD (UI сломался) key=${normalizedKey}`);
                  } else {
                    report.complaintsErrors++;
                    articleResult.complaintsErrors++;
                    console.warn(`[TW]     Жалоба ошибка: ${normalizedKey} result=${result}`);
                  }

                  // Cooldown between complaints
                  const complaintCooldown = limits.cooldownBetweenComplaintsMs || 1000;
                  if (!window.stopProcessing && !report.cancelled) {
                    await window.WBUtils.sleep(complaintCooldown);
                  }
                }
              }
            } // end row loop

            // === PAGE SUMMARY ===
            console.log(`[TW]   Стр.${pageNumber} итог: ${pageReviewsToSync.length} отзывов спарсено, ${pageChatMatches} чатов, ${pageComplaintMatches} жалоб`);

            // === FIRE-AND-FORGET STATUS SYNC ===
            if (pageReviewsToSync.length > 0 && storeId) {
              const syncData = pageReviewsToSync.splice(0);
              this.syncReviewStatuses(storeId, syncData).catch(() => {});
              console.log(`[TW]   Стр.${pageNumber}: sync отправлен (${syncData.length} отзывов)`);
            }

            // Navigate to next page
            if (!window.stopProcessing && !report.cancelled) {
              console.log(`[TW]   Переход на стр.${pageNumber + 1}...`);
              const hasNext = await window.NavigationService.goToNextPage();
              if (!hasNext) {
                console.log(`[TW]   Стр.${pageNumber}: последняя страница`);
                break;
              }
              pageNumber++;

              // Ждём загрузки новой страницы
              const pageReady = await this._waitForTableReady(10000);
              if (!pageReady) {
                console.warn(`[TW]   Стр.${pageNumber}: таблица не загрузилась, завершение`);
                break;
              }
              console.log(`[TW]   Стр.${pageNumber}: загружена, ${pageReady.rows} строк`);
            } else {
              break;
            }
          } // end page loop
        } // end tab loop

        // === NOT FOUND REVIEW KEYS → send to backend for targeted sync ===
        if (statusParseKeys.size > 0 && storeId) {
          const notFoundKeys = Array.from(statusParseKeys);
          console.log(`[TW]   notFoundReviewKeys: ${notFoundKeys.length} ключей не найдены на странице`);
          this.syncReviewStatuses(storeId, [], notFoundKeys).catch(() => {});
        }

        // === ARTICLE SUMMARY ===
        report.articleResults.push(articleResult);
        console.log(`%c[TW] ── Артикул ${productId} завершён ──`, 'color:#059669;font-weight:bold');
        console.log(`[TW]   Синхронизировано: ${articleResult.reviewsSynced} | Чаты: ${articleResult.chatsOpened} ок / ${articleResult.chatErrors} ошибок | Жалобы: ${articleResult.complaintsSubmitted} ок / ${articleResult.complaintsSkipped} пропущено / ${articleResult.complaintsErrors} ошибок`);

        // Memory cleanup per article
        processedComplaints.length = 0;
        delete articles[productId]; // Allow GC of processed article data

        // Pause between articles
        if (articleIndex < articleIds.length && !window.stopProcessing && !report.cancelled) {
          console.log(`[TW]   Пауза 1.5с перед следующим артикулом...`);
          await window.WBUtils.sleep(1500);
        }
      } // end article loop

      // Clear search
      await window.NavigationService.clearSearch();

      // Final status
      if (report.cancelled) {
        report.overallStatus = 'CANCELLED';
      } else {
        const parts = [];
        if (report.totalReviewsSynced > 0) parts.push(`synced ${report.totalReviewsSynced}`);
        if (report.chatsOpened > 0) parts.push(`chats ${report.chatsOpened}`);
        if (report.complaintsSubmitted > 0) parts.push(`complaints ${report.complaintsSubmitted}`);
        report.overallStatus = parts.length > 0 ? `SUCCESS - ${parts.join(', ')}` : 'NO_AVAILABLE';
      }

      console.log(`%c[TW] === ЗАВЕРШЕНО: ${report.overallStatus} ===`, 'color:#8b5cf6;font-weight:bold');
      console.log(`[TW] Итого: Синхронизировано=${report.totalReviewsSynced} | Чаты=${report.chatsOpened} ок / ${report.chatsSkipped} пропущено / ${report.chatErrors} ошибок | Жалобы=${report.complaintsSubmitted} ок / ${report.complaintsSkipped} пропущено / ${report.complaintsErrors} ошибок`);
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
    static async syncReviewStatuses(storeId, reviews, notFoundReviewKeys = null) {
      if (!storeId) {
        console.error('[StatusSync] storeId обязателен');
        return { success: false, error: 'storeId обязателен' };
      }

      if ((!reviews || reviews.length === 0) && (!notFoundReviewKeys || notFoundReviewKeys.length === 0)) {
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
        const detail = {
          requestId: requestId,
          type: 'syncReviewStatuses',
          storeId: storeId,
          reviews: reviews || []
        };
        if (notFoundReviewKeys && notFoundReviewKeys.length > 0) {
          detail.notFoundReviewKeys = notFoundReviewKeys;
        }
        window.dispatchEvent(new CustomEvent('wb-sync-request', { detail }));
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
