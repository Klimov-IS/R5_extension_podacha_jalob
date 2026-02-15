/**
 * Роутер сообщений между компонентами расширения
 * Централизованная обработка всех chrome.runtime.onMessage
 *
 * @version 1.2.0
 * @description Маршрутизирует все сообщения к соответствующим handlers
 */

import { ComplaintsHandler } from './handlers/complaints-handler.js';
import { ReportsHandler } from './handlers/reports-handler.js';
import { ReviewsHandler } from './handlers/reviews-handler.js';
import { SettingsHandler } from './handlers/settings-handler.js';
import { StatusSyncHandler } from './handlers/status-sync-handler.js';
import { storeManager } from '../services/store-manager.js';

/**
 * Роутер сообщений
 */
class MessageRouter {
  constructor() {
    // Инициализируем все handlers
    this.handlers = {
      complaints: new ComplaintsHandler(),
      reports: new ReportsHandler(),
      reviews: new ReviewsHandler(),
      settings: new SettingsHandler(),
      statusSync: new StatusSyncHandler(),
    };
  }

  /**
   * Запустить роутер сообщений
   */
  start() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Асинхронный ответ (ВАЖНО для async handlers!)
    });

    console.log('[MessageRouter] ✅ Роутер запущен');
  }

  /**
   * Обработать входящее сообщение и направить к нужному handler
   * @param {Object} message - Сообщение
   * @param {Object} sender - Отправитель
   * @param {Function} sendResponse - Функция ответа
   */
  async handleMessage(message, sender, sendResponse) {
    try {
      const { type, action } = message;

      // Для обратной совместимости поддерживаем и type и action
      const messageType = type || action;

      console.log('[MessageRouter] Маршрутизация сообщения:', messageType);

      // Роутинг по типу сообщения
      switch (messageType) {
        // === COMPLAINTS HANDLER ===
        case 'getComplaints':
          const complaints = await this.handlers.complaints.getComplaints(message);
          sendResponse(complaints);
          break;

        case 'sendComplaint':
          const complaint = await this.handlers.complaints.sendComplaint(message);
          sendResponse(complaint);
          break;

        // === REPORTS HANDLER ===
        case 'getAPIReport':
          const report = await this.handlers.reports.getAPIReport();
          sendResponse(report);
          break;

        case 'resetAPISession':
          const reset = await this.handlers.reports.resetAPISession();
          sendResponse(reset);
          break;

        case 'getSessionState':
          const state = await this.handlers.reports.getSessionState();
          sendResponse(state);
          break;

        // === REVIEWS HANDLER ===
        case 'sendReviewsToAPI':
          const reviewsResult = await this.handlers.reviews.sendReviews(message);
          sendResponse(reviewsResult);
          break;

        case 'testExternalAPI':
          const testExternal = await this.handlers.reviews.testConnection();
          sendResponse(testExternal);
          break;

        // === SETTINGS HANDLER ===
        case 'SETTINGS_UPDATED':
          const settingsResult = await this.handlers.settings.onSettingsUpdated(message);
          sendResponse(settingsResult);
          break;

        case 'getSettings':
          const settings = await this.handlers.settings.getSettings();
          sendResponse(settings);
          break;

        case 'validateSettings':
          const validation = await this.handlers.settings.validateSettings();
          sendResponse(validation);
          break;

        // === STATUS SYNC HANDLER ===
        case 'syncReviewStatuses':
          const syncResult = await this.handlers.statusSync.syncStatuses(message);
          sendResponse(syncResult);
          break;

        case 'getReviewStatuses':
          const statuses = await this.handlers.statusSync.getStatuses(message);
          sendResponse(statuses);
          break;

        // === STORES ===
        case 'getStores':
          try {
            const stores = await storeManager.loadStores(message.forceRefresh || false);
            sendResponse({ success: true, data: stores });
          } catch (storeErr) {
            sendResponse({ success: false, error: storeErr.message });
          }
          break;

        // === ПЕРЕСЫЛКА СООБЩЕНИЙ В POPUP ===
        case 'verificationProgress':
        case 'verificationComplete':
        case 'verificationError':
        case 'parsingProgress':
        case 'parsingComplete':
        case 'parsingError':
        case 'complaintProgress':
        case 'complaintComplete':
        case 'complaintLog':
          this.forwardToPopup(message);
          sendResponse({ forwarded: true });
          break;

        // === НЕИЗВЕСТНЫЙ ТИП ===
        default:
          console.warn('[MessageRouter] ⚠️ Неизвестный тип сообщения:', messageType);
          sendResponse({ error: 'Unknown message type: ' + messageType });
      }
    } catch (error) {
      console.error('[MessageRouter] ❌ Ошибка обработки сообщения:', error);
      sendResponse({ error: error.message });
    }
  }

  /**
   * Переслать сообщение в popup (для прогресса и уведомлений)
   * @private
   * @param {Object} message - Сообщение
   */
  forwardToPopup(message) {
    chrome.runtime.sendMessage(message).catch(() => {
      // Игнорируем ошибку если popup закрыт
      console.log('[MessageRouter] Popup закрыт, сообщение не доставлено');
    });
  }
}

// Экспортируем singleton
export const messageRouter = new MessageRouter();
