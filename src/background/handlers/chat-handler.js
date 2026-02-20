/**
 * ChatHandler - обработчик чат-воркфлоу (background)
 *
 * Управляет lifecycle вкладки чата:
 * 1. Получение правил (GET /chat/stores/{storeId}/rules)
 * 2. Обнаружение новой вкладки чата после клика в main world
 * 3. Ожидание загрузки страницы чата
 * 4. Парсинг якорного сообщения (chrome.scripting.executeScript)
 * 5. API вызовы: POST /chat/opened, POST /chat/{id}/anchor
 * 6. Закрытие вкладки
 *
 * @module background/handlers/chat-handler
 * @since 2.1.0 (19.02.2026)
 * @see docs/Sprint 2. Chats/API_CHATS_CONTRACT.md
 */

import { chatAPI } from '../../services/chat-api.js';

/**
 * Автономная функция парсинга якорного сообщения.
 * Инжектируется в вкладку чата через chrome.scripting.executeScript.
 * ВАЖНО: не может ссылаться на внешние переменные/модули.
 */
function parseChatAnchorInTab() {
  try {
    // Ищем контейнер сообщений — несколько вариантов селектора
    const container = document.querySelector('[class*="ChatWindow__messages"]')
      || document.querySelector('[class*="chat-messages"]')
      || document.querySelector('[class*="Messages__"]');
    if (!container) {
      // Fallback: ищем в body
      const allLists = document.querySelectorAll('li[data-addtime]');
      if (allLists.length === 0) {
        return { found: false, error: 'Messages container not found' };
      }
      // Используем родителя первого li как контейнер
      return parseMessagesFromList(allLists);
    }

    const messages = container.querySelectorAll('li[data-addtime]');
    if (!messages.length) {
      return { found: false, error: 'No messages found' };
    }

    return parseMessagesFromList(messages);
  } catch (err) {
    return { found: false, error: err.message };
  }

  function parseMessagesFromList(messages) {
    // Собираем ВСЕ тексты для отладки
    const allTexts = [];

    for (const msg of messages) {
      // Расширенный поиск текстовых элементов
      const textEl = msg.querySelector('span[data-name="Text"]')
        || msg.querySelector('[data-testid="message-content"]')
        || msg.querySelector('span')
        || msg.querySelector('p');
      if (!textEl) continue;

      const text = textEl.textContent.trim();
      if (text) allTexts.push(text.substring(0, 200));

      // Проверяем что это системное сообщение о товаре
      const validationMatch = text.match(/(?:чат|покупател|товар)/i);
      if (!validationMatch) continue;

      // Извлекаем nmId — поддерживаем форматы:
      // "Чат по товару: 253134055"
      // "Чат по товару 253134055"
      // "товару: 253134055"
      const nmIdMatch = text.match(/товару[:\s]+(\d+)/i);
      if (nmIdMatch) {
        return {
          found: true,
          systemMessageText: text,
          parsedNmId: nmIdMatch[1],
          parsedProductTitle: ''
        };
      }

      // Fallback: просто любое число 6+ цифр рядом со словом "товар"
      const fallbackMatch = text.match(/товар\S*\s*[:\s]*(\d{6,})/i);
      if (fallbackMatch) {
        return {
          found: true,
          systemMessageText: text,
          parsedNmId: fallbackMatch[1],
          parsedProductTitle: ''
        };
      }
    }

    // Якорь не найден — возвращаем тексты для отладки
    return {
      found: false,
      systemMessageText: allTexts.slice(0, 3).join(' | '),
      error: 'Anchor pattern not matched',
      debugTextsCount: allTexts.length
    };
  }
}

/**
 * Background handler для чат-воркфлоу
 */
export class ChatHandler {
  constructor() {
    this._processedTabIds = new Set();
  }

