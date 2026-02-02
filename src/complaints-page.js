/**
 * Главный файл для страницы подачи жалоб (complaints-page.html)
 * Рефакторинговая версия с модульной архитектурой
 *
 * @version 2.0.1 - Модульная архитектура + Bundle Optimization
 * @description Использует ES6 импорты и сервисы для управления состоянием
 */

// ========================================================================
// ИМПОРТЫ СЕРВИСОВ И УТИЛИТ
// ========================================================================

import { complaintsLogger } from './services/complaints-logger-service.js';
import { complaintsStoreService } from './services/complaints-store-service.js';
import { complaintsAPIService } from './services/complaints-api-service.js';
import { complaintsUIHandler } from './handlers/complaints-ui-handler.js';

// ========================================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ========================================================================

// DOM элементы
let elements = {};

// Состояние приложения
const appState = {
  isProcessing: false,
  currentBatch: 0,
  totalProcessedGlobal: 0,
  totalSentGlobal: 0,
  consecutiveEmptyBatches: 0,
  batchesHistory: [],
  previewData: null,
  currentData: null
};

// ========================================================================
// ИНИЦИАЛИЗАЦИЯ DOM
// ========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[ComplaintsPage] 🚀 Страница подачи жалоб загружена');

  // Инициализируем элементы DOM
  initializeElements();

  // Инициализируем логгер (КРИТИЧЕСКИ ВАЖНО - делается первым!)
  complaintsLogger.initialize();
  complaintsLogger.info('✅ Страница подачи жалоб загружается...');

  // Инициализируем сервис магазинов
  complaintsStoreService.initializeElements(
    elements.storeSelect,
    elements.storeLoadError
  );

  // Инициализируем UI handler
  complaintsUIHandler.initializeElements(elements);

  // Загружаем магазины
  try {
    await complaintsStoreService.loadStores();
  } catch (error) {
    console.error('[ComplaintsPage] ❌ Ошибка загрузки магазинов:', error);
    // Ошибка уже залогирована в сервисе
  }

  // ========================================================================
  // CONTENT SCRIPTS АВТОЗАГРУЗКА
  // ========================================================================
  // Content scripts теперь загружаются автоматически через manifest.json!
  // Динамический инжект больше не нужен.

  // Настраиваем обработчики событий
  setupEventListeners();

  complaintsLogger.success('✅ Страница подачи жалоб готова к работе');
});

// ========================================================================
// ИНИЦИАЛИЗАЦИЯ ЭЛЕМЕНТОВ
// ========================================================================

function initializeElements() {
  elements = {
    // Кнопки управления
    btnClosePage: document.getElementById('btn-close-page'),
    btnStartComplaints: document.getElementById('btn-start-complaints'),
    btnStopComplaints: document.getElementById('btn-stop-complaints'),
    btnConfirmStart: document.getElementById('btn-confirm-start'),
    btnCancelPreview: document.getElementById('btn-cancel-preview'),
    btnDownloadResults: document.getElementById('btn-download-results'),
    btnNewComplaints: document.getElementById('btn-new-complaints'),
    btnClearLogs: document.getElementById('btn-clear-logs'),
    btnDownloadLogs: document.getElementById('btn-download-logs'),
    btnDownloadLogsFinal: document.getElementById('btn-download-logs-final'),
    btnDownloadAPIReport: document.getElementById('btn-download-api-report'),
    refreshStoresBtn: document.getElementById('refresh-stores-btn'),

    // Выпадающие списки и инпуты
    storeSelect: document.getElementById('store-select'),
    complaintArticles: document.getElementById('complaint-articles'),

    // Контейнеры
    logsContainer: document.getElementById('logs-container'),
    apiStatsPreview: document.getElementById('api-stats-preview'),
    apiStatsContent: document.getElementById('api-stats-content'),
    complaintsProgress: document.getElementById('complaints-progress'),
    complaintsResults: document.getElementById('complaints-results'),

    // Элементы ошибок и статистики
    storeLoadError: document.getElementById('store-load-error'),
    progressTitle: document.getElementById('progress-title'),

    // Чекбоксы звезд
    complaintStars: document.querySelectorAll('.complaint-star')
  };

  console.log('[ComplaintsPage] ✅ DOM элементы инициализированы');
}

