/**
 * Content Script - Entry Point
 *
 * Этот файл выполняется в ISOLATED world и выполняет две задачи:
 * 1. Инжектит bundle (main-world-entry.js) в MAIN world через <script> тег
 * 2. Регистрирует message listener для общения с complaints-page.js
 *
 * Модульная архитектура (Phase 3 - January 2026):
 * - DOM модули загружаются в MAIN world (доступны в консоли)
 * - content.js остается в ISOLATED world (доступ к chrome.runtime API)
 *
 * @module contents/complaints/content
 * @since 2.0.0 (30.01.2026)
 */

'use strict';

console.log('[Complaints] 🔵 content.js начал загрузку в ISOLATED world');

// ========================================================================
// ИНЖЕКТ BUNDLE В MAIN WORLD
// ========================================================================

/**
 * Инжектит bundle в MAIN world через <script> тег
 * @returns {Promise<void>}
 */
function injectMainWorldBundle() {
  return new Promise((resolve, reject) => {
    console.log('[Complaints] 📦 Инжектим bundle в MAIN world...');

    // Слушаем событие готовности bundle (отправляется из main-world-entry.js)
    window.addEventListener('wb-content-bundle-ready', (event) => {
      console.log('[Complaints] ✅ Bundle готов в MAIN world:', event.detail);
      resolve(event.detail);
    }, { once: true });

    // Создаем <script> тег для инжекта
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('dist/content-main-world.bundle.js');
    script.type = 'text/javascript';

    script.onerror = () => {
      console.error('[Complaints] ❌ Ошибка загрузки bundle');
      reject(new Error('Failed to load bundle'));
    };

    // Инжектим в MAIN world
    (document.head || document.documentElement).appendChild(script);

    // Удаляем script тег после загрузки (код уже выполнен и остался в памяти)
    script.onload = () => {
      script.remove();
      console.log('[Complaints] 📦 Bundle script тег удален (код остался в памяти)');
    };

    // Timeout на случай если событие не придет
    setTimeout(() => {
      reject(new Error('Bundle loading timeout (10 seconds)'));
    }, 10000);
  });
}

// ========================================================================
// ИНИЦИАЛИЗАЦИЯ CONTENT SCRIPT
// ========================================================================

