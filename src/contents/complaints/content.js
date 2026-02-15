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


// ========================================================================
// ИНЖЕКТ BUNDLE В MAIN WORLD
// ========================================================================

/**
 * Инжектит bundle в MAIN world через <script> тег
 * @returns {Promise<void>}
 */
function injectMainWorldBundle() {
  return new Promise((resolve, reject) => {
    // Слушаем событие готовности bundle (отправляется из main-world-entry.js)
    window.addEventListener('wb-content-bundle-ready', (event) => {
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
    return;
  }

  try {
    // 1. Инжектим bundle в MAIN world
    const bundleInfo = await injectMainWorldBundle();
    // 2. Регистрируем message listener в ISOLATED world
    // ВАЖНО: НЕ используем async callback - это ломает sendResponse в Chrome Extensions!
    // Вместо этого используем IIFE для асинхронного кода
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

      // ============ PING HANDLER ============
      // Проверка готовности content script (синхронный)
      if (request.type === "ping") {
        sendResponse({ status: "ready", bundleVersion: bundleInfo.version });
        return true;
      }

      // ============ OPTIMIZED HANDLER ============
      // Новый оптимизированный обработчик с модульной архитектурой
      // Использует: DataExtractor, SearchService, NavigationService, ComplaintService
      if (request.type === "processComplaintsFromAPI") {

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

          // Ждем ответа
          try {
            await responsePromise;
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
        return;
      }

      // ============ DIAGNOSTIC TEST ============
      if (request.type === "diagnosticTest") {

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

          try {
            const report = await responsePromise;
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

          try {
            const report = await responsePromise;
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
        // Получаем жалобы от API
        const complaints = request.complaints || [];

        if (complaints.length === 0) {
          sendResponse({ success: false, error: 'Нет жалоб для теста' });
          return true;
        }

        // IIFE для асинхронного кода
        (async () => {
          const requestId = `test3_${Date.now()}`;

          const responsePromise = new Promise((resolve, reject) => {
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

            const timeout = setTimeout(() => {
              window.removeEventListener('wb-main-world-response', responseHandler);
              reject(new Error('Timeout waiting for Test 3 response'));
            }, 300000); // 5 минут

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

          // Allow GC of complaints array in isolated world (data already passed to MAIN world)
          request.complaints = null;

          try {
            const report = await responsePromise;
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
        const complaints = request.complaints || [];
        const storeId = request.storeId || null;

        if (complaints.length === 0) {
          sendResponse({ success: false, error: 'Нет жалоб для теста' });
          return true;
        }

        // IIFE для асинхронного кода
        (async () => {
          const requestId = `test4_${Date.now()}`;

          const responsePromise = new Promise((resolve, reject) => {
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

            const timeout = setTimeout(() => {
              window.removeEventListener('wb-main-world-response', responseHandler);
              reject(new Error('Timeout waiting for Test 4 response'));
            }, 300000); // 5 минут

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

          // Allow GC of complaints array in isolated world (data already passed to MAIN world)
          request.complaints = null;

          try {
            const report = await responsePromise;
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


    // ========================================================================
    // BRIDGE: MAIN WORLD → ISOLATED WORLD → BACKGROUND/POPUP
    // Перенаправление сообщений из MAIN world в Chrome Extension API
    // ========================================================================

    window.addEventListener('wb-send-message', async (event) => {
      const { type, data } = event.detail;

      try {
        await chrome.runtime.sendMessage({
          type: type,
          ...data
        });
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

      try {
        const response = await chrome.runtime.sendMessage({
          type: type,
          storeId: storeId,
          reviews: reviews
        });

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

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'sendComplaint',
          storeId: storeId,
          reviewId: reviewId
        });

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

    window.hasListenerAdded = true;
    console.log('[Complaints] ✅ Content script полностью инициализирован');

  } catch (error) {
    console.error('[Complaints] ❌ Ошибка инициализации:', error);
    console.error('[Complaints] 💡 Проверьте что dist/content-main-world.bundle.js существует и собран webpack');
  }
})();
