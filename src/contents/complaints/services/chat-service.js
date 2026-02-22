/**
 * ChatService - открытие чатов с покупателями (main world)
 *
 * Этот модуль отвечает за:
 * - Клик по кнопке чата в строке отзыва
 * - Перехват window.open() для обхода popup-блокировки Chrome
 * - Отправку запроса в background для обработки вкладки чата
 * - Получение результата (chatRecordId, anchor data)
 *
 * ПРОБЛЕМА: Chrome блокирует window.open() из programmatic .click()
 * (только devtools console имеет user activation привилегии).
 * РЕШЕНИЕ: Перехватываем window.open(), передаём URL в background,
 * background открывает вкладку через chrome.tabs.create() (без ограничений).
 *
 * Поддерживает два режима:
 * - openChat() — последовательный (обратная совместимость)
 * - clickAndCapture() + processCaptured() — pipeline (параллельная обработка)
 *
 * @module services/chat-service
 * @since 2.1.0 (19.02.2026)
 * @updated 2.2.0 (22.02.2026) — pipeline mode, direct tabId passing
 * @see docs/TASK/TASK-20260222-parallel-chat-opening.md
 */

'use strict';

class ChatService {
  /**
   * @param {Object} context - контекст (аналогичен ComplaintService)
   * @param {string} context.storeId
   * @param {Object} context.progressService - для логирования прогресса
   */
  constructor(context) {
    this.storeId = context.storeId;
    this.progressService = context.progressService;
  }

  /**
   * Открыть чат для отзыва (последовательный режим, обратная совместимость)
   *
   * @param {HTMLElement} row - строка таблицы с отзывом
   * @param {Object} reviewData
   * @returns {Promise<Object>} { success, chatRecordId, chatUrl, anchorFound }
   */
  async openChat(row, reviewData) {
    const captured = await this.clickAndCapture(row, reviewData);
    if (!captured || !captured.success) {
      return { success: false, error: captured?.error || 'Click and capture failed' };
    }

    return this.processCaptured(captured);
  }

