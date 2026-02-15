/**
 * OptimizedHandler - оптимизированный обработчик жалоб
 *
 * Этот модуль реализует оптимизированный алгоритм обработки жалоб:
 * - Группировка жалоб по артикулам
 * - Обработка всех отзывов одного артикула за один проход
 * - Минимизация переключений между артикулами
 *
 * @module handlers/optimized-handler
 * @since 1.3.0 (28.01.2026)
 */

'use strict';

/**
 * Оптимизированный обработчик
 */
class OptimizedHandler {
    /**
     * Обработать запрос на обработку жалоб
     *
     * @param {Object} request - запрос от complaints-page.js
     */
    static async handle(request) {
      const complaints = request.complaints || [];
      const storeId = request.storeId;
      const selectedStars = request.stars || [1, 2];
      const articleStats = request.articleStats || {};

      // Проверяем поле поиска (СИНХРОННАЯ версия)
      const input = window.WBUtils.findSearchInputSync(false);

      if (!input) {
        console.error('[OptimizedHandler] ❌ Поле поиска не найдено!');
        return;
      }

      // Флаг для остановки
      window.stopProcessing = false;

      // Инициализируем ProgressService
      const progressService = new window.ProgressService();
      progressService.init(complaints.length);

      // Массив для детальных данных
      const processedComplaints = [];

      // Создаем контекст для ComplaintService
      const context = {
        storeId,
        progressService,
        processedComplaints
      };

      const startTime = new Date();

      // Группируем жалобы по артикулам
      const { complaintsMap, filteredCount } = this._groupAndFilterComplaints(
        complaints,
        selectedStars,
        progressService
      );

      if (complaintsMap.size === 0) {
        progressService.log("info", "ℹ️ Нет жалоб для обработки после фильтрации");
        progressService.sendFinalStats(startTime);
        return;
      }

      progressService.log("info", `🚀 Оптимизированная обработка: ${complaintsMap.size} артикулов, ${filteredCount} жалоб`);

      // Обрабатываем артикулы
      let articleIndex = 0;
      for (const [productId, articleComplaints] of complaintsMap) {
        if (window.stopProcessing) {
          break;
        }

        articleIndex++;

        await this._processArticle(productId, articleComplaints, input, context);

        // Пауза между артикулами
        if (articleIndex < complaintsMap.size && !window.stopProcessing) {
          await window.WBUtils.sleep(1500);
        }
      }

      // Отправляем финальную статистику
      progressService.sendFinalStats(startTime);

      // Отправляем детальные данные
      chrome.runtime.sendMessage({
        type: "complaintComplete",
        data: {
          stats: progressService.getStats(),
          articleStats,
          ratingStats: {},
          complaints: processedComplaints
        }
      });

      // Освобождаем память — данные уже отправлены
      processedComplaints.length = 0;

      // Удаляем кнопку остановки
      const stopBtn = document.getElementById("stopButtonWB");
      if (stopBtn) stopBtn.remove();
    }

    /**
     * Группировать и фильтровать жалобы
     * @private
     */
    static _groupAndFilterComplaints(complaints, selectedStars, progressService) {
      const grouped = new Map();
      let filteredCount = 0;

      for (const complaint of complaints) {
        // Фильтруем по рейтингу
        if (!selectedStars.includes(complaint.rating)) {
          progressService.incrementSkipped();
          continue;
        }

        // Проверяем наличие productId
        if (!complaint.productId) {
          progressService.incrementErrors();
          continue;
        }

        // Проверяем наличие reviewDate
        if (!complaint.reviewDate) {
          progressService.incrementErrors();
          continue;
        }

        const key = complaint.productId;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key).push(complaint);
        filteredCount++;
      }

