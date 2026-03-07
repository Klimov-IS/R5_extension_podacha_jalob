/**
 * Diagnostic Tool - Unified Tasks v4.0
 *
 * @version 4.0.0 - Unified Tasks API migration
 * @since 19.02.2026
 */

'use strict';

// Настройки многораундовой обработки
const MAX_ROUNDS_SAFETY = 50; // Safety cap против бесконечного цикла

// ========================================================================
// STALL DETECTION HELPERS
// ========================================================================

/**
 * Извлечь множество ключей задач из ответа API
 * Используется для сравнения задач между раундами
 */
function extractTaskKeys(tasks) {
  const keys = new Set();
  const articles = tasks.articles || {};
  for (const [articleId, articleTasks] of Object.entries(articles)) {
    for (const sp of (articleTasks.statusParses || [])) {
      keys.add(`sp:${sp.reviewKey}`);
    }
    for (const ch of (articleTasks.chatOpens || [])) {
      keys.add(`ch:${ch.reviewKey}`);
    }
    for (const c of (articleTasks.complaints || [])) {
      keys.add(`co:${c.reviewKey}`);
    }
  }
  return keys;
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

// ========================================================================
// DOM ЭЛЕМЕНТЫ
// ========================================================================

const storeSelect = document.getElementById('store-select');
const btnGetTasks = document.getElementById('btn-get-complaints'); // HTML ID сохранён
const btnSubmit = document.getElementById('btn-submit');
const complaintsInfo = document.getElementById('complaints-info');
const complaintsCountEl = document.getElementById('complaints-count');
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');
const previewCard = document.getElementById('preview-card');
const previewAccordion = document.getElementById('preview-accordion');
const btnRefreshStores = document.getElementById('btn-refresh-stores');
const taskTypeSelector = document.getElementById('task-type-selector');
const chkStatusParses = document.getElementById('chk-status-parses');
const chkChatOpens = document.getElementById('chk-chat-opens');
const chkComplaints = document.getElementById('chk-complaints');
const countStatusParses = document.getElementById('count-status-parses');
const countChatOpens = document.getElementById('count-chat-opens');
const countComplaints = document.getElementById('count-complaints');

// Состояние
let loadedTasks = null; // { storeId, articles, totals, limits }
let currentStoreId = null;

// ========================================================================
// ИНИЦИАЛИЗАЦИЯ
// ========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Обновляем текст кнопок для Tasks UI
  btnGetTasks.textContent = '📥 Получить задачи';
  btnSubmit.textContent = '▶️ Запустить';
  await loadStores();
});

// ========================================================================
// ЗАГРУЗКА МАГАЗИНОВ
// ========================================================================

async function loadStores(forceRefresh = false) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'getStores',
      forceRefresh
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Не удалось загрузить магазины');
    }

    const stores = response.data;

    // Заполняем дропдаун
    storeSelect.innerHTML = '<option value="">-- Выберите магазин --</option>';

    // Показываем только активные магазины
    const activeStores = stores.filter(store => store.isActive);

    activeStores.forEach(store => {
      const option = document.createElement('option');
      option.value = store.id;

      // Форматируем счётчики задач (API v1.3.0)
      const complaints = store.draftComplaintsCount || 0;
      const chats = store.pendingChatsCount || 0;
      const statusParses = store.pendingStatusParsesCount || 0;
      const parts = [];
      if (complaints > 0) parts.push(`${complaints} жалоб`);
      if (chats > 0) parts.push(`${chats} чатов`);
      if (statusParses > 0) parts.push(`${statusParses} статусов`);
      const countText = parts.length > 0 ? ` — ${parts.join(', ')}` : '';
      option.textContent = store.name + countText;

      storeSelect.appendChild(option);
    });

    storeSelect.disabled = false;

  } catch (error) {
    console.error('[Diagnostic] Ошибка загрузки магазинов:', error);
    showError(`Ошибка загрузки магазинов: ${error.message}`);
    storeSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
  }
}