  /**
   * Фаза 1 Pipeline: Клик по кнопке + перехват URL + получение tabId
   *
   * Выполняет клик, ждёт пока WB вызовет window.open(), перехватывает URL,
   * получает tabId из background. НЕ ждёт обработки вкладки.
   *
   * @param {HTMLElement} row - строка таблицы с отзывом
   * @param {Object} reviewData - { productId, rating, reviewDate, reviewKey }
   * @returns {Promise<Object>} { success, chatUrl, tabId, reviewData } или { success: false, error }
   */
  async clickAndCapture(row, reviewData) {
    const originalWindowOpen = window.open;

    try {
      // 1. Найти кнопку чата
      const chatButton = window.ElementFinder.findChatButton(row);
      if (!chatButton) {
        console.warn('[ChatService] Кнопка чата не найдена в строке');
        return { success: false, error: 'Chat button not found' };
      }

      if (chatButton.disabled || chatButton.hasAttribute('disabled')) {
        console.warn('[ChatService] Кнопка чата disabled');
        return { success: false, error: 'Chat button is disabled' };
      }

      // 2. Настраиваем перехват window.open() с correlationId для получения tabId
      let capturedUrl = null;
      let capturedTabId = null;
      const correlationId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      // Слушаем ответ с tabId от ISOLATED world
      const tabIdHandler = (event) => {
        if (event.detail.correlationId === correlationId) {
          capturedTabId = event.detail.tabId;
          console.log(`[ChatService] tabId получен: ${capturedTabId} (correlationId=${correlationId})`);
          window.removeEventListener('wb-create-tab-response', tabIdHandler);
        }
      };
      window.addEventListener('wb-create-tab-response', tabIdHandler);

      // Monkey-patch window.open
      window.open = function(url, target, features) {
        if (url && typeof url === 'string' && url.includes('chat-with-clients')) {
          capturedUrl = url;
          console.log(`[ChatService] window.open перехвачен! URL: ${url.substring(0, 100)}...`);
          // Передаём URL + correlationId в background для создания вкладки
          window.dispatchEvent(new CustomEvent('wb-create-tab', {
            detail: { url, correlationId }
          }));
          // Возвращаем mock window object чтобы WB не упал
          return { closed: false, close: () => {}, focus: () => {} };
        }
        // Остальные вызовы — пропускаем как есть
        return originalWindowOpen.call(this, url, target, features);
      };

      // 3. Скроллим к кнопке
      chatButton.scrollIntoView({ behavior: 'instant', block: 'center' });
      await window.WBUtils.sleep(500);

      // 4. Кликаем
      console.log(`[ChatService] Клик по кнопке чата... (key=${reviewData.reviewKey})`);
      chatButton.click();

      // 5. Ждём пока WB вызовет window.open (их API может занять 15-20с)
      const maxWait = window.SELECTORS?.CHAT_PARALLEL?.urlCaptureTimeoutMs || 25000;
      const start = Date.now();
      while (!capturedUrl && Date.now() - start < maxWait) {
        await window.WBUtils.sleep(500);
      }

      // Восстанавливаем window.open
      window.open = originalWindowOpen;

      if (!capturedUrl) {
        window.removeEventListener('wb-create-tab-response', tabIdHandler);
        console.warn('[ChatService] window.open не был вызван за 25с');
        return { success: false, error: 'window.open not intercepted within timeout' };
      }

      // 6. Ждём tabId (должен прийти быстро — createTab занимает <100мс)
      const tabIdWaitStart = Date.now();
      while (!capturedTabId && Date.now() - tabIdWaitStart < 3000) {
        await window.WBUtils.sleep(100);
      }

      if (!capturedTabId) {
        window.removeEventListener('wb-create-tab-response', tabIdHandler);
        console.warn('[ChatService] tabId не получен за 3с, обработка без прямого tabId');
      }

      console.log(`[ChatService] Capture OK: url=${capturedUrl.substring(0, 80)}, tabId=${capturedTabId}`);

      return {
        success: true,
        chatUrl: capturedUrl,
        tabId: capturedTabId,
        reviewData: {
          storeId: this.storeId,
          productId: reviewData.productId,
          rating: reviewData.rating,
          reviewDate: reviewData.reviewDate,
          reviewKey: reviewData.reviewKey
        }
      };
    } catch (err) {
      window.open = originalWindowOpen;
      console.error('[ChatService] clickAndCapture error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Фаза 2 Pipeline: Запуск обработки вкладки в background
   *
   * Отправляет запрос processChatTab с уже известным tabId.
   * Возвращает Promise который резолвится когда background закончит.
   *
   * @param {Object} captured - результат clickAndCapture()
   * @returns {Promise<Object>} { success, chatRecordId, chatUrl, anchorFound }
   */
  processCaptured(captured) {
    if (!captured || !captured.success) {
      return Promise.resolve({ success: false, error: 'Invalid captured data' });
    }

    console.log(`[ChatService] processCaptured: tabId=${captured.tabId}, key=${captured.reviewData?.reviewKey}`);

    return this._requestChatProcessing({
      ...captured.reviewData,
      tabId: captured.tabId
    });
  }

  /**
   * Запросить обработку вкладки чата через bridge
   * @private
   */
  _requestChatProcessing(data) {
    return new Promise((resolve) => {
      const requestId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const timeoutMs = 60000; // 60 секунд
      const timeout = setTimeout(() => {
        window.removeEventListener('wb-chat-response', handler);
        resolve({ success: false, error: 'Chat processing timeout (60s)' });
      }, timeoutMs);

      const handler = (event) => {
        if (event.detail.requestId === requestId) {
          clearTimeout(timeout);
          window.removeEventListener('wb-chat-response', handler);
          resolve(event.detail.response);
        }
      };

      window.addEventListener('wb-chat-response', handler);

      window.dispatchEvent(new CustomEvent('wb-chat-request', {
        detail: { requestId, ...data }
      }));
    });
  }
}

window.ChatService = ChatService;
