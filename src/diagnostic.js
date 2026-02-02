/**
 * Diagnostic Tool - Подача жалоб v3.0
 *
 * @version 3.0.0 - Minimal UI redesign
 * @since 02.02.2026
 */

'use strict';

// ========================================================================
// КОНСТАНТЫ API
// ========================================================================

const BACKEND_ENDPOINT = 'http://158.160.217.236';
const BACKEND_TOKEN = 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

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

// Состояние
let loadedComplaints = [];
let currentStoreId = null;

// ========================================================================
// ИНИЦИАЛИЗАЦИЯ
// ========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Diagnostic] Страница загружена v3.0.0');
  await loadStores();
});

// ========================================================================
// ЗАГРУЗКА МАГАЗИНОВ
// ========================================================================

async function loadStores() {
  console.log('[Diagnostic] Загрузка магазинов...');

  try {
    const response = await fetch(`${BACKEND_ENDPOINT}/api/extension/stores`, {
      headers: {
        'Authorization': `Bearer ${BACKEND_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`[Diagnostic] Ответ: ${response.status}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const stores = await response.json();
    console.log(`[Diagnostic] Получено магазинов: ${stores.length}`);

    // Заполняем дропдаун
    storeSelect.innerHTML = '<option value="">-- Выберите магазин --</option>';

    // Показываем только активные магазины
    const activeStores = stores.filter(store => store.isActive);

    activeStores.forEach(store => {
      const option = document.createElement('option');
      option.value = store.id;
      option.textContent = store.name;
      storeSelect.appendChild(option);
    });

    console.log(`[Diagnostic] Активных магазинов: ${activeStores.length} из ${stores.length}`);

    storeSelect.disabled = false;
    console.log('[Diagnostic] Магазины загружены');

  } catch (error) {
    console.error('[Diagnostic] Ошибка загрузки магазинов:', error);
    showError(`Ошибка загрузки магазинов: ${error.message}`);
    storeSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
  }
}

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

    const selectedOption = storeSelect.options[storeSelect.selectedIndex];
    console.log(`[Diagnostic] Выбран магазин: ${selectedOption.textContent} (${storeSelect.value})`);
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

  // Блокируем UI
  storeSelect.disabled = true;
  btnGetComplaints.disabled = true;
  btnGetComplaints.textContent = '⏳ Загрузка...';
  hideError();
  hideResults();

  try {
    console.log(`[Diagnostic] Получение жалоб для магазина ${storeId}...`);

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
    console.log(`[Diagnostic] Получено ${loadedComplaints.length} жалоб`);

    if (loadedComplaints.length === 0) {
      throw new Error('Нет жалоб для обработки. Убедитесь что в системе есть жалобы со статусом "draft".');
    }

    // Показываем счётчик
    complaintsCountEl.textContent = loadedComplaints.length;
    complaintsInfo.classList.remove('hidden');
    btnSubmit.disabled = false;

    // Показываем превью
    showPreview(loadedComplaints);

    console.log('[Diagnostic] Жалобы загружены, готово к подаче');

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
    `Жалоб к подаче: ${loadedComplaints.length}\n\n` +
    `Перед ПЕРВОЙ жалобой вы увидите заполненную форму для проверки.\n\n` +
    `Продолжить?`
  );

  if (!confirmed) {
    console.log('[Diagnostic] Отменено пользователем');
    return;
  }

  console.log('[Diagnostic] Запуск подачи жалоб...');

  // Блокируем UI
  storeSelect.disabled = true;
  btnGetComplaints.disabled = true;
  btnSubmit.disabled = true;
  btnSubmit.textContent = '⏳ Подача...';
  hideError();
  showProgress('Поиск вкладки WB...');

  try {
    // 1. Найти WB вкладку
    console.log('[Diagnostic] Поиск WB вкладки...');
    const tabs = await chrome.tabs.query({});
    const wbTab = tabs.find(tab =>
      tab.url &&
      tab.url.includes('seller.wildberries.ru') &&
      tab.url.includes('/feedbacks')
    );

    if (!wbTab) {
      throw new Error('Не найдена вкладка seller.wildberries.ru/feedbacks\n\nОткройте страницу отзывов WB и попробуйте снова.');
    }

    console.log(`[Diagnostic] WB вкладка найдена: ${wbTab.id}`);
    updateProgress(10, 'Проверка content script...');

    // 2. Проверить content script
    try {
      await chrome.tabs.sendMessage(wbTab.id, { type: 'ping' });
    } catch (error) {
      throw new Error('Content script не готов!\n\nОбновите страницу WB (F5) и попробуйте снова.');
    }

    console.log('[Diagnostic] Content script готов');
    updateProgress(20, 'Отправка жалоб на обработку...');

    // 3. Запустить подачу
    console.log(`[Diagnostic] Отправляем ${loadedComplaints.length} жалоб на обработку...`);

    const response = await chrome.tabs.sendMessage(wbTab.id, {
      type: 'test4Diagnostics',
      complaints: loadedComplaints,
      storeId: currentStoreId
    });

    if (!response.success) {
      throw new Error(response.error || 'Подача не удалась');
    }

    console.log('[Diagnostic] Подача завершена');
    console.log('[Diagnostic] Отчет:', response.report);

    // 4. Показать результаты
    hideProgress();
    displayResults(response.report);

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

  console.log(`[Diagnostic] Превью: ${Object.keys(byArticle).length} артикулов`);
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

console.log('[Diagnostic] Модуль загружен (v3.0.0 - minimal UI)');
