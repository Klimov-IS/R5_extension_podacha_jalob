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
const resultsCard = document.getElementById('results-card');
const resultsBody = document.getElementById('results-body');
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

      // Форматируем количество жалоб к подаче (API v1.2.0)
      const count = store.draftComplaintsCount || 0;
      const countText = count === 0 ? '' : ` — ${count} жалоб`;
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
    hideResults();
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
  hideResults();

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

  // Накопительная статистика за все раунды
  const totalStats = {
    rounds: 0,
    totalReviewsSynced: 0,
    chatsOpened: 0,
    chatErrors: 0,
    complaintsSubmitted: 0,
    complaintsSkipped: 0,
    complaintsErrors: 0,
    uniqueArticles: new Set(),
    tabSwitches: 0,
    overallStatus: 'COMPLETED'
  };

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

    while (round <= MAX_ROUNDS_SAFETY) {
      updateProgress(10 + (round - 1) * 2, `Раунд ${round}: Получение задач...`);

      // 3. Запросить задачи от API
      const apiResponse = await chrome.runtime.sendMessage({
        type: 'getTasks',
        storeId: currentStoreId
      });

      if (!apiResponse || apiResponse.error) {
        console.error('[Diagnostic] Ошибка API:', apiResponse?.error);
        totalStats.overallStatus = 'ERROR: API failed';
        break;
      }

      const tasks = apiResponse.data;
      const roundTotals = tasks.totals || {};
      const roundTotal = (roundTotals.statusParses || 0) + (roundTotals.chatOpens || 0) + (roundTotals.complaints || 0);

      // Условие выхода: 0 задач
      if (roundTotal === 0) {
        totalStats.overallStatus = 'SUCCESS: Все задачи обработаны';
        break;
      }

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
        totalStats.overallStatus = `ERROR: ${response.error || 'Processing failed'}`;
        break;
      }

      const roundReport = response.report;

      // 5. Накопить статистику
      totalStats.rounds++;
      totalStats.totalReviewsSynced += roundReport.totalReviewsSynced || 0;
      totalStats.chatsOpened += roundReport.chatsOpened || 0;
      totalStats.chatErrors += roundReport.chatErrors || 0;
      totalStats.complaintsSubmitted += roundReport.complaintsSubmitted || 0;
      totalStats.complaintsSkipped += roundReport.complaintsSkipped || 0;
      totalStats.complaintsErrors += roundReport.complaintsErrors || 0;
      totalStats.tabSwitches += roundReport.tabSwitches || 0;

      // Собираем уникальные артикулы
      if (roundReport.articleResults && Array.isArray(roundReport.articleResults)) {
        roundReport.articleResults.forEach(a => totalStats.uniqueArticles.add(a.productId));
      }

      // Если раунд был отменён
      if (roundReport.cancelled) {
        totalStats.overallStatus = 'CANCELLED: Прервано пользователем';
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
    if (round > MAX_ROUNDS_SAFETY && totalStats.overallStatus === 'COMPLETED') {
      totalStats.overallStatus = `WARNING: Достигнут safety-лимит ${MAX_ROUNDS_SAFETY} раундов`;
    }

    // 7. Показать итоговые результаты
    hideProgress();
    displayResults({
      rounds: totalStats.rounds,
      totalReviewsSynced: totalStats.totalReviewsSynced,
      chatsOpened: totalStats.chatsOpened,
      chatErrors: totalStats.chatErrors,
      complaintsSubmitted: totalStats.complaintsSubmitted,
      complaintsSkipped: totalStats.complaintsSkipped,
      complaintsErrors: totalStats.complaintsErrors,
      uniqueArticles: totalStats.uniqueArticles.size,
      tabSwitches: totalStats.tabSwitches,
      overallStatus: totalStats.overallStatus
    });

  } catch (error) {
    console.error('[Diagnostic] Ошибка:', error);
    hideProgress();
    showError(error.message);
  } finally {
    // Memory cleanup
    loadedTasks = null;
    totalStats.uniqueArticles.clear();
    resetUI();
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

function hideResults() {
  resultsCard.classList.remove('active');
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

// ========================================================================
// ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ
// ========================================================================

function displayResults(report) {
  resultsCard.classList.add('active');

  const rows = [
    {
      label: 'Раундов выполнено',
      value: report.rounds || 1,
      status: 'info',
      statusText: 'Выполнено'
    },
    {
      label: 'Уникальных артикулов',
      value: report.uniqueArticles || 0,
      status: 'info',
      statusText: 'Обработано'
    },
    {
      label: 'Отзывов синхронизировано (статусы)',
      value: report.totalReviewsSynced || 0,
      status: 'info',
      statusText: 'Синхронизировано'
    },
    {
      label: 'Чатов открыто',
      value: report.chatsOpened || 0,
      status: report.chatsOpened > 0 ? 'success' : 'info',
      statusText: report.chatsOpened > 0 ? 'Успешно' : 'Нет'
    },
    {
      label: 'Ошибки чатов',
      value: report.chatErrors || 0,
      status: report.chatErrors > 0 ? 'error' : 'success',
      statusText: report.chatErrors > 0 ? 'Ошибка' : 'Нет ошибок'
    },
    {
      label: 'Жалоб подано успешно',
      value: report.complaintsSubmitted || 0,
      status: report.complaintsSubmitted > 0 ? 'success' : 'warning',
      statusText: report.complaintsSubmitted > 0 ? 'Успешно' : 'Нет'
    },
    {
      label: 'Жалоб пропущено',
      value: report.complaintsSkipped || 0,
      status: 'info',
      statusText: 'Пропущено'
    },
    {
      label: 'Ошибки жалоб',
      value: report.complaintsErrors || 0,
      status: report.complaintsErrors > 0 ? 'error' : 'success',
      statusText: report.complaintsErrors > 0 ? 'Ошибка' : 'Нет ошибок'
    },
    {
      label: 'Переключений вкладок',
      value: report.tabSwitches || 0,
      status: 'info',
      statusText: 'Навигация'
    }
  ];

  let html = '';
  rows.forEach(row => {
    const badgeClass = `badge-${row.status}`;
    const dotClass = row.status === 'success' ? 'green' :
                     row.status === 'error' ? 'red' :
                     row.status === 'warning' ? 'yellow' : 'blue';

    html += `
      <tr>
        <td>${row.label}</td>
        <td><strong>${row.value}</strong></td>
        <td>
          <span class="badge ${badgeClass}">
            <span class="status-dot ${dotClass}"></span>
            ${row.statusText}
          </span>
        </td>
      </tr>
    `;
  });

  // Итоговый статус
  const overallStatus = report.overallStatus || 'COMPLETED';
  const isSuccess = overallStatus.includes('SUCCESS');
  const isCancelled = overallStatus.includes('CANCELLED');

  html += `
    <tr style="background: ${isSuccess ? '#d1fae5' : isCancelled ? '#fef3c7' : '#fee2e2'};">
      <td><strong>Итог</strong></td>
      <td colspan="2">
        <strong style="color: ${isSuccess ? '#059669' : isCancelled ? '#d97706' : '#dc2626'};">
          ${overallStatus}
        </strong>
      </td>
    </tr>
  `;

  resultsBody.innerHTML = html;
}
