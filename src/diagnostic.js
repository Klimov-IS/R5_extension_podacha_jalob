/**
 * Diagnostic Tool - Подача жалоб v3.0
 *
 * @version 3.0.0 - Minimal UI redesign
 * @since 02.02.2026
 */

'use strict';

// Настройки многораундовой обработки
const COMPLAINTS_PER_ROUND = 300;
const MAX_ROUNDS_SAFETY = 50; // Safety cap против бесконечного цикла

// ========================================================================
// DOM ЭЛЕМЕНТЫ
// ========================================================================

const storeSelect = document.getElementById('store-select');
const btnGetComplaints = document.getElementById('btn-get-complaints');
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

// Состояние
let loadedComplaints = [];
let currentStoreId = null;

// ========================================================================
// ИНИЦИАЛИЗАЦИЯ
// ========================================================================

document.addEventListener('DOMContentLoaded', async () => {
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
  btnGetComplaints.disabled = !hasSelection;

  // Сбрасываем состояние при смене магазина
  if (hasSelection) {
    hideError();
    hideResults();
    hidePreview();
    complaintsInfo.classList.add('hidden');
    btnSubmit.disabled = true;
    loadedComplaints = [];

  }
});

// ========================================================================
// ПОЛУЧЕНИЕ ЖАЛОБ
// ========================================================================

btnGetComplaints.addEventListener('click', getComplaints);

async function getComplaints() {
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
  btnGetComplaints.disabled = true;
  btnGetComplaints.textContent = '⏳ Загрузка...';
  hideError();
  hideResults();

  try {
    const apiResponse = await chrome.runtime.sendMessage({
      type: 'getComplaints',
      storeId: storeId,
      skip: 0,
      take: 300
    });

    if (!apiResponse || apiResponse.error) {
      throw new Error(apiResponse?.error || 'Не удалось получить жалобы от API');
    }

    loadedComplaints = apiResponse.data || [];

    if (loadedComplaints.length === 0) {
      throw new Error('Нет жалоб для обработки. Убедитесь что в системе есть жалобы со статусом "draft".');
    }

    // Показываем счётчик
    complaintsCountEl.textContent = loadedComplaints.length;
    complaintsInfo.classList.remove('hidden');
    btnSubmit.disabled = false;

    // Показываем превью
    showPreview(loadedComplaints);

  } catch (error) {
    console.error('[Diagnostic] Ошибка:', error);
    showError(error.message);
  } finally {
    storeSelect.disabled = false;
    btnGetComplaints.disabled = false;
    btnGetComplaints.textContent = '📥 Получить жалобы';
  }
}

// ========================================================================
// ПОДАЧА ЖАЛОБ
// ========================================================================

btnSubmit.addEventListener('click', submitComplaints);

