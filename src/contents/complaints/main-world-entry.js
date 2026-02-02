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

console.log('[MainWorldBundle] 🚀 Начинаем загрузку модулей в MAIN world...');

// ========================================================================
// ИМПОРТ ВСЕХ МОДУЛЕЙ
// ========================================================================
// Webpack объединит все эти файлы в один bundle.
// Каждый файл экспортирует свои объекты в window, поэтому просто импортируем их.

// Утилиты (window.WBUtils)
import './utils.js';

// DOM модули
import './dom/data-extractor.js';      // window.DataExtractor
import './dom/element-finder.js';      // window.ElementFinder

// Сервисы
import './services/search-service.js';      // window.SearchService
import './services/navigation-service.js';  // window.NavigationService
import './services/progress-service.js';    // window.ProgressService
import './services/complaint-service.js';   // window.ComplaintService

// Handlers
import './handlers/optimized-handler.js';   // window.OptimizedHandler

// ========================================================================
// УВЕДОМЛЕНИЕ О ГОТОВНОСТИ
// ========================================================================

console.log('[MainWorldBundle] ✅ Все модули загружены в MAIN world');

// Отправляем событие что bundle готов к использованию
// content.js (в ISOLATED world) будет слушать это событие
window.dispatchEvent(new CustomEvent('wb-content-bundle-ready', {
  detail: {
    timestamp: Date.now(),
    version: '2.0.0',
    modules: [
      'WBUtils',
      'DataExtractor',
      'ElementFinder',
      'SearchService',
      'NavigationService',
      'ProgressService',
      'ComplaintService',
      'OptimizedHandler'
    ]
  }
}));

console.log('[MainWorldBundle] 📡 Событие wb-content-bundle-ready отправлено');

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
  console.log(`[MainWorld] Получена команда из ISOLATED world: ${action}`, data);

  try {
    if (action === 'processComplaintsFromAPI') {
      // Создаем кнопку остановки
      window.OptimizedHandler.createStopButton();

      // Обрабатываем жалобы
      await window.OptimizedHandler.handle(data);

      // Удаляем кнопку после завершения
      const stopBtn = document.getElementById('stopButtonWB');
      if (stopBtn) stopBtn.remove();

      // Отправляем успешный результат
      window.dispatchEvent(new CustomEvent('wb-main-world-response', {
        detail: { requestId, success: true }
      }));
    } else if (action === 'checkOptimizedHandler') {
      // Проверка доступности OptimizedHandler
      const available = typeof window.OptimizedHandler !== 'undefined';
      window.dispatchEvent(new CustomEvent('wb-main-world-response', {
        detail: { requestId, success: true, data: { available } }
      }));
    } else if (action === 'runDiagnostics') {
      // Запуск диагностики DOM элементов
      console.log('[MainWorld] 🔍 Запуск диагностики...');

      const report = await window.OptimizedHandler.runDiagnostics();

      console.log('[MainWorld] ✅ Диагностика завершена:', report.overallStatus);

      window.dispatchEvent(new CustomEvent('wb-main-world-response', {
        detail: { requestId, success: true, data: report }
      }));
    } else if (action === 'runExtendedDiagnostics') {
      // Расширенная диагностика (End-to-End тест)
      console.log('[MainWorld] 🔬 Запуск расширенной диагностики...');

      const report = await window.OptimizedHandler.runExtendedDiagnostics();

      console.log('[MainWorld] ✅ Расширенная диагностика завершена:', report.overallStatus);

      window.dispatchEvent(new CustomEvent('wb-main-world-response', {
        detail: { requestId, success: true, data: report }
      }));
    } else if (action === 'runTest3Diagnostics') {
      // Тест 3: Интеграция с Backend API
      console.log('[MainWorld] 🧪 Запуск Теста 3 (интеграция с API)...');

      const report = await window.OptimizedHandler.runTest3Diagnostics(data);

      console.log('[MainWorld] ✅ Тест 3 завершен:', report.overallStatus);

      window.dispatchEvent(new CustomEvent('wb-main-world-response', {
        detail: { requestId, success: true, data: report }
      }));
    } else if (action === 'runTest4Diagnostics') {
      // Тест 4: Полная интеграция с реальной подачей жалоб
      console.log('[MainWorld] 🚀 Запуск Теста 4 (реальная подача жалоб)...');

      const report = await window.OptimizedHandler.runTest4Diagnostics(data);

      console.log('[MainWorld] ✅ Тест 4 завершен:', report.overallStatus);

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

console.log('[MainWorldBundle] 🌉 Bridge ISOLATED ↔ MAIN world установлен');
