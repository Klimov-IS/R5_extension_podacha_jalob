/**
 * Selectors Catalog - Centralized DOM selectors for WB Reviews page
 *
 * This file contains all CSS selectors used to interact with the
 * Wildberries (Valdris UI) Reviews page.
 *
 * IMPORTANT: When WB UI changes, update selectors here first.
 * Then update docs/SELECTORS.md and docs/UI_CHANGELOG.md.
 *
 * @module dom/selectors-catalog
 * @since 2.1.0 (02.02.2026)
 * @see docs/SELECTORS.md
 * @see docs/DOM_CONTRACT.md
 */

'use strict';

/**
 * Reviews Table - Container holding all review rows
 */
const TABLE_SELECTORS = {
  primary: '[class*="Base-table-body"]',
  fallback1: 'tbody',
  fallback2: '[role="rowgroup"]'
};

/**
 * Review Row - Individual review entry
 */
const ROW_SELECTORS = {
  primary: '[class*="table-row"]'
};

/**
 * Rating Display - Star rating indicator (1-5)
 */
const RATING_SELECTORS = {
  container: '[class*="Rating__"]',
  activeStars: '[class*="Rating--active__"]',
  // Fallback: SVG fill color for active stars
  activeFillColor: '#FF773C'
};

/**
 * DateTime Display - Review date and time
 * WB Format: "27.01.2026 в 15:05" (Moscow time, UTC+3)
 */
const DATETIME_SELECTORS = {
  textSpan: 'span[data-name="Text"]',
  pattern: /\d{2}\.\d{2}\.\d{4}\s+в\s+\d{2}:\d{2}/,
  containerFallback: '[class*="Col-date-time-with-readmark__"]',
  dateMarkerFallback: '[class*="date-with-marker"]'
};

/**
 * Review Statuses - Chips/tags showing review state
 */
const STATUS_SELECTORS = {
  container: '[class*="Feedback-statuses"]',
  chips: '[data-name="Chips"]',
  chipText: '[class*="Chips__text"]',
  fallbackContainer: '[class*="Extended-article-info-card__statuses"]'
};

/**
 * Known status values
 */
const KNOWN_STATUSES = {
  visibility: ['Виден', 'Снят с публикации', 'Исключён из рейтинга', 'Временно скрыт'],
  complaint: ['Жалоба отклонена', 'Жалоба одобрена', 'Проверяем жалобу', 'Жалоба пересмотрена'],
  transaction: ['Выкуп', 'Отказ', 'Возврат', 'Запрошен возврат']
};

/**
 * Blocking statuses - Prevent new complaint submission
 */
const BLOCKING_STATUSES = [
  'Жалоба отклонена',
  'Жалоба одобрена',
  'Проверяем жалобу',
  'Жалоба пересмотрена'
];

/**
 * Menu Button (Three Dots) - Action menu trigger
 *
 * IMPORTANT (January 2026):
 * Row has TWO icon buttons:
 * - Chat button: viewBox "0 0 16 16" (disabled)
 * - Menu button: viewBox contains "-10" (active)
 */
const MENU_BUTTON_SELECTORS = {
  buttonWithIcon: 'button[class*="onlyIcon"]',
  svgViewBoxPattern: '-10', // Menu SVG contains this
  moreButtonFallback: '[class*="More-button__button"]'
};

/**
 * Dropdown Menu - Context menu popup
 */
const DROPDOWN_SELECTORS = {
  item: 'li[class*="Dropdown-list__item"]',
  list: 'ul[class*="Dropdown-list"]',
  listAlternative: '[class*="Dropdown-list"]:not(li)',
  option: 'button[class*="Dropdown-option"]',
  roleMenu: '[role="menu"]',
  roleListbox: '[role="listbox"]'
};

/**
 * Complaint Button - "Пожаловаться на отзыв" action
 *
 * IMPORTANT (January 2026):
 * Dropdown has TWO warning buttons:
 * - "Запросить возврат" (first)
 * - "Пожаловаться на отзыв" (second) - we need this one
 */
const COMPLAINT_BUTTON_SELECTORS = {
  textMatch: 'Пожаловаться на отзыв',
  textMatchShort: 'Пожаловаться',
  warningClass: 'button[class*="Dropdown-option--warning"]'
  // Note: Use text matching, not class - there are multiple warning buttons
};

/**
 * Complaint Modal - Form for submitting complaint
 */