  /**
   * Получить правила чатов для магазина
   *
   * @param {Object} message
   * @param {string} message.storeId
   * @returns {Promise<Object>} { success, data: { globalLimits, items } }
   */
  async getChatRules(message) {
    const { storeId } = message;

    if (!storeId) {
      return { success: false, error: 'storeId обязателен' };
    }

    try {
      const rules = await chatAPI.getChatRules(storeId);
      return { success: true, data: rules };
    } catch (err) {
      console.error('[ChatHandler] getChatRules error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Обработать вкладку чата после клика кнопки в main world
   *
   * Flow:
   * 1. Main world кликнул кнопку чата → WB открыл новую вкладку
   * 2. Этот handler находит вкладку, парсит якорь, вызывает API, закрывает вкладку
   *
   * @param {Object} message
   * @param {string} message.storeId
   * @param {string} message.productId - nmId артикула
   * @param {number} message.rating
   * @param {string} message.reviewDate - ISO 8601
   * @param {string} message.reviewKey - нормализованный ключ
   * @returns {Promise<Object>} { success, chatRecordId, chatUrl, anchorFound }
   */
  async processChatTab(message) {
    const { storeId, productId, rating, reviewDate, reviewKey } = message;
    const tag = `[ChatHandler][${productId}]`;

    console.log(`${tag} ▶ processChatTab CALLED`, { storeId, productId, rating, reviewKey });

    let chatTab = null;
    try {
      // 1. Найти вкладку чата (WB API медленный — создание чата может занять 15-20с)
      console.log(`${tag} 1/7 Поиск вкладки чата (timeout 25s)...`);
      chatTab = await this._findChatTab(25000);
      if (!chatTab) {
        console.warn(`${tag} ✗ Вкладка чата НЕ найдена за 25с`);
        return { success: false, error: 'Chat tab not detected within 25s' };
      }

      console.log(`${tag} 2/7 Вкладка найдена: id=${chatTab.id}, url=${chatTab.url?.substring(0, 80)}, status=${chatTab.status}`);

      // Защита от повторной обработки
      if (this._processedTabIds.has(chatTab.id)) {
        console.warn(`${tag} ✗ Tab ${chatTab.id} уже обрабатывался`);
        return { success: false, error: 'Tab already processed' };
      }
      this._processedTabIds.add(chatTab.id);

      // 2. Дождаться загрузки
      if (chatTab.status !== 'complete') {
        console.log(`${tag} 3/7 Ожидание загрузки вкладки...`);
        await this._waitForTabComplete(chatTab.id, 15000);
      } else {
        console.log(`${tag} 3/7 Вкладка уже загружена (status=complete)`);
      }

      // 3. Ждём рендеринг контента чата (увеличено 3→6с по рекомендации backend)
      console.log(`${tag} 4/7 Ожидание рендеринга контента (6с)...`);
      await this._sleep(6000);

      // ВАЖНО: перезапрашиваем tab — при _findChatTab он мог быть в loading с пустым URL
      let chatUrl = chatTab.url;
      try {
        const freshTab = await chrome.tabs.get(chatTab.id);
        chatUrl = freshTab.url || chatTab.url;
        console.log(`${tag} Tab URL refreshed: ${chatUrl?.substring(0, 100)}`);
      } catch (e) {
        console.warn(`${tag} Tab refresh failed (tab closed?):`, e.message);
      }

      // 4. POST /chat/opened → получаем chatRecordId
      console.log(`${tag} 5/7 POST /chat/opened → storeId=${storeId}, nmId=${productId}, chatUrl=${chatUrl?.substring(0, 80)}`);
      let chatRecordId = null;
      try {
        const payload = {
          storeId,
          reviewContext: {
            nmId: productId,
            rating: parseInt(rating, 10),
            reviewDate,
            reviewKey
          },
          chatUrl,
          openedAt: new Date().toISOString(),
          status: 'CHAT_OPENED'
        };
        console.log(`${tag} chatOpened payload:`, JSON.stringify(payload).substring(0, 300));
        const openedResult = await chatAPI.chatOpened(payload);
        chatRecordId = openedResult?.data?.chatRecordId || openedResult?.chatRecordId;
        console.log(`${tag} ✓ chatOpened OK → chatRecordId=${chatRecordId}`, openedResult);
      } catch (err) {
        console.error(`${tag} ✗ chatOpened API ERROR:`, err.message);
      }

      // 5. Парсинг якорного сообщения (с retry — DOM может быть не готов)
      console.log(`${tag} 6/7 Парсинг якоря (с retry)...`);
      let anchorData = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: chatTab.id },
            func: parseChatAnchorInTab
          });
          anchorData = results?.[0]?.result;
          console.log(`${tag} Anchor attempt ${attempt}:`, anchorData);

          if (anchorData?.found) {
            console.log(`${tag} ✓ Якорь найден! nmId=${anchorData.parsedNmId}`);
            break;
          }

          if (attempt < 2) {
            console.log(`${tag} Якорь не найден, retry через 3с...`);
            await this._sleep(3000);
          }
        } catch (err) {
          console.error(`${tag} Anchor parse error (attempt ${attempt}):`, err.message);
          if (attempt < 2) await this._sleep(3000);
        }
      }

