/**
 * Diagnostic Tool - Режим тестирования подачи жалоб
 *
 * @version 2.1.0 - Добавлен preview жалоб перед запуском
 * @since 01.02.2026
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

const resultsDiv = document.getElementById('test-results');
const storeSelect = document.getElementById('store-select');
const storeError = document.getElementById('store-error');
const btnStartTest = document.getElementById('btn-start-test');
const previewDiv = document.getElementById('complaints-preview');
const previewStats = document.getElementById('preview-stats');
const previewAccordion = document.getElementById('preview-accordion');
const btnConfirmTest = document.getElementById('btn-confirm-test');
const btnCancelPreview = document.getElementById('btn-cancel-preview');

// Сохраняем загруженные жалобы для использования после подтверждения
let loadedComplaints = [];
let currentStoreId = null;

// ========================================================================
// ИНИЦИАЛИЗАЦИЯ
// ========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Diagnostic] Страница загружена');
  await loadStores();
});

// ========================================================================
// ЗАГРУЗКА МАГАЗИНОВ
// ========================================================================

/**
 * Загрузка списка магазинов с Backend API
 */
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
    console.log(`[Diagnostic] Получено магазинов: ${stores.length}`, stores);

    // Заполняем дропдаун
    storeSelect.innerHTML = '<option value="">Выберите магазин</option>';

    stores.forEach(store => {
      const option = document.createElement('option');
      option.value = store.id;
      option.textContent = store.name;

      if (!store.isActive) {
        option.disabled = true;
        option.textContent += ' (неактивен)';
      }

      storeSelect.appendChild(option);
    });

    storeSelect.disabled = false;
    console.log('[Diagnostic] Магазины загружены');

  } catch (error) {
    console.error('[Diagnostic] Ошибка загрузки магазинов:', error);
    storeError.textContent = `Ошибка загрузки: ${error.message}`;
    storeSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
  }
}

// ========================================================================
// ВЫБОР МАГАЗИНА
// ========================================================================

storeSelect.addEventListener('change', () => {
  const hasSelection = storeSelect.value !== '';
  btnStartTest.disabled = !hasSelection;

  if (hasSelection) {
    const selectedOption = storeSelect.options[storeSelect.selectedIndex];
    console.log(`[Diagnostic] Выбран магазин: ${selectedOption.textContent} (${storeSelect.value})`);
  }
});

// ========================================================================
// ЗАПУСК ТЕСТА
// ========================================================================

btnStartTest.addEventListener('click', runTest);

/**
 * Запуск теста подачи жалоб - ШАГ 1: Загрузка и показ превью
 */
async function runTest() {
  const storeId = storeSelect.value;

  if (!storeId) {
    alert('Выберите магазин!');
    return;
  }

  currentStoreId = storeId;

  // Блокируем UI
  storeSelect.disabled = true;
  btnStartTest.disabled = true;
  btnStartTest.textContent = 'Загрузка жалоб...';
  resultsDiv.innerHTML = '';

  try {
    // 1. Получить жалобы от API
    console.log(`[Diagnostic] Получение жалоб для магазина ${storeId}...`);

    const apiResponse = await chrome.runtime.sendMessage({
      type: 'getComplaints',
      storeId: storeId,
      skip: 0,
      take: 300 // Получаем до 300 жалоб
    });

    if (!apiResponse || apiResponse.error) {
      throw new Error(apiResponse?.error || 'Не удалось получить жалобы от API');
    }

    loadedComplaints = apiResponse.data || [];
    console.log(`[Diagnostic] Получено ${loadedComplaints.length} жалоб`);

    if (loadedComplaints.length === 0) {
      throw new Error('Нет жалоб для обработки.\n\nУбедитесь что в системе есть жалобы со статусом "draft".');
    }

    // 2. Показать превью
    showPreview(loadedComplaints);

  } catch (error) {
    console.error('[Diagnostic] Ошибка:', error);
    displayError(error.message);
    resetUI();
  }
}

/**
 * Показать превью жалоб в аккордеоне
 */
