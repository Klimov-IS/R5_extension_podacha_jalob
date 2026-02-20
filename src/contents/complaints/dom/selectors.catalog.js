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

// ============================================================
// CHAT WORKFLOW SELECTORS (Sprint 2 — Review-Chat Linking)
// ============================================================

/**
 * Chat Button - Opens chat with customer from review row
 *
 * Located inside the same Buttons-cell as menu button (three dots).
 * Structure:
 *   th[data-testid="Base-table-cell"]
 *     └ div.Buttons-cell
 *         ├ div.Switchable-portal-tooltip  ← CHAT BUTTON
 *         │   └ span.Portal-tooltip__text
 *         │       └ button > svg[viewBox="0 0 16 16"]
 *         └ div[data-name="MoreButton"]    ← MENU BUTTON (three dots)
 *             └ button > svg[viewBox="-10 -3 24 24"]
 *
 * Three states:
 * - Grey (not opened yet): button:not([disabled]) — clickable
 * - Black (already opened): button:not([disabled]) — clickable (different CSS class)
 * - Transparent (disabled): button[disabled] — skip
 *
 * MVP: click ALL non-disabled buttons (grey AND black) to parse chat data.
 */
const CHAT_BUTTON_SELECTORS = {
  buttonsContainer: '[class*="Buttons-cell"]',
  svgViewBox: '0 0 16 16',             // Chat SVG viewBox (vs "-10" for menu)
  svgSize: 16,                          // Chat SVG is 16x16 (vs 24x24 for menu)
  excludeParent: '[data-name="MoreButton"]', // Menu button lives here, NOT chat
  disabledCheck: '[disabled]'
};

/**
 * Chat Page — URL Detection
 *
 * URL format: https://seller.wildberries.ru/chat-with-clients?chatId={UUID}
 * Example:    https://seller.wildberries.ru/chat-with-clients?chatId=a8775c6f-049b-da67-1045-421477a8bfcb
 */
const CHAT_PAGE_SELECTORS = {
  urlPattern: '/chat-with-clients',
  chatIdParam: 'chatId',
  chatIdRegex: /chatId=([a-f0-9-]+)/i
};

/**
 * Chat Page — Messages List
 *
 * Structure:
 *   section.ChatWindow__messages > ul.ChatWindow__list
 *     └ li[data-addtime] ← each message
 *         └ section[data-testid="message"]
 *             └ div[data-testid="message-content"]
 *                 └ div.Message__text
 *                     └ span[data-name="Text"]  ← message text
 */
const CHAT_MESSAGE_SELECTORS = {
  messagesContainer: '[class*="ChatWindow__messages"]',
  messagesList: '[class*="ChatWindow__list"]',
  messageItem: 'li[data-addtime]',
  messageSection: '[data-testid="message"]',
  messageContent: '[data-testid="message-content"]',
  messageText: 'span[data-name="Text"]',
  dateBadge: '[data-testid="date-badge"]',
  ownMessageClass: 'list-element--own'  // Partial match — seller's own messages
};

/**
 * Chat Page — System Anchor Message
 *
 * First message in chat: "Чат с покупателем по товару {nmId}"
 * Used to link review ↔ chat.
 */
const CHAT_ANCHOR_SELECTORS = {
  anchorTextPattern: /товару\s+(\d+)/i,                   // Extract nmId
  anchorValidation: /(?:чат|покупател|товар)/i,           // Validate it's the system message
  anchorFullPattern: /чат\s+с\s+покупател\S*\s+по\s+товару\s+(\d+)/i  // Strict match
};

/**
 * Chat Page — Message Input (Sprint 2: sending messages)
 *
 * Structure:
 *   div[data-name="TextAreaInput"]
 *     └ textarea#messageInput[name="messageInput"][placeholder="Сообщение..."]
 */
const CHAT_INPUT_SELECTORS = {
  container: '[data-name="TextAreaInput"]',
  textarea: '#messageInput',
  textareaFallback: 'textarea[name="messageInput"]',
  placeholder: 'Сообщение...'
};

/**
 * Chat Status Detection config
 * Used by DataExtractor.getChatStatus() to distinguish grey (available) vs black (opened) buttons.
 * CSS classes are hashed and unstable, so we use computed color luminance.
 */
const CHAT_STATUS_DETECTION = {
  luminanceThreshold: 0.4  // < 0.4 = dark/black (chat_opened), >= 0.4 = grey (chat_available)
};

/**
 * Chat Workflow Timing constants (milliseconds)
 */
const CHAT_TIMING = {
  chatTabLoadWait: 10000,    // Max wait for chat tab to load
  anchorScrollWait: 500,     // Pause between scroll-up attempts
  anchorMaxScrolls: 20,      // Max scroll attempts to find anchor
  betweenChats: 3000,        // Cooldown between opening chats (from API globalLimits)
  chatPageReadyWait: 3000    // Wait for chat messages to render after page load
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
  TIMING,
  // Chat workflow (Sprint 2)
  CHAT_BUTTON: CHAT_BUTTON_SELECTORS,
  CHAT_STATUS_DETECTION,
  CHAT_PAGE: CHAT_PAGE_SELECTORS,
  CHAT_MESSAGE: CHAT_MESSAGE_SELECTORS,
  CHAT_ANCHOR: CHAT_ANCHOR_SELECTORS,
  CHAT_INPUT: CHAT_INPUT_SELECTORS,
  CHAT_TIMING
};

// Module loaded