      // 6. POST /chat/{id}/anchor
      if (chatRecordId) {
        console.log(`${tag} 7/7 POST /chat/${chatRecordId}/anchor → found=${anchorData?.found}`);
        try {
          const anchorPayload = {
            systemMessageText: anchorData?.systemMessageText || '',
            parsedNmId: anchorData?.parsedNmId || null,
            parsedProductTitle: anchorData?.parsedProductTitle || '',
            anchorFoundAt: new Date().toISOString(),
            status: anchorData?.found ? 'ANCHOR_FOUND' : 'ANCHOR_NOT_FOUND'
          };
          await chatAPI.sendAnchor(chatRecordId, anchorPayload);
          console.log(`${tag} ✓ sendAnchor OK`);
        } catch (err) {
          console.error(`${tag} ✗ sendAnchor ERROR:`, err.message);
        }
      } else {
        console.warn(`${tag} ⚠ chatRecordId is null, skipping sendAnchor`);
      }

      // 8. Закрыть вкладку чата
      try {
        await chrome.tabs.remove(chatTab.id);
        console.log(`${tag} ✓ Tab ${chatTab.id} закрыта`);
      } catch (err) {
        console.error(`${tag} Tab close error:`, err.message);
      }

      const result = {
        success: true,
        chatRecordId,
        chatUrl,
        anchorFound: !!anchorData?.found,
        parsedNmId: anchorData?.parsedNmId || null
      };
      console.log(`${tag} ◀ processChatTab DONE`, result);
      return result;
    } catch (err) {
      console.error(`${tag} ◀ processChatTab CRITICAL ERROR:`, err);
      return { success: false, error: err.message };
    } finally {
      // Cleanup — гарантированно чистим даже при ошибке
      if (chatTab?.id) {
        this._processedTabIds.delete(chatTab.id);
      }
    }
  }

  /**
   * Найти вкладку чата (polling с таймаутом)
   * @private
   */
  async _findChatTab(timeout = 10000) {
    const startTime = Date.now();
    let pollCount = 0;

    while (Date.now() - startTime < timeout) {
      pollCount++;
      const tabs = await chrome.tabs.query({
        url: '*://seller.wildberries.ru/chat-with-clients*'
      });

      if (pollCount <= 3 || tabs.length > 0) {
        console.log(`[ChatHandler] _findChatTab poll #${pollCount}: ${tabs.length} tab(s), processed=${[...this._processedTabIds].join(',')}`);
      }

      if (tabs.length > 0) {
        // Берём самую новую вкладку (max id)
        tabs.sort((a, b) => b.id - a.id);
        const tab = tabs[0];

        if (!this._processedTabIds.has(tab.id)) {
          console.log(`[ChatHandler] _findChatTab → found tab id=${tab.id}, url=${tab.url?.substring(0, 80)}`);
          return tab;
        }
      }

      await this._sleep(500);
    }

    console.warn(`[ChatHandler] _findChatTab → NOT FOUND after ${pollCount} polls (${timeout}ms)`);
    return null;
  }

  /**
   * Дождаться status: 'complete' для вкладки
   * @private
   */
  _waitForTabComplete(tabId, timeout = 10000) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, timeout);

      const listener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  /**
   * @private
   */
  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}
