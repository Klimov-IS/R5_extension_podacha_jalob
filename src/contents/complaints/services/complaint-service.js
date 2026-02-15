/**
 * ComplaintService - подача жалоб на отзывы
 *
 * Этот модуль отвечает за весь процесс подачи жалобы:
 * - Проверка статуса (жалоба уже подана/отклонена)
 * - Открытие меню отзыва
 * - Клик по "Пожаловаться на отзыв"
 * - Заполнение формы жалобы
 * - Отправка жалобы
 * - Отметка в API
 *
 * @module services/complaint-service
 * @since 1.3.0 (28.01.2026)
 */

'use strict';

// ⚠️ ТЕСТОВЫЙ РЕЖИМ: Заполняет форму, но НЕ отправляет жалобу
  // ВАЖНО: Установить false для реальной отправки!
  const TEST_MODE = false;


  /**
   * Сервис подачи жалоб
   */
  class ComplaintService {
    /**
     * Конструктор
     * @param {Object} context - контекст с зависимостями
     */
    constructor(context) {
      this.storeId = context.storeId;
      this.progressService = context.progressService;
      this.processedComplaints = context.processedComplaints;
    }

    /**
     * Подать жалобу на отзыв
     *
     * @param {HTMLElement} row - строка таблицы с отзывом
     * @param {Object} complaint - данные жалобы
     * @param {number} complaintIndex - индекс жалобы
     * @param {boolean} pauseBeforeSubmit - показать confirm() перед отправкой (для первой жалобы)
     * @returns {Promise<boolean|string>} - true/false, "NEED_RELOAD" или "CANCELLED"
     */
    async submitComplaint(row, complaint, complaintIndex, pauseBeforeSubmit = false) {
      const complaintStartTime = Date.now();
      let reasonId = "";
      let reasonName = "";
      let complaintText = "";

      try {
        // ============ ПРОВЕРКА НА "ЖАЛОБА ОТКЛОНЕНА" ============
        if (this._isAlreadyProcessed(row)) {
          return await this._handleAlreadyProcessed(complaint, complaintStartTime);
        }

        // ============ ОТКРЫТИЕ МЕНЮ ОТЗЫВА ============
        const menuButton = window.ElementFinder.findMenuButton(row);
        if (!menuButton) {
          return this._handleError(complaint, 'Кнопка меню не найдена', complaintStartTime);
        }

        // Открываем меню
        const menuOpened = await this._openMenu(menuButton);
        if (!menuOpened) {
          return this._handleError(complaint, 'Меню не открылось после нескольких попыток', complaintStartTime);
        }

        // ============ КЛИК ПО "ПОЖАЛОВАТЬСЯ НА ОТЗЫВ" ============
        const complaintBtn = window.ElementFinder.findComplaintButton();

        if (!complaintBtn) {
          window.ElementFinder.closeOpenDropdown();
          return this._handleError(complaint, 'Кнопка "Пожаловаться" не найдена', complaintStartTime);
        }

        if (complaintBtn.disabled) {
          window.ElementFinder.closeOpenDropdown();
          return await this._handleAlreadyProcessed(complaint, complaintStartTime);
        }

        // Кликаем по кнопке жалобы
        complaintBtn.click();

        // Ждем модальное окно (1.8 сек - для медленного интернета)
        await window.WBUtils.sleep(1800);
        let modal = window.ElementFinder.findComplaintModal();

        if (!modal) {
          this.progressService.log("error", `❌ Жалоба (арт. ${complaint.productId}): Модальное окно не появилось - ТРЕБУЕТСЯ ПЕРЕЗАГРУЗКА`);
          window.ElementFinder.closeOpenDropdown();
          return "NEED_RELOAD";
        }

        // ============ ЗАПОЛНЕНИЕ ФОРМЫ ЖАЛОБЫ ============
        await window.WBUtils.sleep(400);

        // Парсим данные жалобы
        const complaintData = this._parseComplaintText(complaint.complaintText);
        if (!complaintData) {
          window.WBUtils.clearModalState(modal);
          modal = null;
          return this._handleError(complaint, 'Ошибка парсинга complaintText', complaintStartTime);
        }

        reasonId = complaintData.reasonId;
        reasonName = complaintData.reasonName;
        complaintText = complaintData.complaintText;

        // Очищаем состояние модалки
        this._clearModalRadios(modal);
        await window.WBUtils.sleep(500);

        // Выбираем причину жалобы
        const radioSelected = await this._selectReason(modal, reasonId, reasonName);
        if (!radioSelected) {
          window.WBUtils.clearModalState(modal);
          modal = null;
          return this._handleError(complaint, 'Радиокнопки не найдены', complaintStartTime);
        }

        // Вводим текст жалобы
        const textEntered = await this._enterComplaintText(complaintText);
        if (!textEntered) {
          window.WBUtils.clearModalState(modal);
          modal = null;
          this.progressService.log("error", `❌ Жалоба (арт. ${complaint.productId}): Поле для текста не найдено - ТРЕБУЕТСЯ ПЕРЕЗАГРУЗКА`);
          return "NEED_RELOAD";
        }

        // ============ ОТПРАВКА ЖАЛОБЫ ============
        const sent = await this._submitForm();
        await window.WBUtils.sleep(500);
        window.WBUtils.clearModalState(modal);
        modal = null;

        if (sent) {
          // Отмечаем в API как отправленную (draft → pending)
          // Используем bridge через CustomEvent (main world → isolated world → background)
          try {
            const apiResponse = await this._sendComplaintViabridge(this.storeId, complaint.id);
          } catch (apiErr) {
            console.error(`[ComplaintService] ❌ Ошибка вызова sendComplaint:`, apiErr);
          }

          const complaintDuration = ((Date.now() - complaintStartTime) / 1000).toFixed(1);
          this.progressService.log("success", `✅ Жалоба ${complaintIndex} отправлена (⏱️ ${complaintDuration}с)`);

          // Сохраняем для отчета (без тяжёлых текстовых полей — memory optimization)
          this.processedComplaints.push({
            timestamp: new Date().toISOString(),
            article: complaint.productId,
            reviewId: complaint.id,
            rating: complaint.rating,
            reasonId: reasonId,
            reasonName: reasonName,
            status: 'sent',
            error: '',
            duration: parseFloat(complaintDuration),
            author: complaint.authorName || '',
            reviewDate: complaint.reviewDate || ''
          });

          this.progressService.incrementSent();
          return true;
        } else {
          // Кнопка отправить не найдена
          this.processedComplaints.push({
            timestamp: new Date().toISOString(),
            article: complaint.productId,
            reviewId: complaint.id,
            rating: complaint.rating,
            reasonId: reasonId,
            reasonName: reasonName,
            status: 'error',
            error: 'Кнопка Отправить не найдена',
            duration: ((Date.now() - complaintStartTime) / 1000).toFixed(1),
            author: complaint.authorName || '',
            reviewDate: complaint.reviewDate || ''
          });

          this.progressService.incrementErrors();
          return false;
        }

      } catch (err) {
        console.error(`❌ Ошибка при подаче жалобы:`, err);
        this.progressService.log("error", `❌ Ошибка жалобы (арт. ${complaint.productId}): ${err.message}`);
        this.progressService.incrementErrors();
        return false;
      }
    }

    /**
     * Отправить запрос sendComplaint через bridge (main world → isolated world → background)
     * @private
     * @param {string} storeId - ID магазина
     * @param {string} reviewId - ID отзыва
     * @returns {Promise<Object>} - ответ от API
     */
    _sendComplaintViabridge(storeId, reviewId) {
      return new Promise((resolve, reject) => {
        const requestId = `complaint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timeout = 10000; // 10 секунд таймаут

        const timeoutId = setTimeout(() => {
          window.removeEventListener('wb-send-complaint-response', responseHandler);
          reject(new Error('Timeout waiting for sendComplaint response'));
        }, timeout);

        const responseHandler = (event) => {
          if (event.detail.requestId === requestId) {
            clearTimeout(timeoutId);
            window.removeEventListener('wb-send-complaint-response', responseHandler);
            resolve(event.detail.response);
          }
        };

        window.addEventListener('wb-send-complaint-response', responseHandler);

        window.dispatchEvent(new CustomEvent('wb-send-complaint-request', {
          detail: {
            requestId: requestId,
            storeId: storeId,
            reviewId: reviewId
          }
        }));
      });
    }

    /**
     * Проверить, была ли уже подана жалоба
     * @private
     */
    _isAlreadyProcessed(row) {
      const rowText = row.textContent || '';
      return rowText.includes('Жалоба отклонена') || rowText.includes('Жалоба на рассмотрении');
    }

    /**
     * Обработать случай когда жалоба уже подана
     * @private
     */
    async _handleAlreadyProcessed(complaint, startTime) {
      this.progressService.log("warn", `⚠️ Жалоба (арт. ${complaint.productId}): уже подана или отклонена - пропускаем`);

      // Отмечаем в API как отправленную (draft → pending)
      // Используем bridge через CustomEvent (main world → isolated world → background)
      try {
        const apiResponse = await this._sendComplaintViabridge(this.storeId, complaint.id);
      } catch (apiErr) {
        console.error(`[ComplaintService] ❌ Ошибка вызова sendComplaint (skipped):`, apiErr);
      }

      // Сохраняем для отчета (без тяжёлых текстовых полей — memory optimization)
      this.processedComplaints.push({
        timestamp: new Date().toISOString(),
        article: complaint.productId,
        reviewId: complaint.id,
        rating: complaint.rating,
        status: 'skipped',
        error: 'Жалоба уже подана или отклонена',
        duration: ((Date.now() - startTime) / 1000).toFixed(1),
        author: complaint.authorName || '',
        reviewDate: complaint.reviewDate || ''
      });

      this.progressService.incrementSkipped();
      return true;
    }

    /**
     * Обработать ошибку
     * @private
     */
    _handleError(complaint, errorMessage, startTime) {
      this.progressService.log("warn", `⚠️ Жалоба (арт. ${complaint.productId}): ${errorMessage}`);
      this.progressService.incrementErrors();
      return false;
    }

    /**
     * Открыть меню отзыва
     * @private
     */
    async _openMenu(menuButton) {
      // Закрываем ранее открытое меню
      const hadOpenDropdown = window.ElementFinder.findOpenDropdown();
      if (hadOpenDropdown) {
        window.ElementFinder.closeOpenDropdown();
        await window.WBUtils.sleep(150);
      }

      // Скроллим к элементу
      menuButton.scrollIntoView({ behavior: 'instant', block: 'center' });
      await window.WBUtils.sleep(100);

      // Фокус
      menuButton.focus();
      await window.WBUtils.sleep(100);

      // Клик
      menuButton.click();
      await window.WBUtils.sleep(300);

      // Проверяем открылось ли меню
      let dropdown = window.ElementFinder.findOpenDropdown();

      // Если нет - пробуем через события
      if (!dropdown) {
        menuButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
        await window.WBUtils.sleep(50);
        menuButton.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
        await window.WBUtils.sleep(50);
        menuButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        await window.WBUtils.sleep(400);
      }

      // Повторяем до 3 раз если меню не открылось
      let complaintBtn = window.ElementFinder.findComplaintButton();
      let attempts = 0;

      while (!complaintBtn && attempts < 3) {
        attempts++;
        await window.WBUtils.sleep(500);

        menuButton.focus();
        menuButton.click();
        await window.WBUtils.sleep(600);

        complaintBtn = window.ElementFinder.findComplaintButton();
      }

      return !!complaintBtn;
    }

    /**
     * Парсить текст жалобы из JSON
     * @private
     */
    _parseComplaintText(text) {
      try {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, "0");
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const year = now.getFullYear();
        const prefix = `Жалоба от: ${day}.${month}.${year}\n\n`;

        // ✅ НОВЫЙ ФОРМАТ API: complaintText уже объект
        if (typeof text === 'object' && text !== null) {
          return {
            reasonId: text.reasonId,
            reasonName: text.reasonName,
            complaintText: prefix + (text.complaintText || '')
          };
        }

        // ⚠️ СТАРЫЙ ФОРМАТ: JSON-строка в markdown
        const rawJson = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(rawJson);

        return {
          reasonId: parsed.reasonId,
          reasonName: parsed.reasonName,
          complaintText: prefix + parsed.complaintText
        };
      } catch (err) {
        console.error("Ошибка парсинга complaintText:", err);
        return null;
      }
    }

    /**
     * Очистить радиокнопки в модалке
     * @private
     */
    _clearModalRadios(modal) {
      const radios = modal.querySelectorAll('input[type="radio"]');
      radios.forEach((r) => {
        r.checked = false;
        r.removeAttribute("checked");
      });
      modal.querySelectorAll("[class*='radioChecked__']").forEach((el) => {
        el.classList.forEach((cls) => {
          if (cls.startsWith("radioChecked__")) el.classList.remove(cls);
        });
      });
      radios.forEach((r) => r.dispatchEvent(new Event("change", { bubbles: true })));
    }

    /**
     * Выбрать причину жалобы
     * @private
     */
    async _selectReason(modal, reasonId, reasonName) {
      let radio = modal.querySelector(`input[type="radio"][value="${reasonId}"]`);

      if (radio) {
        radio.click();
        radio.checked = true;
        radio.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      } else {
        const radios = modal.querySelectorAll('input[type="radio"]');
        if (radios.length > 0) {
          radios[0].click();
          return true;
        }
        return false;
      }
    }

    /**
     * Ввести текст жалобы
     * @private
     *
     * ВАЖНО: React controlled component сбрасывает value после setNativeValue!
     * Решение: использовать execCommand('insertText') для эмуляции реального ввода
     */
    async _enterComplaintText(text) {
      let textarea;
      try {
        textarea = await window.WBUtils.waitForElement("#explanation", { timeout: 10000 });
      } catch (error) {
        console.error('[ComplaintService] ❌ textarea #explanation не найден');
        return false;
      }

      if (!textarea || !text) {
        console.error('[ComplaintService] ❌ textarea или text отсутствует');
        return false;
      }

      // ====== МЕТОД 1: execCommand('insertText') ======
      // Эмулирует реальный пользовательский ввод, React обновит свой state
      textarea.focus();
      textarea.select(); // Выделяем всё (если было что-то)

      // Пробуем insertText - это заставит React обновить state
      const insertSuccess = document.execCommand('insertText', false, text);

      if (insertSuccess && textarea.value.length > 0) {
        await window.WBUtils.sleep(300);
        return true;
      }

      // ====== МЕТОД 2: DataTransfer (paste event) ======
      // Эмулируем вставку из буфера обмена
      textarea.focus();
      textarea.select();

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', text);

      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer
      });

      textarea.dispatchEvent(pasteEvent);

      await window.WBUtils.sleep(300);

      if (textarea.value.length > 0) {
        return true;
      }

      // ====== МЕТОД 3: InputEvent с insertText ======
      textarea.focus();

      const inputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      });

      // Сначала устанавливаем value напрямую
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, text);

      // Затем отправляем InputEvent
      textarea.dispatchEvent(inputEvent);

      await window.WBUtils.sleep(500);

      if (textarea.value.length > 0) {
        return true;
      }

      console.error(`[ComplaintService] ❌ ВСЕ МЕТОДЫ НЕ СРАБОТАЛИ! value.length = ${textarea.value.length}`);
      return false;
    }

    /**
     * Отправить форму жалобы
     * @private
     */
    async _submitForm() {
      const sendButton = window.ElementFinder.findSubmitButton();
      await window.WBUtils.sleep(200);

      if (sendButton) {
        // ⚠️ ТЕСТОВЫЙ РЕЖИМ: Не отправляем форму, только имитируем
        if (TEST_MODE) {
          this.progressService.log("warn", `⚠️ TEST_MODE: Жалоба НЕ отправлена (тест)`);
          await window.WBUtils.sleep(1500);
          return true; // Имитируем успех
        }

        // Реальная отправка (в продакшене)
        sendButton.click();
        await window.WBUtils.sleep(1500);
        return true;
      }

      this.progressService.log("warn", `⚠️ Кнопка 'Отправить' не найдена`);
      return false;
    }
  }

  // Экспортируем в глобальную область
  window.ComplaintService = ComplaintService;

console.log('[ComplaintService] Модуль успешно загружен');
