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

      // ============ COMPLAINT PROCESSING ============
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
            }, 1800000); // 30 минут (300 жалоб × ~3 сек = ~15 мин)

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

      // ============ TASK WORKFLOW PROCESSING ============
      if (request.type === "runTaskWorkflow") {
        const tasks = request.tasks || {};
        const storeId = request.storeId || null;
        const enabledTaskTypes = request.enabledTaskTypes || null;

        if (!tasks.articles || Object.keys(tasks.articles).length === 0) {
          sendResponse({ success: false, error: 'No tasks to process' });
          return true;
        }

        (async () => {
          const requestId = `tasks_${Date.now()}`;

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
              reject(new Error('Timeout waiting for Task Workflow response'));
            }, 1800000); // 30 минут

            window.addEventListener('wb-main-world-response', responseHandler);
          });

          window.dispatchEvent(new CustomEvent('wb-call-main-world', {
            detail: {
              action: 'runTaskWorkflow',
              data: { tasks, storeId, enabledTaskTypes },
              requestId
            }
          }));

          request.tasks = null; // Allow GC

          try {
            const report = await responsePromise;
            sendResponse({ success: true, report });
          } catch (error) {
            console.error("[Complaints] Task workflow error:", error);
            sendResponse({ success: false, error: error.message });
          }
        })();

        return true;
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
      const { requestId, type, storeId, reviews, notFoundReviewKeys } = event.detail;

      try {
        const msg = { type, storeId, reviews };
        if (notFoundReviewKeys && notFoundReviewKeys.length > 0) {
          msg.notFoundReviewKeys = notFoundReviewKeys;
        }
        const response = await chrome.runtime.sendMessage(msg);

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

    // ========================================================================
    // BRIDGE: Chat Processing (открытие чатов)
    // MAIN world → ISOLATED world → Background → ISOLATED world → MAIN world
    // ========================================================================

    window.addEventListener('wb-chat-request', async (event) => {
      const { requestId, ...data } = event.detail;

      console.log('[Complaints] wb-chat-request → sending processChatTab to background', { requestId, productId: data.productId, storeId: data.storeId, tabId: data.tabId || null });

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'processChatTab',
          ...data
        });

        console.log('[Complaints] wb-chat-request ← response from background', { requestId, success: response?.success, chatRecordId: response?.chatRecordId });

        window.dispatchEvent(new CustomEvent('wb-chat-response', {
          detail: { requestId, response }
        }));
      } catch (error) {
        console.error('[Complaints] Chat bridge error:', error);
        window.dispatchEvent(new CustomEvent('wb-chat-response', {
          detail: { requestId, response: { success: false, error: error.message } }
        }));
      }
    });

    // ========================================================================
    // BRIDGE: Create Tab (обход popup-блокировки Chrome)
    // MAIN world → ISOLATED world → Background → chrome.tabs.create()
    // Возвращает tabId обратно в MAIN world через wb-create-tab-response
    // ========================================================================

    window.addEventListener('wb-create-tab', async (event) => {
      const { url, correlationId } = event.detail;
      if (!url) return;

      console.log('[Complaints] wb-create-tab → creating tab:', url?.substring(0, 80), 'correlationId:', correlationId);

      try {
        const result = await chrome.runtime.sendMessage({
          type: 'createTab',
          url: url
        });
        console.log('[Complaints] wb-create-tab ← result:', result);

        // Relay tabId back to MAIN world for direct tab processing
        if (correlationId) {
          window.dispatchEvent(new CustomEvent('wb-create-tab-response', {
            detail: {
              correlationId,
              tabId: result?.tabId || null,
              success: result?.success || false
            }
          }));
        }
      } catch (error) {
        console.error('[Complaints] Create tab bridge error:', error);
        if (correlationId) {
          window.dispatchEvent(new CustomEvent('wb-create-tab-response', {
            detail: { correlationId, tabId: null, success: false, error: error.message }
          }));
        }
      }
    });

    // ========================================================================
    // BRIDGE: Chat Rules (получение правил чатов)
    // MAIN world → ISOLATED world → Background → ISOLATED world → MAIN world
    // ========================================================================

    window.addEventListener('wb-chat-rules-request', async (event) => {
      const { requestId, storeId } = event.detail;

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'getChatRules',
          storeId
        });

        window.dispatchEvent(new CustomEvent('wb-chat-rules-response', {
          detail: { requestId, response }
        }));
      } catch (error) {
        console.error('[Complaints] Chat rules bridge error:', error);
        window.dispatchEvent(new CustomEvent('wb-chat-rules-response', {
          detail: { requestId, response: { success: false, error: error.message } }
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