(async function initContentScript() {
  // Защита от повторного выполнения скрипта
  if (window.hasListenerAdded) {
    console.log('[Complaints] ℹ️ Скрипт уже был загружен ранее');
    return;
  }

  try {
    // 1. Инжектим bundle в MAIN world
    const bundleInfo = await injectMainWorldBundle();
    console.log('[Complaints] ✅ Bundle успешно загружен. Модули:', bundleInfo.modules.join(', '));

    // 2. Регистрируем message listener в ISOLATED world
    // ВАЖНО: НЕ используем async callback - это ломает sendResponse в Chrome Extensions!
    // Вместо этого используем IIFE для асинхронного кода
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

      // ============ PING HANDLER ============
      // Проверка готовности content script (синхронный)
      if (request.type === "ping") {
        console.log("[Complaints] Получен ping, отвечаем pong");
        sendResponse({ status: "ready", bundleVersion: bundleInfo.version });
        return true;
      }

      // ============ OPTIMIZED HANDLER ============
      // Новый оптимизированный обработчик с модульной архитектурой
      // Использует: DataExtractor, SearchService, NavigationService, ComplaintService
      if (request.type === "processComplaintsFromAPI") {
        console.log("[Complaints] 🚀 Запуск оптимизированного обработчика...");

        // IIFE для асинхронного кода
        (async () => {
          // Отправляем команду в MAIN world через bridge
          // ISOLATED world не имеет прямого доступа к window.OptimizedHandler
          const requestId = `req_${Date.now()}`;

          // Создаем Promise для ожидания ответа от MAIN world
          const responsePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Timeout waiting for MAIN world response'));
            }, 60000); // 60 секунд таймаут

            const responseHandler = (event) => {
              if (event.detail.requestId === requestId) {
                clearTimeout(timeout);
                window.removeEventListener('wb-main-world-response', responseHandler);

                if (event.detail.success) {
                  resolve(event.detail.data);
                } else {
                  reject(new Error(event.detail.error));
                }
              }
            };

            window.addEventListener('wb-main-world-response', responseHandler);
          });

          // Отправляем команду в MAIN world
          window.dispatchEvent(new CustomEvent('wb-call-main-world', {
            detail: {
              action: 'processComplaintsFromAPI',
              data: request,
              requestId
            }
          }));

          console.log("[Complaints] 📤 Команда отправлена в MAIN world, requestId:", requestId);

          // Ждем ответа
          try {
            await responsePromise;
            console.log("[Complaints] ✅ Обработка завершена в MAIN world");
            sendResponse({ success: true });
          } catch (error) {
            console.error("[Complaints] ❌ Ошибка в MAIN world:", error);
            sendResponse({ error: error.message });
          }
        })();

        return true; // Синхронно возвращаем true для async ответа
      }

      // ============ LEGACY HANDLER ============
      // Старый обработчик для обратной совместимости
      if (request.type === "searchParametrs") {
        console.log("[Complaints] ⚠️ Запуск legacy обработчика (устаревший)...");
        console.warn("[Complaints] Legacy handler запрещен в Phase 3. Используйте 'processComplaintsFromAPI'");
        return;
      }

      // ============ DIAGNOSTIC TEST ============
      if (request.type === "diagnosticTest") {
        console.log("[Complaints] 🔍 Запуск диагностики DOM элементов...");

        // IIFE для асинхронного кода
        (async () => {
          // Используем bridge для вызова runDiagnostics в MAIN world
          const requestId = `diag_${Date.now()}`;

          const responsePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Timeout waiting for diagnostic response'));
            }, 30000); // 30 секунд для диагностики

            const responseHandler = (event) => {
              if (event.detail.requestId === requestId) {
                clearTimeout(timeout);
                window.removeEventListener('wb-main-world-response', responseHandler);

                if (event.detail.success) {
                  resolve(event.detail.data);
                } else {
                  reject(new Error(event.detail.error));
                }
              }
            };

            window.addEventListener('wb-main-world-response', responseHandler);
          });

          // Отправляем команду runDiagnostics в MAIN world
          window.dispatchEvent(new CustomEvent('wb-call-main-world', {
            detail: {
              action: 'runDiagnostics',
              data: {},
              requestId
            }
          }));

          console.log("[Complaints] 📤 Диагностическая команда отправлена в MAIN world, requestId:", requestId);

          try {
            const report = await responsePromise;
            console.log("[Complaints] ✅ Диагностика завершена");
            sendResponse({ success: true, report: report });
          } catch (error) {
            console.error("[Complaints] ❌ Ошибка диагностики:", error);
            sendResponse({ success: false, error: error.message });
          }
        })();

        return true; // Синхронно возвращаем true для async ответа
      }

      // ============ EXTENDED DIAGNOSTIC TEST ============
      if (request.type === "extendedDiagnosticTest") {
        console.log("[Complaints] 🔬 Запуск расширенной диагностики...");

        // IIFE для асинхронного кода
        (async () => {
          const requestId = `ext_diag_${Date.now()}`;

          const responsePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Timeout waiting for extended diagnostic response'));
            }, 120000); // 120 секунд для расширенной диагностики (поиск + пагинация)

            const responseHandler = (event) => {
              if (event.detail.requestId === requestId) {
                clearTimeout(timeout);
                window.removeEventListener('wb-main-world-response', responseHandler);

                if (event.detail.success) {
                  resolve(event.detail.data);
                } else {
                  reject(new Error(event.detail.error));
                }
              }
            };

            window.addEventListener('wb-main-world-response', responseHandler);
          });

          // Отправляем команду runExtendedDiagnostics в MAIN world
          window.dispatchEvent(new CustomEvent('wb-call-main-world', {
            detail: {
              action: 'runExtendedDiagnostics',
              data: {},
              requestId
            }
          }));

          console.log("[Complaints] 📤 Расширенная диагностика отправлена в MAIN world, requestId:", requestId);

          try {
            const report = await responsePromise;
            console.log("[Complaints] ✅ Расширенная диагностика завершена");
            sendResponse({ success: true, report: report });
          } catch (error) {
            console.error("[Complaints] ❌ Ошибка расширенной диагностики:", error);
            sendResponse({ success: false, error: error.message });
          }
        })();

        return true; // Синхронно возвращаем true для async ответа
      }

      // ============ TEST 3: INTEGRATION WITH API ============
      if (request.type === "test3Diagnostics") {
        console.log("[Complaints] 🧪 Запуск Теста 3 (интеграция с API)...");

        // Получаем жалобы от API
        const complaints = request.complaints || [];
        console.log(`[Complaints] 📥 Получено ${complaints.length} жалоб для теста`);

        if (complaints.length === 0) {
          sendResponse({ success: false, error: 'Нет жалоб для теста' });
          return true;
        }

        // IIFE для асинхронного кода
        (async () => {
          const requestId = `test3_${Date.now()}`;

          const responsePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Timeout waiting for Test 3 response'));
            }, 600000); // 10 минут для полного теста с 50 жалобами

            const responseHandler = (event) => {
              if (event.detail.requestId === requestId) {
                clearTimeout(timeout);
                window.removeEventListener('wb-main-world-response', responseHandler);

                if (event.detail.success) {
                  resolve(event.detail.data);
                } else {
                  reject(new Error(event.detail.error));
                }
              }
            };

            window.addEventListener('wb-main-world-response', responseHandler);
          });

          // Отправляем команду runTest3Diagnostics в MAIN world
          window.dispatchEvent(new CustomEvent('wb-call-main-world', {
            detail: {
              action: 'runTest3Diagnostics',
              data: { complaints },
              requestId
            }
          }));

          console.log("[Complaints] 📤 Тест 3 отправлен в MAIN world, requestId:", requestId);

          try {
            const report = await responsePromise;
            console.log("[Complaints] ✅ Тест 3 завершен");
            sendResponse({ success: true, report: report });
          } catch (error) {
            console.error("[Complaints] ❌ Ошибка Теста 3:", error);
            sendResponse({ success: false, error: error.message });
          }
        })();

        return true; // Синхронно возвращаем true для async ответа
      }

      // ============ TEST 4: FULL INTEGRATION WITH REAL SUBMISSION ============
      if (request.type === "test4Diagnostics") {
        console.log("[Complaints] 🚀 Запуск Теста 4 (реальная подача жалоб)...");

        const complaints = request.complaints || [];
        const storeId = request.storeId || null;
        console.log(`[Complaints] 📥 Получено ${complaints.length} жалоб, storeId: ${storeId}`);

        if (complaints.length === 0) {
          sendResponse({ success: false, error: 'Нет жалоб для теста' });
          return true;
        }

        // IIFE для асинхронного кода
        (async () => {
          const requestId = `test4_${Date.now()}`;

          const responsePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Timeout waiting for Test 4 response'));
            }, 1800000); // 30 минут для полного теста с реальной подачей

            const responseHandler = (event) => {
              if (event.detail.requestId === requestId) {
                clearTimeout(timeout);
                window.removeEventListener('wb-main-world-response', responseHandler);

                if (event.detail.success) {
                  resolve(event.detail.data);
                } else {
                  reject(new Error(event.detail.error));
                }
              }
            };

            window.addEventListener('wb-main-world-response', responseHandler);
          });

          // Отправляем команду runTest4Diagnostics в MAIN world
          window.dispatchEvent(new CustomEvent('wb-call-main-world', {
            detail: {
              action: 'runTest4Diagnostics',
              data: { complaints, storeId },
              requestId
            }
          }));

          console.log("[Complaints] 📤 Тест 4 отправлен в MAIN world, requestId:", requestId);

          try {
            const report = await responsePromise;
            console.log("[Complaints] ✅ Тест 4 завершен");
            sendResponse({ success: true, report: report });
          } catch (error) {
            console.error("[Complaints] ❌ Ошибка Теста 4:", error);
            sendResponse({ success: false, error: error.message });
          }
        })();

        return true; // Синхронно возвращаем true для async ответа
      }

      // ============ UNKNOWN REQUEST TYPE ============
      console.warn("[Complaints] ⚠️ Неизвестный тип запроса:", request.type);
    });

    console.log('[Complaints] ✅ Message listener успешно зарегистрирован');

    // ========================================================================
    // BRIDGE: MAIN WORLD → ISOLATED WORLD → BACKGROUND/POPUP
    // Перенаправление сообщений из MAIN world в Chrome Extension API
    // ========================================================================

    window.addEventListener('wb-send-message', async (event) => {
      const { type, data } = event.detail;

      console.log(`[Complaints] 📤 Перенаправление сообщения из MAIN world: ${type}`, data);

      try {
        await chrome.runtime.sendMessage({
          type: type,
          ...data
        });
        console.log(`[Complaints] ✅ Сообщение отправлено: ${type}`);
      } catch (error) {
        console.error(`[Complaints] ❌ Ошибка отправки сообщения ${type}:`, error);
      }
    });

    // ========================================================================
    // BRIDGE: Status Sync с поддержкой ответов
    // MAIN world → ISOLATED world → Background → ISOLATED world → MAIN world
    // ========================================================================

    window.addEventListener('wb-sync-request', async (event) => {
      const { requestId, type, storeId, reviews } = event.detail;

      console.log(`[Complaints] 📤 Sync request: ${type}, requestId: ${requestId}`);

      try {
        const response = await chrome.runtime.sendMessage({
          type: type,
          storeId: storeId,
          reviews: reviews
        });

        console.log(`[Complaints] ✅ Sync response received:`, response);

        // Отправляем ответ обратно в MAIN world
        window.dispatchEvent(new CustomEvent('wb-sync-response', {
          detail: {
            requestId: requestId,
            response: response
          }
        }));
      } catch (error) {
        console.error(`[Complaints] ❌ Ошибка sync:`, error);

        // Отправляем ошибку в MAIN world
        window.dispatchEvent(new CustomEvent('wb-sync-response', {
          detail: {
            requestId: requestId,
            response: { success: false, error: error.message }
          }
        }));
      }
    });

    // ========================================================================
    // BRIDGE: Send Complaint с поддержкой ответов
    // MAIN world → ISOLATED world → Background → ISOLATED world → MAIN world
    // ========================================================================

    window.addEventListener('wb-send-complaint-request', async (event) => {
      const { requestId, storeId, reviewId } = event.detail;

      console.log(`[Complaints] 📤 SendComplaint request: storeId=${storeId}, reviewId=${reviewId}`);

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'sendComplaint',
          storeId: storeId,
          reviewId: reviewId
        });

        console.log(`[Complaints] ✅ SendComplaint response:`, response);

        // Отправляем ответ обратно в MAIN world
        window.dispatchEvent(new CustomEvent('wb-send-complaint-response', {
          detail: {
            requestId: requestId,
            response: response
          }
        }));
      } catch (error) {
        console.error(`[Complaints] ❌ Ошибка sendComplaint:`, error);

        // Отправляем ошибку в MAIN world
        window.dispatchEvent(new CustomEvent('wb-send-complaint-response', {
          detail: {
            requestId: requestId,
            response: { error: error.message }
          }
        }));
      }
    });

    console.log('[Complaints] 🌉 Bridge для отправки сообщений установлен');
    console.log('[Complaints] 🔄 Bridge для Status Sync установлен');
    console.log('[Complaints] 📤 Bridge для SendComplaint установлен');

    window.hasListenerAdded = true;
    console.log('[Complaints] ✅ Content script полностью инициализирован');

  } catch (error) {
    console.error('[Complaints] ❌ Ошибка инициализации:', error);
    console.error('[Complaints] 💡 Проверьте что dist/content-main-world.bundle.js существует и собран webpack');
  }
})();