const MODAL_SELECTORS = {
  primary: '[class*="Complaint-form"]',
  dialog: '[role="dialog"]',
  modalClass: '[class*="modal"]',
  buttonsContainer: '[class*="Complaint-form__buttons"]'
};

/**
 * Category Selection - Radio buttons for complaint category
 */
const CATEGORY_SELECTORS = {
  radios: 'input[type="radio"]',
  checkedClass: '[class*="radioChecked__"]'
};

/**
 * Complaint Textarea - Text input for complaint description
 *
 * IMPORTANT: Only appears AFTER selecting category
 */
const TEXTAREA_SELECTORS = {
  primary: '#explanation',
  fallback: 'textarea',
  contentEditable: '[contenteditable="true"]'
};

/**
 * Submit Button - Form submission trigger
 */
const SUBMIT_BUTTON_SELECTORS = {
  container: '[class*="Complaint-form__buttons"]',
  textMatch: 'Отправить',
  submitType: 'button[type="submit"]',
  buttonClassPattern: '[class*="button"][class*="m__"]'
};

/**
 * Close Button - Modal close trigger
 */
const CLOSE_BUTTON_SELECTORS = {
  closeClass: '[class*="close"]',
  ariaLabel: 'button[aria-label*="Закр"]',
  overlay: '[class*="overlay"]',
  backdrop: '[class*="backdrop"]'
};

/**
 * Search Input - Product article search field
 */
const SEARCH_SELECTORS = {
  placeholderRu: 'input[placeholder*="Поиск"]',
  placeholderRuLower: 'input[placeholder*="поиск"]',
  typeSearch: 'input[type="search"]',
  classPattern: 'input[class*="search" i]',
  classPatternCap: 'input[class*="Search"]'
};

/**
 * Pagination - Page navigation controls
 *
 * Button positions (left to right):
 * [0] First page (◀◀)
 * [1] Previous page (◀)
 * [2] Next page (▶) <-- IMPORTANT
 * [3] Last page (▶▶)
 */
const PAGINATION_SELECTORS = {
  arrows: '[class*="Token-pagination__arrow"]',
  nextPageIndex: 2, // Fixed position, verified February 2026
  prevPageIndex: 1,
  firstPageIndex: 0,
  lastPageIndex: 3
};

/**
 * Review Tabs - "Ждут ответа" / "Есть ответ" segment buttons
 *
 * Active tab has class containing "isActive".
 * Both buttons share data-name="Segments".
 */
const TAB_SELECTORS = {
  allButtons: 'button[data-name="Segments"]',
  activeButton: 'button[data-name="Segments"][class*="isActive"]',
  textElement: '[class*="Item__text"]'
};

/**
 * Timing constants (milliseconds)
 */
const TIMING = {
  searchWait: 7500,      // Wait for search results
  pageNavWait: 4000,     // Wait for page change
  tabSwitchWait: 4000,   // Wait for tab content reload
  modalWait: 1800,       // Wait for modal animation
  categoryWait: 500,     // Wait for textarea after category
  submitWait: 1500,      // Wait for submission
  menuOpenWait: 600,     // Wait for menu dropdown
  betweenComplaints: 800, // Pause between complaints
  betweenArticles: 1500  // Pause between articles
};

// Export to global scope for content scripts
window.SELECTORS = {
  TABLE: TABLE_SELECTORS,
  ROW: ROW_SELECTORS,
  RATING: RATING_SELECTORS,
  DATETIME: DATETIME_SELECTORS,
  STATUS: STATUS_SELECTORS,
  KNOWN_STATUSES,
  BLOCKING_STATUSES,
  MENU_BUTTON: MENU_BUTTON_SELECTORS,
  DROPDOWN: DROPDOWN_SELECTORS,
  COMPLAINT_BUTTON: COMPLAINT_BUTTON_SELECTORS,
  MODAL: MODAL_SELECTORS,
  CATEGORY: CATEGORY_SELECTORS,
  TEXTAREA: TEXTAREA_SELECTORS,
  SUBMIT_BUTTON: SUBMIT_BUTTON_SELECTORS,
  CLOSE_BUTTON: CLOSE_BUTTON_SELECTORS,
  SEARCH: SEARCH_SELECTORS,
  PAGINATION: PAGINATION_SELECTORS,
  TAB: TAB_SELECTORS,
  TIMING
};

// Module loaded