// ========================================================================
// ОБНОВЛЕНИЕ МАГАЗИНОВ
// ========================================================================

btnRefreshStores.addEventListener('click', async () => {
  btnRefreshStores.disabled = true;
  storeSelect.disabled = true;
  storeSelect.innerHTML = '<option value="">Обновление...</option>';
  hideError();

  try {
    await loadStores(true);
  } finally {
    btnRefreshStores.disabled = false;
  }
});

// ========================================================================
// ВЫБОР МАГАЗИНА
// ========================================================================

storeSelect.addEventListener('change', () => {
  const hasSelection = storeSelect.value !== '';
  btnGetTasks.disabled = !hasSelection;

  // Сбрасываем состояние при смене магазина
  if (hasSelection) {
    hideError();
    hidePreview();
    complaintsInfo.classList.add('hidden');
    taskTypeSelector.classList.remove('active');
    btnSubmit.disabled = true;
    loadedTasks = null;
  }
});

// ========================================================================
// ФИЛЬТР ТИПОВ ЗАДАЧ (checkboxes)
// ========================================================================

function getEnabledTaskTypes() {
  const types = [];
  if (chkStatusParses.checked) types.push('statusParses');
  if (chkChatOpens.checked) types.push('chatOpens');
  if (chkComplaints.checked) types.push('complaints');
  return types;
}

function updateSelectedCount() {
  if (!loadedTasks) return;
  const tc = loadedTasks.totalCounts || loadedTasks.totals || {};
  let total = 0;
  if (chkStatusParses.checked) total += tc.statusParses || 0;
  if (chkChatOpens.checked) total += tc.chatOpens || 0;
  if (chkComplaints.checked) total += tc.complaints || 0;
  complaintsCountEl.textContent = total;
  btnSubmit.disabled = total === 0;
}

[chkStatusParses, chkChatOpens, chkComplaints].forEach(chk => {
  chk.addEventListener('change', updateSelectedCount);
});

// ========================================================================
// ПОЛУЧЕНИЕ ЗАДАЧ (Unified Tasks API)
// ========================================================================

btnGetTasks.addEventListener('click', getTasks);

async function getTasks() {
  const storeId = storeSelect.value;

  if (!storeId) {
    showError('Выберите магазин!');
    return;
  }

  currentStoreId = storeId;

  // Сохраняем выбранный магазин в storage для использования в API
  await chrome.storage.local.set({ currentStoreId: storeId });

  // Блокируем UI
  storeSelect.disabled = true;
  btnGetTasks.disabled = true;
  btnGetTasks.textContent = '⏳ Загрузка...';
  hideError();

  try {
    const apiResponse = await chrome.runtime.sendMessage({
      type: 'getTasks',
      storeId: storeId
    });

    if (!apiResponse || apiResponse.error) {
      throw new Error(apiResponse?.error || 'Не удалось получить задачи от API');
    }

    loadedTasks = apiResponse.data;

    const totals = loadedTasks.totals || {};
    // totalCounts = реальный пул задач (без LIMIT), fallback на totals (батч)
    const tc = loadedTasks.totalCounts || totals;
    const totalCount = (tc.statusParses || 0) + (tc.chatOpens || 0) + (tc.complaints || 0);

    if (totalCount === 0) {
      throw new Error('Нет задач для обработки. Все задачи уже выполнены.');
    }

    // Показываем счётчик (реальный пул)
    complaintsCountEl.textContent = totalCount;
    complaintsInfo.classList.remove('hidden');
    btnSubmit.disabled = false;

    // Показываем чекбоксы типов задач (реальный пул)
    countStatusParses.textContent = tc.statusParses || 0;
    countChatOpens.textContent = tc.chatOpens || 0;
    countComplaints.textContent = tc.complaints || 0;

    // Disable + uncheck types with 0 tasks
    chkStatusParses.disabled = !(tc.statusParses > 0);
    chkStatusParses.checked = tc.statusParses > 0;
    chkChatOpens.disabled = !(tc.chatOpens > 0);
    chkChatOpens.checked = tc.chatOpens > 0;
    chkComplaints.disabled = !(tc.complaints > 0);
    chkComplaints.checked = tc.complaints > 0;

    taskTypeSelector.classList.add('active');

    // Показываем превью
    showPreview(loadedTasks);

  } catch (error) {
    console.error('[Diagnostic] Ошибка:', error);
    showError(error.message);
  } finally {
    storeSelect.disabled = false;
    btnGetTasks.disabled = false;
    btnGetTasks.textContent = '📥 Получить задачи';
  }
}

