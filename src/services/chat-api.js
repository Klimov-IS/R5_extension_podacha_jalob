/**
 * ChatAPI - API клиент для чат-воркфлоу
 *
 * Endpoints:
 * - GET  /api/extension/chat/stores/{storeId}/rules — правила открытия чатов
 * - POST /api/extension/chat/opened — регистрация открытия чата
 * - POST /api/extension/chat/{chatRecordId}/anchor — якорное сообщение
 * - POST /api/extension/chat/{chatRecordId}/error — логирование ошибок
 *
 * @module services/chat-api
 * @since 2.1.0 (19.02.2026)
 * @see docs/Sprint 2. Chats/API_CHATS_CONTRACT.md
 */

import { settingsService } from './settings-service.js';

class ChatAPI {
  constructor() {
    this.baseURL = null;
    this.token = null;
  }

  /**
   * Lazy initialization из настроек
   * @private
   */
  async _init() {
    if (!this.baseURL) {
      this.baseURL = await settingsService.getBackendEndpoint();
      this.token = await settingsService.getBackendToken();
    }
  }

  /**
   * Получить правила чатов для магазина
   *
   * @param {string} storeId - ID магазина
   * @returns {Promise<Object>} { globalLimits: { maxChatsPerRun, cooldownBetweenChatsMs }, items: [...] }
   */
  async getChatRules(storeId) {
    await this._init();
    const url = `${this.baseURL}/api/extension/chat/stores/${storeId}/rules`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`getChatRules HTTP ${response.status}: ${text}`);
    }

    const data = await response.json();
    return data.data || data;
  }

  /**
   * Зарегистрировать открытие чата
   *
   * @param {Object} params
   * @param {string} params.storeId
   * @param {Object} params.reviewContext - { nmId, rating, reviewDate, reviewKey }
   * @param {string} params.chatUrl - полный URL вкладки чата
   * @param {string} params.openedAt - ISO 8601
   * @param {string} params.status - 'CHAT_OPENED'
   * @returns {Promise<Object>} { chatRecordId, reviewMatched }
   */
  async chatOpened(params) {
    await this._init();
    const url = `${this.baseURL}/api/extension/chat/opened`;

    console.log(`[ChatAPI] POST ${url}`);
    console.log(`[ChatAPI] chatOpened body:`, JSON.stringify(params).substring(0, 500));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[ChatAPI] chatOpened FAILED: HTTP ${response.status}`, text);
      throw new Error(`chatOpened HTTP ${response.status}: ${text}`);
    }

    const data = await response.json();
    console.log(`[ChatAPI] chatOpened response:`, data);
    return data;
  }

  /**
   * Отправить данные якорного сообщения
   *
   * @param {string} chatRecordId - UUID из chatOpened
   * @param {Object} anchorData
   * @param {string} anchorData.systemMessageText
   * @param {string|null} anchorData.parsedNmId
   * @param {string} anchorData.parsedProductTitle
   * @param {string} anchorData.anchorFoundAt - ISO 8601
   * @param {string} anchorData.status - 'ANCHOR_FOUND' | 'ANCHOR_NOT_FOUND'
   * @returns {Promise<Object>}
   */
  async sendAnchor(chatRecordId, anchorData) {
    await this._init();
    const url = `${this.baseURL}/api/extension/chat/${chatRecordId}/anchor`;

    console.log(`[ChatAPI] POST ${url}`);
    console.log(`[ChatAPI] sendAnchor body:`, JSON.stringify(anchorData).substring(0, 300));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(anchorData)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[ChatAPI] sendAnchor FAILED: HTTP ${response.status}`, text);
      throw new Error(`sendAnchor HTTP ${response.status}: ${text}`);
    }

    const data = await response.json();
    console.log(`[ChatAPI] sendAnchor response:`, data);
    return data;
  }

  /**
   * Логировать ошибку на этапе чат-воркфлоу
   *
   * @param {string} chatRecordId - UUID (может быть null если chatOpened не вернул id)
   * @param {Object} errorData
   * @param {string} errorData.errorCode - ERROR_TAB_TIMEOUT, ERROR_ANCHOR_NOT_FOUND, etc.
   * @param {string} errorData.errorMessage
   * @param {string} errorData.stage - 'TAB_DETECTION' | 'ANCHOR_PARSING' | 'API_CALL'
   * @returns {Promise<void>}
   */
  async logError(chatRecordId, errorData) {
    if (!chatRecordId) return;

    await this._init();
    const url = `${this.baseURL}/api/extension/chat/${chatRecordId}/error`;

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(errorData)
      });
    } catch (err) {
      console.error('[ChatAPI] logError failed:', err);
    }
  }
}

export const chatAPI = new ChatAPI();