function showPreview(complaints) {
  console.log('[Diagnostic] Показываем превью...');

  // Группируем по артикулам
  const byArticle = {};
  complaints.forEach(c => {
    const articleId = c.productId || c.nmId || 'unknown';
    if (!byArticle[articleId]) {
      byArticle[articleId] = [];
    }
    byArticle[articleId].push(c);
  });

  // Статистика
  previewStats.innerHTML = `
    <div class="review-card" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%);">
      <h3>Загружено жалоб</h3>
      <div class="review-card-content">
        <div class="review-card-row">
          <span class="review-card-label">Всего жалоб:</span>
          <span class="review-card-value">${complaints.length}</span>
        </div>
        <div class="review-card-row">
          <span class="review-card-label">Уникальных артикулов:</span>
          <span class="review-card-value">${Object.keys(byArticle).length}</span>
        </div>
      </div>
    </div>
  `;

  // Аккордеон
  let html = '';
  for (const [articleId, articleComplaints] of Object.entries(byArticle)) {
    html += `
      <div class="accordion-item">
        <div class="accordion-header">
          <span>Артикул: ${articleId} (${articleComplaints.length} жалоб)</span>
          <span class="accordion-arrow">▼</span>
        </div>
        <div class="accordion-content">
    `;

    articleComplaints.forEach((c, idx) => {
      const date = c.reviewDate ? new Date(c.reviewDate).toLocaleString('ru-RU') : 'N/A';
      const rating = c.rating || 0;
      const category = c.complaintData?.reasonName || c.reasonName || 'N/A';
      const text = c.complaintData?.complaintText || c.complaintText || '';

      html += `
        <div class="complaint-card">
          <div class="complaint-card-row">
            <span class="complaint-card-label">Рейтинг:</span>
            <span class="complaint-card-value">${'⭐'.repeat(rating) || 'N/A'}</span>
          </div>
          <div class="complaint-card-row">
            <span class="complaint-card-label">Дата отзыва:</span>
            <span class="complaint-card-value">${date}</span>
          </div>
          <div class="complaint-card-row">
            <span class="complaint-card-label">Категория:</span>
            <span class="complaint-card-value">${category}</span>
          </div>
          <div class="complaint-card-row">
            <span class="complaint-card-label">Текст жалобы:</span>
          </div>
          <div class="complaint-text">${escapeHtml(text) || '(пусто)'}</div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  }

  previewAccordion.innerHTML = html;

  // Показываем превью, скрываем кнопку "Начать тест"
  previewDiv.classList.remove('hidden');
  btnStartTest.style.display = 'none';

  console.log('[Diagnostic] Превью показано');
}

/**
 * Переключение аккордеона - используем делегирование событий
 */
document.addEventListener('click', (e) => {
  const header = e.target.closest('.accordion-header');
  if (header) {
    const item = header.parentElement;
    item.classList.toggle('open');
  }
});

/**
 * Экранирование HTML для безопасного отображения текста
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Сброс UI в исходное состояние
 */
function resetUI() {
  storeSelect.disabled = false;
  btnStartTest.disabled = false;
  btnStartTest.textContent = 'Начать тест';
  btnStartTest.style.display = 'block';
  previewDiv.classList.add('hidden');
}

/**
 * Запуск теста - ШАГ 2: Реальная подача после подтверждения
 */
async function executeTest() {
  console.log('[Diagnostic] Запуск реального теста...');

  // Скрываем превью
  previewDiv.classList.add('hidden');

  // Показываем загрузку
  showLoading();

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

    // 2. Проверить content script
    console.log('[Diagnostic] Проверка content script...');
    try {
      await chrome.tabs.sendMessage(wbTab.id, { type: 'ping' });
    } catch (error) {
      throw new Error('Content script не готов!\n\nОбновите страницу WB (F5) и попробуйте снова.');
    }

    console.log('[Diagnostic] Content script готов');

    // 3. Запустить тест
    console.log(`[Diagnostic] Отправляем ${loadedComplaints.length} жалоб на обработку...`);

    const response = await chrome.tabs.sendMessage(wbTab.id, {
      type: 'test4Diagnostics',
      complaints: loadedComplaints,
      storeId: currentStoreId
    });

    if (!response.success) {
      throw new Error(response.error || 'Тест не удался');
    }

    console.log('[Diagnostic] Тест завершен');
    console.log('[Diagnostic] Отчет:', response.report);

    // 4. Показать результаты
    displayResults(response.report);

  } catch (error) {
    console.error('[Diagnostic] Ошибка:', error);
    displayError(error.message);
  } finally {
    resetUI();
  }
}

// ========================================================================
// ОБРАБОТЧИКИ КНОПОК ПРЕВЬЮ
// ========================================================================

btnConfirmTest.addEventListener('click', async () => {
  console.log('[Diagnostic] Подтверждение теста...');

  // Подтверждение перед реальной подачей
  const storeName = storeSelect.options[storeSelect.selectedIndex].textContent;
  const confirmed = confirm(
    `ВНИМАНИЕ! РЕАЛЬНАЯ ПОДАЧА ЖАЛОБ!\n\n` +
    `Магазин: ${storeName}\n` +
    `Жалоб к подаче: ${loadedComplaints.length}\n\n` +
    `Перед ПЕРВОЙ жалобой вы увидите заполненную форму и сможете проверить её.\n\n` +
    `Продолжить?`
  );

  if (!confirmed) {
    console.log('[Diagnostic] Отменено пользователем');
    return;
  }

  await executeTest();
});

btnCancelPreview.addEventListener('click', () => {
  console.log('[Diagnostic] Отмена превью');
  resetUI();
  loadedComplaints = [];
  currentStoreId = null;
});

// ========================================================================
// ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ
// ========================================================================

/**
 * Показать загрузку
 */
function showLoading() {
  resultsDiv.innerHTML = `
    <div class="loading">
      Выполняется тест подачи жалоб<br>
      <small style="color: #999;">(получение жалоб -> поиск -> проверка статусов -> подача)</small><br>
      <small style="color: #ff512f; margin-top: 10px; display: block;">Перед первой жалобой будет запрос подтверждения!</small>
    </div>
  `;
}

/**
 * Показать ошибку
 */
function displayError(message) {
  resultsDiv.innerHTML = `
    <div class="error">
      <div class="error-title">Ошибка</div>
      <p>${message.replace(/\n/g, '<br>')}</p>
    </div>
  `;
}

/**
 * Показать результаты теста
 */
function displayResults(report) {
  let html = '';

  // Overall status
  const statusClass = report.overallStatus.includes('SUCCESS')
    ? 'success'
    : report.overallStatus.includes('CANCELLED')
    ? 'partial'
    : 'failed';

  html += `
    <div class="overall-status ${statusClass}">
      ${report.overallStatus}
    </div>
  `;

  // Основная статистика
  html += `
    <div class="review-card" style="background: linear-gradient(135deg, #ff512f 0%, #dd2476 100%);">
      <h3>Результаты теста</h3>
      <div class="review-card-content">
        <div class="review-card-row">
          <span class="review-card-label">Жалоб получено от API:</span>
          <span class="review-card-value">${report.complaintsReceived || 0}</span>
        </div>
        <div class="review-card-row">
          <span class="review-card-label">Уникальных артикулов:</span>
          <span class="review-card-value">${report.uniqueArticles || 0}</span>
        </div>
        <div class="review-card-row">
          <span class="review-card-label">Отзывов найдено на WB:</span>
          <span class="review-card-value">${report.reviewsFound || 0}</span>
        </div>
        <div class="review-card-row">
          <span class="review-card-label">Можно подать жалобу:</span>
          <span class="review-card-value">${report.canSubmitComplaint || 0}</span>
        </div>
        <div class="review-card-row">
          <span class="review-card-label" style="font-weight: bold; color: #FFD700;">УСПЕШНО ПОДАНО:</span>
          <span class="review-card-value" style="font-weight: bold; color: #FFD700;">${report.submitted || 0}</span>
        </div>
        <div class="review-card-row">
          <span class="review-card-label">Пропущено (уже обработаны):</span>
          <span class="review-card-value">${report.alreadyProcessed || 0}</span>
        </div>
        <div class="review-card-row">
          <span class="review-card-label">Ошибки при подаче:</span>
          <span class="review-card-value">${report.errors || 0}</span>
        </div>
      </div>
    </div>
  `;

  // Отменено пользователем
  if (report.cancelled) {
    html += `
      <div class="check failed">
        <div class="check-title">
          <span class="check-icon">⏹</span>
          <span>Тест отменен пользователем</span>
        </div>
        <div class="check-details">
          Пользователь отменил подтверждение первой жалобы.
        </div>
      </div>
    `;
  }

  // Статусы найденных отзывов
  if (report.statusStats && Object.keys(report.statusStats).length > 0) {
    html += `
      <div class="review-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <h3>Статусы отзывов</h3>
        <div class="review-card-content">
    `;

    const sortedStatuses = Object.entries(report.statusStats).sort((a, b) => b[1] - a[1]);
    for (const [status, count] of sortedStatuses) {
      html += `
        <div class="review-card-row">
          <span class="review-card-label">${status}:</span>
          <span class="review-card-value">${count}</span>
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }

  // JSON dump
  html += `
    <details class="json-dump">
      <summary>Полный отчет (JSON)</summary>
      <pre>${JSON.stringify(report, null, 2)}</pre>
    </details>
  `;

  // Timestamp
  html += `
    <p style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
      Тест выполнен: ${new Date(report.timestamp).toLocaleString('ru-RU')}
    </p>
  `;

  resultsDiv.innerHTML = html;
}

console.log('[Diagnostic] Модуль загружен (v2.1.0 - preview mode)');