// ========================================================================
// ЗАПУСК ОБРАБОТКИ ЗАДАЧ
// ========================================================================

btnSubmit.addEventListener('click', submitTasks);

async function submitTasks() {
  if (!loadedTasks) {
    showError('Сначала получите задачи');
    return;
  }

  const totals = loadedTasks.totals || {};
  const tc = loadedTasks.totalCounts || totals;

  // Подтверждение — только выбранные типы
  const enabledTypes = getEnabledTaskTypes();
  const storeName = storeSelect.options[storeSelect.selectedIndex].textContent;

  const typeLines = [];
  if (enabledTypes.includes('statusParses')) typeLines.push(`  • Парсинг статусов: ${tc.statusParses || 0} (батч: ${totals.statusParses || 0})`);
  if (enabledTypes.includes('chatOpens')) typeLines.push(`  • Открытие чатов: ${tc.chatOpens || 0} (батч: ${totals.chatOpens || 0})`);
  if (enabledTypes.includes('complaints')) typeLines.push(`  • Подача жалоб: ${tc.complaints || 0} (батч: ${totals.complaints || 0})`);

  const confirmed = confirm(
    `ВНИМАНИЕ! РЕАЛЬНАЯ ОБРАБОТКА ЗАДАЧ!\n\n` +
    `Магазин: ${storeName}\n\n` +
    `Выбранные задачи (всего / первый батч):\n` +
    typeLines.join('\n') + `\n\n` +
    `Система будет запрашивать задачи порциями,\n` +
    `пока API не вернёт 0 задач (все обработаны).\n\n` +
    `Перед ПЕРВОЙ жалобой вы увидите заполненную форму для проверки.\n\n` +
    `Продолжить?`
  );

  if (!confirmed) {
    return;
  }

  // Блокируем UI
  storeSelect.disabled = true;
  btnGetTasks.disabled = true;
  btnSubmit.disabled = true;
  btnSubmit.textContent = '⏳ Обработка...';
  hideError();
  hidePreview(); // Memory: очищаем превью (большой HTML)
  previewAccordion.innerHTML = '';
  showProgress('Поиск вкладки WB...');

  let overallStatus = 'COMPLETED';

  try {
    // 1. Найти WB вкладку (один раз перед циклом)
    const tabs = await chrome.tabs.query({});
    const wbTab = tabs.find(tab =>
      tab.url &&
      tab.url.includes('seller.wildberries.ru') &&
      tab.url.includes('/feedbacks')
    );

    if (!wbTab) {
      throw new Error('Не найдена вкладка seller.wildberries.ru/feedbacks\n\nОткройте страницу отзывов WB и попробуйте снова.');
    }

    updateProgress(5, 'Проверка content script...');

    // 2. Проверить content script (один раз перед циклом)
    try {
      await chrome.tabs.sendMessage(wbTab.id, { type: 'ping' });
    } catch (error) {
      throw new Error('Content script не готов!\n\nОбновите страницу WB (F5) и попробуйте снова.');
    }

    // ========================================================================
    // МНОГОРАУНДОВЫЙ ЦИКЛ
    // ========================================================================
    let round = 1;
    let previousTaskKeys = null;

    while (round <= MAX_ROUNDS_SAFETY) {
      updateProgress(10 + (round - 1) * 2, `Раунд ${round}: Получение задач...`);

      // 3. Запросить задачи от API
      const apiResponse = await chrome.runtime.sendMessage({
        type: 'getTasks',
        storeId: currentStoreId
      });

      if (!apiResponse || apiResponse.error) {
        console.error('[Diagnostic] Ошибка API:', apiResponse?.error);
        overallStatus = 'ERROR: API failed';
        break;
      }

      const tasks = apiResponse.data;
      const roundTotals = tasks.totals || {};
      const roundTotal = (roundTotals.statusParses || 0) + (roundTotals.chatOpens || 0) + (roundTotals.complaints || 0);

      // Условие выхода: 0 задач
      if (roundTotal === 0) {
        overallStatus = 'SUCCESS: Все задачи обработаны';
        break;
      }

      // Детекция застревания: задачи не изменились с прошлого раунда
      const currentTaskKeys = extractTaskKeys(tasks);
      if (previousTaskKeys && setsEqual(currentTaskKeys, previousTaskKeys)) {
        console.warn(`[Diagnostic] Раунд ${round}: задачи идентичны предыдущему раунду (${currentTaskKeys.size} задач). Прогресса нет — останавливаемся.`);
        overallStatus = `DONE: Оставшиеся ${currentTaskKeys.size} задач не найдены на площадке`;
        break;
      }
      previousTaskKeys = currentTaskKeys;

      updateProgress(
        15 + (round - 1) * 2,
        `Раунд ${round}: Обработка ${roundTotal} задач (парсинг: ${roundTotals.statusParses || 0}, чаты: ${roundTotals.chatOpens || 0}, жалобы: ${roundTotals.complaints || 0})...`
      );

      // 4. Отправить на обработку в WB вкладку
      const response = await chrome.tabs.sendMessage(wbTab.id, {
        type: 'runTaskWorkflow',
        tasks: tasks,
        storeId: currentStoreId,
        enabledTaskTypes: enabledTypes
      });

      if (!response.success) {
        console.error('[Diagnostic] Ошибка обработки:', response.error);
        overallStatus = `ERROR: ${response.error || 'Processing failed'}`;
        break;
      }

      const roundReport = response.report;

      // Если раунд был отменён
      if (roundReport.cancelled) {
        overallStatus = 'CANCELLED: Прервано пользователем';
        break;
      }

      // 6. Следующий раунд
      round++;

      // Пауза между раундами (2 секунды)
      if (round <= MAX_ROUNDS_SAFETY) {
        updateProgress(18 + (round - 2) * 2, `Пауза перед раундом ${round}...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Проверка на достижение safety cap
    if (round > MAX_ROUNDS_SAFETY && overallStatus === 'COMPLETED') {
      overallStatus = `WARNING: Достигнут safety-лимит ${MAX_ROUNDS_SAFETY} раундов`;
    }

    // 7. Завершение
    hideProgress();
    console.log(`[Diagnostic] Завершено: ${overallStatus}`);

  } catch (error) {
    console.error('[Diagnostic] Ошибка:', error);
    hideProgress();
    showError(error.message);
  } finally {
    loadedTasks = null;
    resetUI();

    // Обновляем счётчик жалоб в дропдауне магазинов
    const selectedStoreId = storeSelect.value;
    await loadStores(true);
    // Восстанавливаем выбранный магазин
    if (selectedStoreId) {
      storeSelect.value = selectedStoreId;
    }
  }
}

// ========================================================================
// UI HELPERS
// ========================================================================

function showError(message) {
  errorText.textContent = message;
  errorMessage.classList.add('active');
}

function hideError() {
  errorMessage.classList.remove('active');
}

function showProgress(text) {
  progressSection.classList.add('active');
  progressBar.style.width = '0%';
  progressText.textContent = text;
}

function updateProgress(percent, text) {
  progressBar.style.width = `${percent}%`;
  if (text) progressText.textContent = text;
}

function hideProgress() {
  progressSection.classList.remove('active');
}

function hidePreview() {
  previewCard.classList.remove('active');
}

function showPreview(tasks) {
  const articles = tasks.articles || {};
  const totals = tasks.totals || {};

  let html = '';

  for (const [articleId, articleTasks] of Object.entries(articles)) {
    const statusParses = articleTasks.statusParses || [];
    const chatOpens = articleTasks.chatOpens || [];
    const complaints = articleTasks.complaints || [];
    const articleTotal = statusParses.length + chatOpens.length + complaints.length;

    html += `
      <div class="accordion-item">
        <div class="accordion-header">
          <div class="accordion-header-left">
            <span class="accordion-article">Артикул: ${articleId}</span>
            <span class="accordion-count">${articleTotal} задач</span>
          </div>
          <span class="accordion-arrow">▼</span>
        </div>
        <div class="accordion-content">
    `;

    // Парсинг статусов
    if (statusParses.length > 0) {
      html += `<div class="complaint-item" style="background:#f0f9ff; padding:10px 16px;">
        <strong style="color:#0284c7;">🔍 Парсинг статусов: ${statusParses.length}</strong>
      </div>`;
      statusParses.forEach(sp => {
        html += `
          <div class="complaint-item">
            <div class="complaint-row">
              <span class="complaint-rating">${'⭐'.repeat(sp.rating || 0) || '—'}</span>
              <span class="complaint-date">${sp.reviewKey || '—'}</span>
            </div>
          </div>
        `;
      });
    }

    // Чаты
    if (chatOpens.length > 0) {
      html += `<div class="complaint-item" style="background:#f0fdf4; padding:10px 16px;">
        <strong style="color:#059669;">💬 Чаты: ${chatOpens.length}</strong>
      </div>`;
      chatOpens.forEach(ch => {
        const typeLabel = ch.type === 'link' ? '🔗 привязка' : '📨 открытие';
        html += `
          <div class="complaint-item">
            <div class="complaint-row">
              <span class="complaint-rating">${'⭐'.repeat(ch.rating || 0) || '—'}</span>
              <span class="complaint-date">${ch.reviewKey || '—'}</span>
              <span class="complaint-category">${typeLabel}</span>
            </div>
          </div>
        `;
      });
    }

    // Жалобы
    if (complaints.length > 0) {
      html += `<div class="complaint-item" style="background:#fef2f2; padding:10px 16px;">
        <strong style="color:#dc2626;">📝 Жалобы: ${complaints.length}</strong>
      </div>`;
      complaints.forEach(c => {
        const reasonName = c.reasonName || `Причина #${c.reasonId}`;
        html += `
          <div class="complaint-item">
            <div class="complaint-row">
              <span class="complaint-rating">${'⭐'.repeat(c.rating || 0) || '—'}</span>
              <span class="complaint-date">${c.reviewKey || '—'}</span>
              <span class="complaint-category">${reasonName}</span>
            </div>
            ${c.complaintText ? `<div class="complaint-text">${escapeHtml(c.complaintText)}</div>` : ''}
          </div>
        `;
      });
    }

    html += `
        </div>
      </div>
    `;
  }

  // Итого по типам
  html += `
    <div style="margin-top:12px; padding:12px 16px; background:#f9fafb; border-radius:10px; font-size:13px; color:#6b7280;">
      <strong>Итого:</strong>
      🔍 Парсинг: ${totals.statusParses || 0} •
      💬 Чаты: ${totals.chatOpens || 0} •
      📝 Жалобы: ${totals.complaints || 0}
    </div>
  `;

  previewAccordion.innerHTML = html;
  previewCard.classList.add('active');
}

// Обработчик клика по аккордеону (делегирование)
document.addEventListener('click', (e) => {
  const header = e.target.closest('.accordion-header');
  if (header) {
    const item = header.parentElement;
    item.classList.toggle('open');
  }
});

// Экранирование HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function resetUI() {
  storeSelect.disabled = false;
  btnGetTasks.disabled = false;
  btnGetTasks.textContent = '📥 Получить задачи';
  btnSubmit.disabled = !loadedTasks;
  btnSubmit.textContent = '▶️ Запустить';
}

