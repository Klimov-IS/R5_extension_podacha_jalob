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
 * @module services/chat-service
 * @since 2.1.0 (19.02.2026)
 * @see docs/Sprint 2. Chats/TASK_чаты.md
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
   * Открыть чат для отзыва
   *
   * Flow:
   * 1. Monkey-patch window.open → перехватываем URL
   * 2. Кликаем кнопку чата
   * 3. WB вызывает window.open(chatUrl) → наш перехватчик ловит URL
   * 4. Передаём URL в background → chrome.tabs.create()
   * 5. Background обнаруживает вкладку, парсит якорь, вызывает API, закрывает вкладку
   *
   * @param {HTMLElement} row - строка таблицы с отзывом
   * @param {Object} reviewData
   * @returns {Promise<Object>} { success, chatRecordId, chatUrl, anchorFound }
   */
  async openChat(row, reviewData) {
    // Сохраняем оригинальный window.open для восстановления
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

      // 2. Перехватываем window.open() — Chrome блокирует popup из programmatic click
      let capturedUrl = null;
      window.open = function(url, target, features) {
        if (url && typeof url === 'string' && url.includes('chat-with-clients')) {
          capturedUrl = url;
          console.log(`[ChatService] window.open перехвачен! URL: ${url.substring(0, 100)}...`);
          // Передаём URL в background для создания вкладки
          window.dispatchEvent(new CustomEvent('wb-create-tab', {
            detail: { url }
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
      // Поллинг каждые 500мс, максимум 25с
      const maxWait = 25000;
      const start = Date.now();
      while (!capturedUrl && Date.now() - start < maxWait) {
        await window.WBUtils.sleep(500);
      }

      // Восстанавливаем window.open
      window.open = originalWindowOpen;

      if (!capturedUrl) {
        console.warn('[ChatService] window.open не был вызван за 25с');
        return { success: false, error: 'window.open not intercepted within 25s' };
      }

      console.log('[ChatService] URL перехвачен, запрос обработки...');

      // 6. Запрашиваем обработку (background уже создал вкладку через wb-create-tab)
      const result = await this._requestChatProcessing({
        storeId: this.storeId,
        productId: reviewData.productId,
        rating: reviewData.rating,
        reviewDate: reviewData.reviewDate,
        reviewKey: reviewData.reviewKey
      });

      console.log('[ChatService] Результат:', result?.success ? 'OK' : result?.error);
      return result;
    } catch (err) {
      // Восстанавливаем window.open в случае ошибки
      window.open = originalWindowOpen;
      console.error('[ChatService] openChat error:', err);
      return { success: false, error: err.message };
    }
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
