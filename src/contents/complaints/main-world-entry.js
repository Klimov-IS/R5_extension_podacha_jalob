/**
 * Entry point для MAIN world bundle
 *
 * Этот файл загружает все модули content scripts и экспортирует их в window
 * для доступа из MAIN world (консоль браузера, страницы WB).
 *
 * Webpack объединит все эти файлы в один bundle: dist/content-main-world.bundle.js
 *
 * @module main-world-entry
 * @since 2.0.0 (30.01.2026)
 */

'use strict';

// ========================================================================
// ИМПОРТ ВСЕХ МОДУЛЕЙ
// ========================================================================
// Webpack объединит все эти файлы в один bundle.
// Каждый файл экспортирует свои объекты в window, поэтому просто импортируем их.

// Утилиты (window.WBUtils)
import './utils.js';

// DOM модули
import './dom/selectors.catalog.js';   // window.SELECTORS
import './dom/data-extractor.js';      // window.DataExtractor
import './dom/element-finder.js';      // window.ElementFinder

// Сервисы
import './services/search-service.js';      // window.SearchService
import './services/navigation-service.js';  // window.NavigationService
import './services/progress-service.js';    // window.ProgressService
import './services/complaint-service.js';   // window.ComplaintService
import './services/chat-service.js';        // window.ChatService

// Handlers
import './handlers/optimized-handler.js';   // window.OptimizedHandler

// ========================================================================
// УВЕДОМЛЕНИЕ О ГОТОВНОСТИ
// ========================================================================

// Bundle ready (console output reduced for memory optimization)

// Отправляем событие что bundle готов к использованию
// content.js (в ISOLATED world) будет слушать это событие
window.dispatchEvent(new CustomEvent('wb-content-bundle-ready', {
  detail: {
    timestamp: Date.now(),
    version: '2.0.0',
    modules: [
      'SELECTORS',
      'WBUtils',
      'DataExtractor',
      'ElementFinder',
      'SearchService',
      'NavigationService',
      'ProgressService',
      'ComplaintService',
      'ChatService',
      'OptimizedHandler'
    ]
  }
}));

// ========================================================================
// BRIDGE: ISOLATED WORLD ↔ MAIN WORLD
// ========================================================================

/**
 * Слушаем сообщения от content.js (ISOLATED world) через CustomEvent
 * content.js отправляет команды через window.dispatchEvent()
 * Мы выполняем их в MAIN world и отправляем результат обратно
 */
window.addEventListener('wb-call-main-world', async (event) => {
  const { action, data, requestId } = event.detail;

  try {
    if (action === 'runTest4Diagnostics') {
      // Обработка жалоб (legacy flow)
      const report = await window.OptimizedHandler.runTest4Diagnostics(data);

      window.dispatchEvent(new CustomEvent('wb-main-world-response', {
        detail: { requestId, success: true, data: report }
      }));
    } else if (action === 'runTaskWorkflow') {
      // Unified Tasks workflow (statusParses + chatOpens + complaints)
      const report = await window.OptimizedHandler.runTaskWorkflow(data);

      window.dispatchEvent(new CustomEvent('wb-main-world-response', {
        detail: { requestId, success: true, data: report }
      }));
    } else {
      throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error(`[MainWorld] Ошибка выполнения ${action}:`, error);
    window.dispatchEvent(new CustomEvent('wb-main-world-response', {
      detail: { requestId, success: false, error: error.message }
    }));
  }
});