      return { complaintsMap: grouped, filteredCount };
    }

    /**
     * Обработать один артикул
     * @private
     */
    static async _processArticle(productId, articleComplaints, input, context) {
      context.progressService.log("info", `📦 Артикул ${productId}: ${articleComplaints.length} отзывов для обработки`);

      // Вводим артикул в поиск
      const searchSuccess = await window.NavigationService.searchByArticle(productId);
      if (!searchSuccess) {
        context.progressService.log("error", `❌ Артикул ${productId}: Не удалось выполнить поиск`);
        for (const c of articleComplaints) {
          context.progressService.incrementErrors();
        }
        return;
      }

      // Создаем Map для поиска жалоб
      const { complaintsMap, remainingKeys } = window.SearchService.createComplaintsMap(articleComplaints);

      const totalComplaints = context.progressService.totalComplaints;
      let pageNumber = 1;
      let totalPagesScanned = 0;
      let foundOnArticle = 0;

      // Создаем ComplaintService для этого артикула
      const complaintService = new window.ComplaintService(context);

      // Сканируем страницы
      while (remainingKeys.size > 0 && !window.stopProcessing) {
        // Сканируем текущую страницу (возвращает rowIndex вместо DOM-ссылок)
        const foundOnPage = window.SearchService.scanPageForReviews(complaintsMap, productId);

        // Получаем таблицу для доступа к строкам по индексу
        const currentTable = window.ElementFinder
          ? window.ElementFinder.findReviewsTable()
          : document.querySelector('[class*="Base-table-body"]');

        if (foundOnPage.length > 0) {
          // Обрабатываем все найденные отзывы
          for (const { complaint, rowIndex } of foundOnPage) {
            if (window.stopProcessing) break;

            // Получаем строку по индексу в момент использования (не храним DOM-ссылку)
            const row = currentTable?.children[rowIndex];
            if (!row) {
              context.progressService.incrementErrors();
              continue;
            }

            const key = window.DataExtractor.createReviewKey(
              complaint.productId,
              complaint.rating,
              complaint.reviewDate
            );

            const currentIndex = totalComplaints - context.progressService.getStats().remaining + 1;

            context.progressService.log("info", `🔄 Обрабатываем жалобу ${currentIndex}/${totalComplaints}, Ключ: ${key}`);

            const result = await complaintService.submitComplaint(row, complaint, currentIndex);

            // Проверяем нужна ли перезагрузка
            if (result === "NEED_RELOAD") {
              context.progressService.log("warn", `🔄 Перезагружаем страницу для сброса UI...`);
              sessionStorage.setItem('wb_reload_reason', 'UI_ERROR');
              sessionStorage.setItem('wb_reload_time', Date.now().toString());
              location.reload();
              return;
            }

            remainingKeys.delete(key);
            foundOnArticle++;

            // Пауза между жалобами
            if (remainingKeys.size > 0) {
              await window.WBUtils.sleep(800);
            }
          }
        }

        totalPagesScanned++;

        // Переходим на следующую страницу
        if (remainingKeys.size > 0) {
          const hasNext = await window.NavigationService.goToNextPage();
          if (!hasNext) {
            break;
          }
          pageNumber++;
        }
      }

      // Ненайденные отзывы НЕ отмечаем в API
      if (remainingKeys.size > 0) {
        context.progressService.log("warn", `⚠️ Артикул ${productId}: ${remainingKeys.size} отзывов не найдено на странице (останутся в очереди)`);
        for (const key of remainingKeys) {
          context.progressService.incrementErrors();
        }
      }

    }

    /**
     * Создать кнопку остановки
     */
    static createStopButton() {
      if (document.getElementById("stopButtonWB")) return;

      const stopBtn = document.createElement("button");
      stopBtn.id = "stopButtonWB";
      stopBtn.textContent = "⏹ Остановить";
      Object.assign(stopBtn.style, {
        position: "fixed",
        bottom: "70px",
        right: "20px",
        zIndex: 999999,
        padding: "10px 16px",
        borderRadius: "10px",
        background: "#dc3545",
        color: "#fff",
        fontSize: "15px",
        fontWeight: "bold",
        border: "none",
        cursor: "pointer",
        boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
      });

      stopBtn.onclick = () => {
        window.stopProcessing = true;
        stopBtn.textContent = "⏹ Остановлено";
        stopBtn.disabled = true;
        stopBtn.style.background = "#6c757d";
        stopBtn.style.cursor = "not-allowed";
      };

      document.body.appendChild(stopBtn);
    }

    /**
     * 🔍 ДИАГНОСТИКА: Проверить что скрипт видит все элементы DOM
     *
     * @returns {Object} - детальный отчет о проверках
     */
    static async runDiagnostics() {
      const report = {
        timestamp: new Date().toISOString(),
        checks: [],
        overallStatus: null
      };

      // CHECK 1: Таблица отзывов
      const table = window.ElementFinder.findReviewsTable();
      report.checks.push({
        name: '1. Таблица отзывов найдена',
        success: !!table,
        element: table ? table.tagName : null,
        className: table ? table.className : null
      });

      if (!table) {
        report.overallStatus = 'FAILED - таблица не найдена';
        return report;
      }

      // CHECK 2: Строки отзывов
      const rows = Array.from(table.querySelectorAll('[class*="table-row"]'));
      report.checks.push({
        name: '2. Строки отзывов найдены',
        success: rows.length > 0,
        count: rows.length
      });

      if (rows.length === 0) {
        report.overallStatus = 'FAILED - нет строк в таблице';
        return report;
      }

      // CHECK 3: Парсинг первой строки
      const firstRow = rows[0];

      // Нужно указать productId для парсинга, возьмем из поиска если есть
      const searchInput = window.WBUtils.findSearchInputSync(false);
      const testProductId = searchInput?.value || '187489568'; // fallback

      const reviewDate = window.DataExtractor.getReviewDate(firstRow);
      const rating = window.DataExtractor.getRating(firstRow);

      report.checks.push({
        name: '3. Парсинг первой строки (дата, рейтинг)',
        success: !!(reviewDate && rating),
        data: {
          reviewDate,
          rating,
          productId: testProductId
        }
      });

      // CHECK 4: Кнопка троеточия (меню)
      const menuButton = window.ElementFinder.findMenuButton(firstRow);
      report.checks.push({
        name: '4. Кнопка троеточия (меню) найдена',
        success: !!menuButton,
        element: menuButton ? menuButton.tagName : null,
        className: menuButton ? menuButton.className : null
      });

      if (!menuButton) {
        report.overallStatus = 'FAILED - кнопка меню не найдена';
        return report;
      }

      // CHECK 5: Клик по кнопке меню (используем усиленный клик как в старой версии)
      try {
        // Используем clickElementForced - scrollIntoView + focus + click + MouseEvent
        await window.WBUtils.clickElementForced(menuButton, 500);
        report.checks.push({
          name: '5. Клик по кнопке меню выполнен',
          success: true
        });
      } catch (error) {
        report.checks.push({
          name: '5. Клик по кнопке меню',
          success: false,
          error: error.message
        });
        report.overallStatus = 'FAILED - не удалось кликнуть по меню';
        return report;
      }

      // CHECK 6: Dropdown меню появилось
      // Попробуем несколько раз с короткими паузами
      let dropdown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        dropdown = window.ElementFinder.findOpenDropdown();
        if (dropdown) break;
        await window.WBUtils.sleep(300);
      }
      report.checks.push({
        name: '6. Dropdown меню появилось',
        success: !!dropdown,
        element: dropdown ? dropdown.tagName : null,
        className: dropdown ? dropdown.className : null
      });

      if (!dropdown) {
        report.overallStatus = 'FAILED - dropdown не появился';
        return report;
      }

      // CHECK 7: Кнопка "Пожаловаться"
      const complaintButton = window.ElementFinder.findComplaintButton();
      report.checks.push({
        name: '7. Кнопка "Пожаловаться" найдена',
        success: !!complaintButton,
        element: complaintButton ? complaintButton.tagName : null,
        text: complaintButton ? complaintButton.textContent : null
      });

      if (!complaintButton) {
        report.overallStatus = 'FAILED - кнопка "Пожаловаться" не найдена';
        // Закрываем dropdown
        window.ElementFinder.closeOpenDropdown();
        return report;
      }

      // CHECK 8: Клик "Пожаловаться"
      try {
        await window.WBUtils.clickElement(complaintButton);
        await window.WBUtils.sleep(800);
        report.checks.push({
          name: '8. Клик "Пожаловаться" выполнен',
          success: true
        });
      } catch (error) {
        report.checks.push({
          name: '8. Клик "Пожаловаться"',
          success: false,
          error: error.message
        });
        report.overallStatus = 'FAILED - не удалось кликнуть "Пожаловаться"';
        return report;
      }

      // CHECK 9: Модальное окно жалобы
      const modal = window.ElementFinder.findComplaintModal();
      report.checks.push({
        name: '9. Модальное окно жалобы открылось',
        success: !!modal,
        element: modal ? modal.tagName : null,
        className: modal ? modal.className : null
      });

      if (!modal) {
        report.overallStatus = 'FAILED - модальное окно не открылось';
        return report;
      }

      // CHECK 10: Radio buttons категории (ДОЛЖНЫ БЫТЬ ДО textarea!)
      const radioButtons = modal.querySelectorAll('input[type="radio"]');
      report.checks.push({
        name: '10. Radio buttons категории найдены',
        success: radioButtons.length > 0,
        count: radioButtons.length
      });

      if (radioButtons.length === 0) {
        report.overallStatus = 'FAILED - radio buttons категории не найдены';
        return report;
      }

      // CHECK 11: Выбор категории (клик по первому radio)
      // ЯНВАРЬ 2026: Текстовое поле появляется ТОЛЬКО после выбора категории!
      const firstRadio = radioButtons[0];
      const firstRadioLabel = modal.querySelector(`label[for="${firstRadio.id}"]`);
      const categoryName = firstRadio.getAttribute('name') || 'Неизвестная категория';

      try {
        // Кликаем по label (надежнее для React)
        const clickTarget = firstRadioLabel || firstRadio;
        await window.WBUtils.clickElement(clickTarget);
        await window.WBUtils.sleep(500); // Ждем появления textarea

        report.checks.push({
          name: '11. Категория выбрана',
          success: true,
          data: {
            categoryId: firstRadio.id,
            categoryName: categoryName
          }
        });
      } catch (error) {
        report.checks.push({
          name: '11. Выбор категории',
          success: false,
          error: error.message
        });
        report.overallStatus = 'FAILED - не удалось выбрать категорию';
        return report;
      }

      // CHECK 12: Поле для текста жалобы (появляется ПОСЛЕ выбора категории)
      let textField = modal.querySelector('textarea#explanation');
      // Если не нашли по id, ищем просто textarea
      if (!textField) {
        textField = modal.querySelector('textarea, [contenteditable="true"]');
      }
      report.checks.push({
        name: '12. Поле для текста жалобы найдено',
        success: !!textField,
        element: textField ? textField.tagName : null,
        id: textField ? textField.id : null
      });

      // CHECK 13: Кнопка "Отправить"
      const submitButton = window.ElementFinder.findSubmitButton();
      report.checks.push({
        name: '13. Кнопка "Отправить" найдена',
        success: !!submitButton,
        element: submitButton ? submitButton.tagName : null,
        text: submitButton ? (submitButton.innerText || submitButton.textContent) : null
      });

      // Закрываем модалку
      try {
        const closeButton = modal.querySelector('[class*="close"]') ||
                           modal.querySelector('button[aria-label*="Закр"]') ||
                           document.querySelector('[class*="overlay"]');
        if (closeButton) {
          await window.WBUtils.clickElement(closeButton);
        } else {
          // Fallback: ESC key
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        }
      } catch (e) {
        // ignore close error
      }

      // Финальный статус
      const allSuccess = report.checks.every(check => check.success);
      report.overallStatus = allSuccess
        ? '✅ SUCCESS - все проверки пройдены'
        : '⚠️ PARTIAL - есть проблемы';

      return report;
    }

    /**
     * 🔬 РАСШИРЕННАЯ ДИАГНОСТИКА: End-to-End тест с поиском и пагинацией
     *
     * Тестовый сценарий:
     * 1. Поиск по артикулу 566896043
     * 2. Переход на страницу 2
     * 3. Парсинг данных первого отзыва
     * 4. Открытие формы жалобы
     * 5. Выбор категории + вставка текста (БЕЗ отправки)
     *
     * @returns {Object} - отчет с данными отзыва
     */
    static async runExtendedDiagnostics() {
      const TEST_ARTICLE = '150706419';
      const TEST_PAGE = 2;
      const TEST_TEXT = 'ТЕСТОВЫЙ ТЕКСТ ДИАГНОСТИКИ - НЕ ОТПРАВЛЯТЬ';

      const report = {
        timestamp: new Date().toISOString(),
        testArticle: TEST_ARTICLE,
        testPage: TEST_PAGE,
        checks: [],
        reviewData: null,
        overallStatus: null
      };

      // ═══════════════════════════════════════════════════════════════
      // ФАЗА 1: ПОИСК ПО АРТИКУЛУ
      // ═══════════════════════════════════════════════════════════════

      // CHECK 1: Поиск по артикулу
      try {
        const searchSuccess = await window.NavigationService.searchByArticle(TEST_ARTICLE);
        report.checks.push({
          name: `1. Поиск по артикулу ${TEST_ARTICLE}`,
          success: searchSuccess
        });

        if (!searchSuccess) {
          report.overallStatus = 'FAILED - не удалось выполнить поиск';
          return report;
        }
      } catch (error) {
        report.checks.push({
          name: `1. Поиск по артикулу`,
          success: false,
          error: error.message
        });
        report.overallStatus = 'FAILED - ошибка поиска';
        return report;
      }

      // CHECK 2: Результаты загружены
      // Дополнительная пауза для стабильности (основная пауза уже в searchByArticle)
      await window.WBUtils.sleep(2000);
      const table = window.ElementFinder.findReviewsTable();
      const rows = table ? Array.from(table.querySelectorAll('[class*="table-row"]')) : [];
      report.checks.push({
        name: '2. Результаты поиска загружены',
        success: rows.length > 0,
        count: rows.length
      });

      if (rows.length === 0) {
        report.overallStatus = 'FAILED - нет результатов поиска';
        return report;
      }

      // ═══════════════════════════════════════════════════════════════
      // ФАЗА 2: ПАГИНАЦИЯ
      // ═══════════════════════════════════════════════════════════════

      // CHECK 3: Переход на страницу 2
      let pageSuccess = true;
      for (let i = 1; i < TEST_PAGE; i++) {
        const nextSuccess = await window.NavigationService.goToNextPage();
        if (!nextSuccess) {
          pageSuccess = false;
          break;
        }
      }
      report.checks.push({
        name: `3. Переход на страницу ${TEST_PAGE}`,
        success: pageSuccess
      });

      if (!pageSuccess) {
        report.overallStatus = 'FAILED - не удалось перейти на страницу 2';
        return report;
      }

      await window.WBUtils.sleep(2000); // Дополнительная пауза после пагинации

      // ═══════════════════════════════════════════════════════════════
      // ФАЗА 3: ПАРСИНГ ДАННЫХ ОТЗЫВА
      // ═══════════════════════════════════════════════════════════════

      // CHECK 4: Парсинг данных первого отзыва
      const tableAfterNav = window.ElementFinder.findReviewsTable();
      const rowsAfterNav = tableAfterNav ? Array.from(tableAfterNav.querySelectorAll('[class*="table-row"]')) : [];

      if (rowsAfterNav.length === 0) {
        report.checks.push({
          name: '4. Строки на странице 2',
          success: false,
          error: 'Нет строк после пагинации'
        });
        report.overallStatus = 'FAILED - нет строк на странице 2';
        return report;
      }

      const firstRow = rowsAfterNav[0];
      const reviewData = window.DataExtractor.extractReviewData(firstRow, TEST_ARTICLE);

      report.checks.push({
        name: '4. Данные отзыва спарсены',
        success: !!reviewData,
        data: reviewData ? {
          date: reviewData.reviewDate,
          rating: reviewData.rating,
          hasText: !!reviewData.text
        } : null
      });

      if (!reviewData) {
        report.overallStatus = 'FAILED - не удалось спарсить данные отзыва';
        return report;
      }

      // Сохраняем данные отзыва в отчет
      report.reviewData = {
        productId: reviewData.productId,
        date: reviewData.reviewDate,
        rating: reviewData.rating,
        text: reviewData.text || '(без текста)',
        key: reviewData.key
      };

      // ═══════════════════════════════════════════════════════════════
      // ФАЗА 4: ОТКРЫТИЕ ФОРМЫ ЖАЛОБЫ
      // ═══════════════════════════════════════════════════════════════

      // CHECK 5: Кнопка троеточия
      const menuButton = window.ElementFinder.findMenuButton(firstRow);
      report.checks.push({
        name: '5. Кнопка троеточия найдена',
        success: !!menuButton
      });

      if (!menuButton) {
        report.overallStatus = 'FAILED - кнопка меню не найдена';
        return report;
      }

      // CHECK 6: Клик по троеточию → Dropdown
      await window.WBUtils.clickElementForced(menuButton, 500);
      await window.WBUtils.sleep(500);

      const dropdown = window.ElementFinder.findOpenDropdown();
      report.checks.push({
        name: '6. Dropdown открылся',
        success: !!dropdown
      });

      if (!dropdown) {
        report.overallStatus = 'FAILED - dropdown не открылся';
        return report;
      }

      // CHECK 7: Кнопка "Пожаловаться"
      const complaintButton = window.ElementFinder.findComplaintButton();
      report.checks.push({
        name: '7. Кнопка "Пожаловаться" найдена',
        success: !!complaintButton
      });

      if (!complaintButton) {
        window.ElementFinder.closeOpenDropdown();
        report.overallStatus = 'FAILED - кнопка "Пожаловаться" не найдена';
        return report;
      }

      // CHECK 8: Клик → Модальное окно
      await window.WBUtils.clickElement(complaintButton);
      await window.WBUtils.sleep(800);

      const modal = window.ElementFinder.findComplaintModal();
      report.checks.push({
        name: '8. Модальное окно открылось',
        success: !!modal
      });

      if (!modal) {
        report.overallStatus = 'FAILED - модальное окно не открылось';
        return report;
      }

      // ═══════════════════════════════════════════════════════════════
      // ФАЗА 5: ЗАПОЛНЕНИЕ ФОРМЫ (БЕЗ ОТПРАВКИ!)
      // ═══════════════════════════════════════════════════════════════

      // CHECK 9: Radio buttons + выбор категории
      const radioButtons = modal.querySelectorAll('input[type="radio"]');
      if (radioButtons.length === 0) {
        report.checks.push({
          name: '9. Категории жалобы',
          success: false,
          error: 'Radio buttons не найдены'
        });
        report.overallStatus = 'FAILED - категории не найдены';
        return report;
      }

      const firstRadio = radioButtons[0];
      const categoryLabel = modal.querySelector(`label[for="${firstRadio.id}"]`);
      const categoryName = firstRadio.getAttribute('name') || 'Неизвестная';

      await window.WBUtils.clickElement(categoryLabel || firstRadio);
      await window.WBUtils.sleep(500);

      report.checks.push({
        name: '9. Категория выбрана',
        success: true,
        data: { categoryId: firstRadio.id, categoryName }
      });

      // CHECK 10: Текстовое поле
      let textField = modal.querySelector('textarea#explanation');
      if (!textField) {
        textField = modal.querySelector('textarea');
      }

      report.checks.push({
        name: '10. Текстовое поле найдено',
        success: !!textField,
        id: textField?.id
      });

      if (!textField) {
        report.overallStatus = 'FAILED - текстовое поле не найдено';
        // Закрываем модалку
        try {
          const closeBtn = modal.querySelector('[class*="close"]');
          if (closeBtn) await window.WBUtils.clickElement(closeBtn);
        } catch (e) {}
        return report;
      }

      // CHECK 11: Вставка тестового текста
      try {
        window.WBUtils.setNativeValue(textField, TEST_TEXT);
        textField.dispatchEvent(new Event('input', { bubbles: true }));
        textField.dispatchEvent(new Event('change', { bubbles: true }));

        report.checks.push({
          name: '11. Тестовый текст вставлен',
          success: true,
          text: TEST_TEXT
        });
      } catch (error) {
        report.checks.push({
          name: '11. Вставка текста',
          success: false,
          error: error.message
        });
      }

      // CHECK 12: Кнопка "Отправить" (не нажимаем!)
      const submitButton = window.ElementFinder.findSubmitButton();
      report.checks.push({
        name: '12. Кнопка "Отправить" найдена (НЕ нажата)',
        success: !!submitButton
      });

      // ═══════════════════════════════════════════════════════════════
      // ЗАВЕРШЕНИЕ: Закрываем модалку
      // ═══════════════════════════════════════════════════════════════

      try {
        const closeButton = modal.querySelector('[class*="close"]') ||
                           modal.querySelector('button[aria-label*="Закр"]');
        if (closeButton) {
          await window.WBUtils.clickElement(closeButton);
        } else {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        }
      } catch (e) {
        // ignore close error
      }

      // Очищаем поиск
      await window.WBUtils.sleep(500);
      await window.NavigationService.clearSearch();

      // Финальный статус
      const allSuccess = report.checks.every(check => check.success);
      report.overallStatus = allSuccess
        ? '✅ SUCCESS - расширенный тест пройден'
        : '⚠️ PARTIAL - есть проблемы';

      return report;
    }

    /**
     * 🧪 ТЕСТ 3: Интеграционный тест с Backend API
     *
     * Тестовый сценарий:
     * 1. Получить жалобы от Backend API (50 шт)
     * 2. Сгруппировать по артикулам
     * 3. Для каждого артикула: поиск → пагинация → найти отзывы
     * 4. Считать статусы найденных отзывов
     * 5. Вывести статистику
     *
     * @param {Object} options - опции теста
     * @param {Array} options.complaints - массив жалоб от API
     * @returns {Object} - отчет со статистикой
     */
    /**
     * Нормализовать ключ отзыва - убрать секунды из timestamp
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

    static async runTest3Diagnostics(options = {}) {
      const complaints = options.complaints || [];
      // ВРЕМЕННОЕ РЕШЕНИЕ: Лимит убран для полного парсинга всех клиентов
      // TODO: Вернуть лимит после завершения парсинга
      // const LIMIT = 20;

      const report = {
        timestamp: new Date().toISOString(),
        complaintsReceived: complaints.length,
        uniqueArticles: 0,
        reviewsFound: 0,
        reviewsNotFound: 0,
        statusStats: {},
        articleResults: [],
        canSubmitComplaint: 0,  // Отзывы БЕЗ статуса жалобы (можно подать)
        alreadyProcessed: 0,    // Уже есть статус жалобы
        overallStatus: null
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

      // Обрабатываем каждый артикул
      let articleIndex = 0;
      for (const [productId, articleComplaints] of groupedByArticle) {
        articleIndex++;

        const articleResult = {
          productId,
          complaintsCount: articleComplaints.length,
          found: [],
          notFound: []
        };

        // Поиск по артикулу
        const searchSuccess = await window.NavigationService.searchByArticle(productId);
        if (!searchSuccess) {
          articleResult.notFound = articleComplaints.map(c => c.reviewKey);
          report.reviewsNotFound += articleComplaints.length;
          report.articleResults.push(articleResult);
          continue;
        }

        // Создаем Set для быстрого поиска по НОРМАЛИЗОВАННОМУ reviewKey (без секунд)
        const remainingKeys = new Set(articleComplaints.map(c => this.normalizeReviewKey(c.reviewKey)));
        const complaintsMap = new Map(articleComplaints.map(c => [this.normalizeReviewKey(c.reviewKey), c]));

        let pageNumber = 1;
        const MAX_PAGES = 10; // Максимум страниц для поиска

        // Сканируем страницы
        while (remainingKeys.size > 0 && pageNumber <= MAX_PAGES) {
          // Получаем таблицу и строки
          const table = window.ElementFinder.findReviewsTable();
          if (!table) {
            break;
          }

          const rows = Array.from(table.querySelectorAll('[class*="table-row"]'));

          // Сканируем строки
          for (const row of rows) {
            const reviewData = window.DataExtractor.extractReviewData(row, productId);
            if (!reviewData || !reviewData.key) continue;

            // Нормализуем ключ со страницы (убираем секунды)
            const normalizedPageKey = this.normalizeReviewKey(reviewData.key);

            // Проверяем, есть ли этот отзыв в нашем списке (по нормализованному ключу)
            const isMatch = remainingKeys.has(normalizedPageKey);

            if (isMatch) {
              // Собираем статусы
              const statuses = reviewData.statuses || [];

              // Обновляем статистику
              for (const status of statuses) {
                report.statusStats[status] = (report.statusStats[status] || 0) + 1;
              }

              // Определяем возможность подачи жалобы
              // Статусы жалоб - если есть любой, жалобу подать нельзя
              // См. docs/Статусы-Категоризация.md → "Правила подачи жалоб"
              const COMPLAINT_STATUSES = [
                'Жалоба отклонена',
                'Жалоба одобрена',
                'Проверяем жалобу',
                'Жалоба пересмотрена'
              ];

              const hasComplaintStatus = statuses.some(s => COMPLAINT_STATUSES.includes(s));

              // МОЖНО подать жалобу = НЕТ ни одного статуса жалобы
              // Примечание: статус "Виден" не является Chips-элементом,
              // он подразумевается по умолчанию
              if (!hasComplaintStatus) {
                report.canSubmitComplaint++;
              } else {
                report.alreadyProcessed++;
              }

              // Сохраняем найденный отзыв
              articleResult.found.push({
                key: reviewData.key,
                rating: reviewData.rating,
                date: reviewData.reviewDate,
                statuses: statuses
              });

              remainingKeys.delete(normalizedPageKey);
              report.reviewsFound++;
            }
          }

          // Если ещё есть что искать - переходим на следующую страницу
          if (remainingKeys.size > 0) {
            const hasNext = await window.NavigationService.goToNextPage();
            if (!hasNext) {
              break;
            }
            pageNumber++;
          } else {
            break;
          }
        }

        // Сохраняем ненайденные
        for (const key of remainingKeys) {
          articleResult.notFound.push(key);
          report.reviewsNotFound++;
        }

        report.articleResults.push(articleResult);

        // Пауза между артикулами
        if (articleIndex < report.uniqueArticles) {
          await window.WBUtils.sleep(1000);
        }
      }

      // Очищаем поиск
      await window.NavigationService.clearSearch();

      // ========== СИНХРОНИЗАЦИЯ СТАТУСОВ С BACKEND ==========
      // Собираем все найденные отзывы для отправки
      const reviewsToSync = [];
      for (const articleResult of report.articleResults) {
        for (const found of articleResult.found) {
          reviewsToSync.push({
            productId: articleResult.productId,
            rating: found.rating,
            reviewDate: found.date,
            key: found.key,
            statuses: found.statuses
          });
        }
      }

      if (reviewsToSync.length > 0) {
        // Примечание: storeId нужно передать в options.storeId
        const storeId = options.storeId || null;
        if (storeId) {
          const syncResult = await this.syncReviewStatuses(storeId, reviewsToSync);
          report.syncResult = syncResult;
        }
      }
      // =========================================================

      // Финальный статус
      const successRate = report.complaintsReceived > 0
        ? ((report.reviewsFound / complaints.length) * 100).toFixed(1)
        : 0;

      report.overallStatus = report.reviewsFound > 0
        ? `✅ SUCCESS - найдено ${report.reviewsFound}/${complaints.length} (${successRate}%)`
        : '❌ FAILED - ничего не найдено';

      return report;
    }

    /**
     * 🚀 ТЕСТ 4: Финальный интеграционный тест с реальной подачей жалоб
     *
     * Объединяет:
     * - Тест 3: API → группировка → поиск → парсинг статусов
     * - ComplaintService: открытие формы → заполнение → отправка
     *
     * Особенность: ПЕРВАЯ жалоба требует ручного подтверждения через confirm()
     *
     * @param {Object} options - опции теста
     * @param {Array} options.complaints - массив жалоб от API
     * @param {string} options.storeId - ID магазина
     * @returns {Object} - отчет со статистикой
     */
    static async runTest4Diagnostics(options = {}) {
      const complaints = options.complaints || [];
      const storeId = options.storeId || null;

      // ВРЕМЕННОЕ РЕШЕНИЕ: Лимит убран для полного парсинга всех клиентов
      // TODO: Вернуть лимит после завершения парсинга
      // const LIMIT = 20;

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
        processedComplaints: []
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

        let pageNumber = 1;
        const MAX_PAGES = 10;

        // ========== ВРЕМЕННОЕ РЕШЕНИЕ ==========
        // Парсим ВСЕ страницы артикула (не только те, где есть совпадения с жалобами)
        // чтобы собрать статусы ВСЕХ отзывов в БД.
        // TODO: Убрать после полного парсинга всех клиентов WB
        // ========================================
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

              // Примечание: данные для синхронизации уже добавлены выше (для ВСЕХ отзывов)

              remainingKeys.delete(normalizedPageKey);
              report.reviewsFound++;
            }
          }

          // ========== ФОНОВАЯ СИНХРОНИЗАЦИЯ СТАТУСОВ ПОСЛЕ КАЖДОЙ СТРАНИЦЫ ==========
          // Синхронизируем ВСЕ отзывы страницы (не только совпавшие с жалобами)
          if (pageReviewsToSync.length > 0 && storeId) {
            const reviewsCount = pageReviewsToSync.length;
            // Запускаем синхронизацию в фоне (не ждём завершения)
            this.syncReviewStatuses(storeId, pageReviewsToSync)
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

        // Сохраняем ненайденные
        for (const key of remainingKeys) {
          articleResult.notFound.push(key);
          report.reviewsNotFound++;
        }

        report.articleResults.push(articleResult);

        // Пауза между артикулами
        if (articleIndex < report.uniqueArticles && !window.stopProcessing && !report.cancelled) {
          await window.WBUtils.sleep(1500);
        }
      }

      // Очищаем поиск
      await window.NavigationService.clearSearch();

      // Примечание: Синхронизация статусов с Backend теперь происходит в фоне
      // сразу после парсинга каждой страницы (см. выше в цикле while)

      // Финальный статус
      if (report.cancelled) {
        report.overallStatus = '⏹️ CANCELLED - отменено пользователем';
      } else if (report.submitted > 0) {
        report.overallStatus = `✅ SUCCESS - подано ${report.submitted} жалоб`;
      } else if (report.canSubmitComplaint === 0) {
        report.overallStatus = '⚠️ NO_AVAILABLE - нет отзывов для подачи жалоб';
      } else {
        report.overallStatus = '❌ FAILED - не удалось подать жалобы';
      }

      return report;
    }

    /**
     * 📤 Синхронизация статусов отзывов с Backend
     *
     * Отправляет спарсенные статусы отзывов в Backend API
     * для оптимизации генерации жалоб GPT (~80% экономии токенов).
     *
     * @param {string} storeId - ID магазина
     * @param {Array} reviews - массив отзывов с данными от DataExtractor
     * @returns {Promise<Object>} - результат синхронизации
     *
     * Использование из консоли:
     * ```javascript
     * // Собрать статусы со страницы и отправить
     * const reviews = [];
     * const table = window.ElementFinder.findReviewsTable();
     * const rows = table.querySelectorAll('[class*="table-row"]');
     * for (const row of rows) {
     *   const data = window.DataExtractor.extractReviewData(row, '123456789');
     *   if (data) reviews.push(data);
     * }
     * await window.OptimizedHandler.syncReviewStatuses('storeId', reviews);
     * ```
     */
    static async syncReviewStatuses(storeId, reviews) {
      if (!storeId) {
        console.error('[StatusSync] ❌ storeId обязателен');
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
          console.error('[StatusSync] ❌ Таймаут ожидания ответа');
          resolve({ success: false, error: 'Таймаут ожидания ответа' });
        }, 10000); // 10 секунд таймаут

        const responseHandler = (event) => {
          if (event.detail.requestId === requestId) {
            clearTimeout(timeout);
            window.removeEventListener('wb-sync-response', responseHandler);

            const response = event.detail.response;
            if (!response?.success) {
              console.error('[StatusSync] ❌ Ошибка синхронизации:', response?.error);
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
     * 📥 Получить синхронизированные статусы из Backend (для тестирования)
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
              console.error('[StatusSync] ❌ Ошибка получения:', chrome.runtime.lastError);
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

console.log('[OptimizedHandler] Модуль успешно загружен');