// ========================================================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ========================================================================

function setupEventListeners() {
  // Закрытие страницы
  elements.btnClosePage?.addEventListener('click', () => {
    window.close();
  });

  // Выбор магазина
  elements.storeSelect?.addEventListener('change', async (event) => {
    const storeId = event.target.value;
    await complaintsStoreService.selectStore(storeId);
  });

  // Обновление списка магазинов
  elements.refreshStoresBtn?.addEventListener('click', async () => {
    console.log('[ComplaintsPage] 🔄 Ручное обновление магазинов');

    elements.refreshStoresBtn.disabled = true;
    elements.refreshStoresBtn.textContent = '⏳ Обновление...';

    try {
      await complaintsStoreService.loadStores(true);
      elements.refreshStoresBtn.textContent = '✅ Обновлено';
      setTimeout(() => {
        elements.refreshStoresBtn.textContent = '🔄 Обновить';
        elements.refreshStoresBtn.disabled = false;
      }, 2000);
    } catch (error) {
      elements.refreshStoresBtn.textContent = '❌ Ошибка';
      setTimeout(() => {
        elements.refreshStoresBtn.textContent = '🔄 Обновить';
        elements.refreshStoresBtn.disabled = false;
      }, 2000);
    }
  });

  // Очистка логов
  elements.btnClearLogs?.addEventListener('click', () => {
    complaintsLogger.clear();
  });

  // Скачивание логов
  elements.btnDownloadLogs?.addEventListener('click', () => {
    complaintsLogger.downloadLogs();
  });

  elements.btnDownloadLogsFinal?.addEventListener('click', () => {
    complaintsLogger.downloadLogs();
  });

  // Подтвердить запуск после preview
  elements.btnConfirmStart?.addEventListener('click', async () => {
    if (!appState.previewData) {
      alert('❌ Данные не загружены');
      return;
    }

    try {
      complaintsLogger.info(`📤 Отправляем ${appState.previewData.filteredComplaints.length} жалоб на обработку...`);

      // Проверяем что content script готов
      try {
        await chrome.tabs.sendMessage(appState.previewData.wbTab.id, { type: "ping" });
      } catch (error) {
        alert('❌ Content script не готов!\n\nОбновите страницу WB (F5) и попробуйте снова');
        return;
      }

      // Отправляем жалобы на обработку
      await chrome.tabs.sendMessage(appState.previewData.wbTab.id, {
        type: "processComplaintsFromAPI",
        complaints: appState.previewData.filteredComplaints.map(c => ({
          id: c.id,
          productId: c.productId,
          rating: c.rating,
          reviewDate: c.reviewDate,
          complaintText: c.parsedComplaintText || c.complaintText,
          reasonId: c.reasonId,
          reasonName: c.reasonName
        })),
        storeId: appState.previewData.selectedStore,
        stars: appState.previewData.checkedStars,
        articles: appState.previewData.articlesArray
      });

      complaintsLogger.success('✅ Команда отправлена на обработку');

      // Скрываем preview, показываем прогресс
      elements.apiStatsPreview?.classList.add('hidden');
      elements.complaintsProgress?.classList.remove('hidden');
      appState.isProcessing = true;

    } catch (error) {
      console.error('[ComplaintsPage] ❌ Ошибка подтверждения:', error);
      complaintsLogger.error(`❌ Ошибка: ${error.message}`);
      alert(`❌ Ошибка: ${error.message}`);
    }
  });

  // Отменить preview
  elements.btnCancelPreview?.addEventListener('click', () => {
    appState.previewData = null;
    complaintsUIHandler.hidePreviewStats();
    complaintsLogger.info('❌ Операция отменена');
  });

  // Начать обработку жалоб
  elements.btnStartComplaints?.addEventListener('click', async () => {
    // Валидация
    const selectedStore = elements.storeSelect.value;
    if (!selectedStore) {
      alert("Пожалуйста, выберите магазин!");
      return;
    }

    const checkedStars = Array.from(elements.complaintStars)
      .filter(checkbox => checkbox.checked)
      .map(checkbox => Number(checkbox.value));

    if (checkedStars.length === 0) {
      alert("Пожалуйста, выберите хотя бы одну оценку звезд!");
      return;
    }

    // Парсим артикулы
    const articlesText = elements.complaintArticles.value.trim();
    const articlesArray = articlesText.length > 0
      ? articlesText.split(/[\s,\n]+/).map(a => a.trim()).filter(a => a.length > 0)
      : [];

    try {
      complaintsLogger.info(`🚀 Запуск подачи жалоб...`);
      if (articlesArray.length > 0) {
        complaintsLogger.info(`📦 Фильтр по артикулам: ${articlesArray.join(", ")}`);
      } else {
        complaintsLogger.warn("⚠️ Артикулы не указаны - будут обработаны все жалобы");
      }

      // Загружаем жалобы из API
      complaintsLogger.info(`📡 Загружаем жалобы из API...`);
      const result = await complaintsAPIService.loadComplaints(
        selectedStore,
        0,
        200,
        'draft',
        checkedStars
      );

      if (!result.data || result.data.length === 0) {
        complaintsLogger.warn('⚠️ Жалоб для обработки не найдено');
        alert('Жалоб для обработки не найдено');
        return;
      }

      // Фильтруем по артикулам если указаны
      let filteredComplaints = result.data;
      const isFilterByArticles = articlesArray.length > 0;

      if (isFilterByArticles) {
        filteredComplaints = result.data.filter(c => articlesArray.includes(c.productId));
        complaintsLogger.info(`✅ После фильтрации по артикулам: ${filteredComplaints.length} жалоб`);
      }

      if (filteredComplaints.length === 0) {
        complaintsLogger.warn('⚠️ После фильтрации жалоб не осталось');
        alert('После фильтрации по артикулам жалоб не осталось');
        return;
      }

      // Подсчитываем статистику по артикулам
      const articleStats = {};
      filteredComplaints.forEach(complaint => {
        const articleId = complaint.productId;
        if (!articleStats[articleId]) {
          articleStats[articleId] = 0;
        }
        articleStats[articleId]++;
      });

      // Находим вкладку WB
      const tabs = await chrome.tabs.query({});
      const wbTab = tabs.find(tab =>
        tab.url && tab.url.includes('seller.wildberries.ru') &&
        tab.url.includes('/feedbacks')
      );

      if (!wbTab) {
        alert('❌ Страница Wildberries не найдена!\n\nОткройте seller.wildberries.ru/feedbacks');
        return;
      }

      complaintsLogger.success(`✅ Найдена вкладка WB: ${wbTab.title}`);
      complaintsLogger.info(`📍 Вкладка #${wbTab.id}: ${wbTab.url}`);

      // Сохраняем данные для предпросмотра
      appState.previewData = {
        filteredComplaints,
        articleStats,
        isFilterByArticles,
        checkedStars,
        articlesArray,
        selectedStore,
        wbTab
      };

      // Показываем статистику с предпросмотром
      complaintsUIHandler.showPreviewStats(
        filteredComplaints,
        articleStats,
        isFilterByArticles,
        checkedStars
      );

    } catch (error) {
      console.error('[ComplaintsPage] ❌ Ошибка запуска:', error);
      complaintsLogger.error(`❌ Ошибка: ${error.message}`);
      alert(`❌ Ошибка: ${error.message}`);
    }
  });

  console.log('[ComplaintsPage] ✅ Event listeners настроены');
}

console.log('[ComplaintsPage] 📦 Модуль загружен (v2.0.1 - Bundle Optimization)');
