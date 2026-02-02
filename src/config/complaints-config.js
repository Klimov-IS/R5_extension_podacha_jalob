/**
 * Конфигурация для системы подачи жалоб
 * Централизованное хранение всех констант
 *
 * @version 1.0.0
 */

/**
 * Размер батча для API запросов
 * Количество жалоб, загружаемых за один раз
 */
export const BATCH_SIZE = 200;

/**
 * Максимальное количество пустых батчей подряд
 * После этого лимита обработка останавливается
 */
export const MAX_EMPTY_BATCHES = 5;

/**
 * Максимальная длина текста жалобы (включая префикс)
 * Ограничение WB: 1000 символов
 */
export const MAX_TEXT_LENGTH = 1000;

/**
 * Длина префикса "Жалоба от: DD.MM.YYYY\n\n"
 * Вычитается из MAX_TEXT_LENGTH
 */
export const PREFIX_LENGTH = 25;

/**
 * Максимальная длина текста жалобы без префикса
 */
export const MAX_COMPLAINT_TEXT = MAX_TEXT_LENGTH - PREFIX_LENGTH; // 980

/**
 * Задержка перед запросом следующего пустого батча (мс)
 * Защита от rate limit при множественных пустых запросах
 */
export const EMPTY_BATCH_DELAY = 2000;

/**
 * Таймаут для проверки готовности content script (мс)
 */
export const PING_TIMEOUT = 500;

/**
 * Максимальное количество попыток ping content script
 */
export const PING_MAX_RETRIES = 3;

/**
 * Задержка автоинжекта после загрузки страницы (мс)
 */
export const AUTO_INJECT_DELAY = 1000;

/**
 * Задержка инициализации content scripts после инжекта (мс)
 */
export const SCRIPT_INIT_DELAY = 500;

/**
 * 🔒 ВРЕМЕННОЕ РЕШЕНИЕ: Хардкоженные константы Backend API
 * TODO: Переместить в chrome.storage.sync после Phase 4
 */
export const BACKEND_ENDPOINT = 'http://158.160.217.236';
export const BACKEND_TOKEN = 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

/**
 * Дефолтные настройки Pilot Entry API (для обратной совместимости)
 */
export const DEFAULT_PILOT_TOKEN = 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';
export const DEFAULT_PILOT_ENDPOINT = 'https://pilot-entry.ru/api';

/**
 * Порядок инжекта content scripts (ВАЖНО: соблюдать последовательность!)
 */
export const CONTENT_SCRIPTS_ORDER = [
  // 1. Утилиты (должны загрузиться первыми)
  'src/utils/logger-content.js',
  'src/contents/complaints/utils.js',

  // 2. DOM модули (работа с элементами)
  'src/contents/complaints/dom/data-extractor.js',
  'src/contents/complaints/dom/element-finder.js',

  // 3. Сервисы (бизнес-логика)
  'src/contents/complaints/services/search-service.js',
  'src/contents/complaints/services/navigation-service.js',
  'src/contents/complaints/services/progress-service.js',
  'src/contents/complaints/services/complaint-service.js',

  // 4. Обработчики (используют все сервисы)
  'src/contents/complaints/handlers/optimized-handler.js',

  // 5. Entry point (должен загрузиться последним)
  'src/contents/complaints/content.js'
];

/**
 * CSS классы для UI элементов
 */
export const UI_CLASSES = {
  HIDDEN: 'hidden',
  LOG_ENTRY: 'log-entry',
  LOG_TIMESTAMP: 'log-timestamp'
};

/**
 * ID элементов DOM
 */
export const DOM_IDS = {
  STORE_SELECT: 'store-select',
  STORE_LOAD_ERROR: 'store-load-error',
  LOGS_CONTAINER: 'logs-container',
  BTN_START_COMPLAINTS: 'btn-start-complaints',
  BTN_STOP_COMPLAINTS: 'btn-stop-complaints',
  BTN_CONFIRM_START: 'btn-confirm-start',
  BTN_CANCEL_PREVIEW: 'btn-cancel-preview',
  BTN_DOWNLOAD_RESULTS: 'btn-download-results',
  BTN_DOWNLOAD_LOGS: 'btn-download-logs',
  BTN_NEW_COMPLAINTS: 'btn-new-complaints',
  BTN_CLEAR_LOGS: 'btn-clear-logs',
  BTN_DOWNLOAD_API_REPORT: 'btn-download-api-report',
  API_STATS_PREVIEW: 'api-stats-preview',
  API_STATS_CONTENT: 'api-stats-content',
  COMPLAINTS_PROGRESS: 'complaints-progress',
  COMPLAINTS_RESULTS: 'complaints-results',
  COMPLAINT_ARTICLES: 'complaint-articles'
};