async function submitComplaints() {
  if (loadedComplaints.length === 0) {
    showError('Сначала получите жалобы');
    return;
  }

  // Подтверждение
  const storeName = storeSelect.options[storeSelect.selectedIndex].textContent;
  const confirmed = confirm(
    `ВНИМАНИЕ! РЕАЛЬНАЯ ПОДАЧА ЖАЛОБ!\n\n` +
    `Магазин: ${storeName}\n` +
    `Первая порция: ${loadedComplaints.length} жалоб\n\n` +
    `Система будет запрашивать жалобы порциями по ${COMPLAINTS_PER_ROUND},\n` +
    `пока API не вернёт меньше ${COMPLAINTS_PER_ROUND} (все обработаны).\n\n` +
    `Перед ПЕРВОЙ жалобой вы увидите заполненную форму для проверки.\n\n` +
    `Продолжить?`
  );

  if (!confirmed) {
    return;
  }

  // Блокируем UI
  storeSelect.disabled = true;
  btnGetComplaints.disabled = true;
  btnSubmit.disabled = true;
  btnSubmit.textContent = '⏳ Подача...';
  hideError();
  showProgress('Поиск вкладки WB...');

  // Накопительная статистика за все раунды
  const totalStats = {
    rounds: 0,
    complaintsReceived: 0,
    reviewsFound: 0,
    totalReviewsSynced: 0,
    canSubmitComplaint: 0,
    submitted: 0,
    alreadyProcessed: 0,
    errors: 0,
    uniqueArticles: new Set(),
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
      updateProgress(10 + (round - 1) * 2, `Раунд ${round}: Получение жалоб...`);

      // 3. Запросить жалобы от API
      const apiResponse = await chrome.runtime.sendMessage({
        type: 'getComplaints',
        storeId: currentStoreId,
        skip: 0,
        take: COMPLAINTS_PER_ROUND
      });

      if (!apiResponse || apiResponse.error) {
        console.error('[Diagnostic] Ошибка API:', apiResponse?.error);
        totalStats.overallStatus = 'ERROR: API failed';
        break;
      }

      const complaints = apiResponse.data || [];

      // Условие выхода: 0 жалоб
      if (complaints.length === 0) {
        totalStats.overallStatus = 'SUCCESS: Все жалобы обработаны';
        break;
      }

      updateProgress(15 + (round - 1) * 2, `Раунд ${round}: Обработка ${complaints.length} жалоб...`);

      // 4. Отправить на обработку в WB вкладку
      const response = await chrome.tabs.sendMessage(wbTab.id, {
        type: 'test4Diagnostics',
        complaints: complaints,
        storeId: currentStoreId
      });

      if (!response.success) {
        console.error('[Diagnostic] Ошибка обработки:', response.error);
        totalStats.overallStatus = `ERROR: ${response.error || 'Processing failed'}`;
        break;
      }

      const roundReport = response.report;

      // 5. Накопить статистику
      totalStats.rounds++;
      totalStats.complaintsReceived += roundReport.complaintsReceived || 0;
      totalStats.reviewsFound += roundReport.reviewsFound || 0;
      totalStats.totalReviewsSynced += roundReport.totalReviewsSynced || 0;
      totalStats.canSubmitComplaint += roundReport.canSubmitComplaint || 0;
      totalStats.submitted += roundReport.submitted || 0;
      totalStats.alreadyProcessed += roundReport.alreadyProcessed || 0;
      totalStats.errors += roundReport.errors || 0;

      // Собираем уникальные артикулы
      if (roundReport.articleResults && Array.isArray(roundReport.articleResults)) {
        roundReport.articleResults.forEach(a => totalStats.uniqueArticles.add(a.productId));
      }

      // Если раунд был отменён
      if (roundReport.cancelled) {
        totalStats.overallStatus = 'CANCELLED: Прервано пользователем';
        break;
      }

      // Условие выхода: API вернул меньше лимита — это была последняя порция
      if (complaints.length < COMPLAINTS_PER_ROUND) {
        totalStats.overallStatus = 'SUCCESS: Все жалобы обработаны';
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
      complaintsReceived: totalStats.complaintsReceived,
      reviewsFound: totalStats.reviewsFound,
      totalReviewsSynced: totalStats.totalReviewsSynced,
      canSubmitComplaint: totalStats.canSubmitComplaint,
      submitted: totalStats.submitted,
      alreadyProcessed: totalStats.alreadyProcessed,
      errors: totalStats.errors,
      uniqueArticles: totalStats.uniqueArticles.size,
      overallStatus: totalStats.overallStatus
    });

  } catch (error) {
    console.error('[Diagnostic] Ошибка:', error);
    hideProgress();
    showError(error.message);
  } finally {
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

function showPreview(complaints) {
  // Группируем по артикулам
  const byArticle = {};
  complaints.forEach(c => {
    const articleId = c.productId || c.nmId || 'unknown';
    if (!byArticle[articleId]) {
      byArticle[articleId] = [];
    }
    byArticle[articleId].push(c);
  });

  // Генерируем HTML аккордеона
  let html = '';
  for (const [articleId, articleComplaints] of Object.entries(byArticle)) {
    html += `
      <div class="accordion-item">
        <div class="accordion-header">
          <div class="accordion-header-left">
            <span class="accordion-article">Артикул: ${articleId}</span>
            <span class="accordion-count">${articleComplaints.length} жалоб</span>
          </div>
          <span class="accordion-arrow">▼</span>
        </div>
        <div class="accordion-content">
    `;

    articleComplaints.forEach(c => {
      const date = c.reviewDate ? new Date(c.reviewDate).toLocaleDateString('ru-RU') : 'N/A';
      const rating = c.rating || 0;
      const category = c.complaintData?.reasonName || c.reasonName || 'Не указана';
      const text = c.complaintData?.complaintText || c.complaintText || '';
      const reviewId = c.reviewId || c.id || '—';

      html += `
        <div class="complaint-item">
          <div class="complaint-row">
            <span class="complaint-rating">${'⭐'.repeat(rating) || '—'}</span>
            <span class="complaint-date">${date}</span>
            <span class="complaint-category">${category}</span>
            <span class="complaint-review-id">ID: ${reviewId}</span>
          </div>
          ${text ? `<div class="complaint-text">${escapeHtml(text)}</div>` : ''}
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  }

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
  btnGetComplaints.disabled = false;
  btnGetComplaints.textContent = '📥 Получить жалобы';
  btnSubmit.disabled = loadedComplaints.length === 0;
  btnSubmit.textContent = '▶️ Подать жалобы';
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
      label: 'Жалоб получено из API',
      value: report.complaintsReceived || 0,
      status: 'info',
      statusText: 'Загружено'
    },
    {
      label: 'Уникальных артикулов',
      value: report.uniqueArticles || 0,
      status: 'info',
      statusText: 'Обработано'
    },
    {
      label: 'Отзывов найдено на WB',
      value: report.reviewsFound || 0,
      status: 'info',
      statusText: 'Спарсено'
    },
    {
      label: 'Отзывов синхронизировано в БД',
      value: report.totalReviewsSynced || 0,
      status: 'info',
      statusText: 'Синхронизировано'
    },
    {
      label: 'Совпадений (жалоба ↔ отзыв)',
      value: report.canSubmitComplaint || 0,
      status: report.canSubmitComplaint > 0 ? 'success' : 'warning',
      statusText: report.canSubmitComplaint > 0 ? 'Найдено' : 'Не найдено'
    },
    {
      label: 'Жалоб подано успешно',
      value: report.submitted || 0,
      status: report.submitted > 0 ? 'success' : 'warning',
      statusText: report.submitted > 0 ? 'Успешно' : 'Нет'
    },
    {
      label: 'Пропущено (уже обработаны)',
      value: report.alreadyProcessed || 0,
      status: 'info',
      statusText: 'Пропущено'
    },
    {
      label: 'Ошибки при подаче',
      value: report.errors || 0,
      status: report.errors > 0 ? 'error' : 'success',
      statusText: report.errors > 0 ? 'Ошибка' : 'Нет ошибок'
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

