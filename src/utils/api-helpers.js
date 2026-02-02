/**
 * API Helper Utilities
 *
 * Utility functions for Backend API integration:
 * - Parse complaintText from markdown-wrapped JSON
 * - Convert ISO 8601 dates to DD.MM.YYYY format for WB
 * - Generate composite review keys for identification
 *
 * @module utils/api-helpers
 * @version 1.3.0
 */

/**
 * Parses complaint text from markdown-wrapped JSON format
 *
 * Backend API returns complaintText in format:
 * ```json
 * {"reasonId":"11","reasonName":"...","complaintText":"..."}
 * ```
 *
 * This function extracts and parses the JSON content.
 *
 * @param {string} text - Complaint text in format: ```json\n{...}\n```
 * @returns {Object|null} - Parsed complaint object with {reasonId, reasonName, complaintText} or null
 *
 * @example
 * const text = '```json\n{"reasonId":"11","complaintText":"Test"}\n```';
 * const parsed = parseComplaintText(text);
 * // Returns: {reasonId: "11", complaintText: "Test"}
 */
export function parseComplaintText(text) {
  if (!text || typeof text !== 'string') {
    console.warn('[api-helpers] parseComplaintText: Invalid input', { text });
    return null;
  }

  try {
    // Extract JSON from markdown code block
    // Pattern: ```json\n{...}\n``` (supports multiline JSON)
    const match = text.match(/```json\s*\n([\s\S]*?)\n```/);

    if (!match || !match[1]) {
      console.warn('[api-helpers] parseComplaintText: No JSON block found', { text });
      return null;
    }

    const jsonString = match[1].trim();
    const parsed = JSON.parse(jsonString);

    // Validate required fields
    if (!parsed.reasonId || !parsed.complaintText) {
      console.warn('[api-helpers] parseComplaintText: Missing required fields', {
        parsed,
        hasReasonId: !!parsed.reasonId,
        hasComplaintText: !!parsed.complaintText
      });
      return null;
    }

    return {
      reasonId: String(parsed.reasonId),
      reasonName: parsed.reasonName || '',
      complaintText: parsed.complaintText
    };
  } catch (error) {
    console.error('[api-helpers] parseComplaintText: Failed to parse', {
      error: error.message,
      text
    });
    return null;
  }
}

/**
 * Converts ISO 8601 date to DD.MM.YYYY format for WB
 *
 * Backend API returns dates in ISO 8601 format (e.g., "2026-01-23T08:38:44.000Z"),
 * but WB displays dates in DD.MM.YYYY format (e.g., "23.01.2026").
 *
 * This function converts for compatibility with WB review identification.
 *
 * @param {string} isoDate - ISO 8601 date string
 * @returns {string} - Date in DD.MM.YYYY format, or empty string if invalid
 *
 * @example
 * formatDateForWB('2026-01-23T08:38:44.000Z');
 * // Returns: "23.01.2026"
 *
 * formatDateForWB('2025-12-05T00:00:00Z');
 * // Returns: "05.12.2025"
 */
export function formatDateForWB(isoDate) {
  if (!isoDate) {
    console.warn('[api-helpers] formatDateForWB: Empty date provided');
    return '';
  }

  try {
    const date = new Date(isoDate);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('[api-helpers] formatDateForWB: Invalid date', { isoDate });
      return '';
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
  } catch (error) {
    console.error('[api-helpers] formatDateForWB: Failed to format date', {
      error: error.message,
      isoDate
    });
    return '';
  }
}

/**
 * Generates composite review key for identification on WB page
 *
 * Extension v1.3.0 uses composite keys to identify reviews on WB pages:
 * Format: {productId}_{rating}_{reviewDate_ISO8601}
 * Example: "187489568_1_2026-01-23T08:38:44.000Z"
 *
 * This replaces the old ID-based system (WB removed IDs from DOM in Jan 2026).
 * Uses FULL ISO 8601 timestamp for uniqueness (multiple reviews can have same date).
 *
 * @param {Object} complaint - Complaint object with productId, rating, reviewDate
 * @param {string} complaint.productId - WB product article number
 * @param {number} complaint.rating - Review rating (1-5 stars)
 * @param {string} complaint.reviewDate - Review date (ISO 8601 format with time)
 * @returns {string|null} - Review key in format: productId_rating_ISO8601, or null if invalid
 *
 * @example
 * generateReviewKey({
 *   productId: '187489568',
 *   rating: 1,
 *   reviewDate: '2026-01-23T08:38:44.000Z'
 * });
 * // Returns: "187489568_1_2026-01-23T08:38:44.000Z"
 */
export function generateReviewKey(complaint) {
  if (!complaint || typeof complaint !== 'object') {
    console.warn('[api-helpers] generateReviewKey: Invalid complaint object', { complaint });
    return null;
  }

  const { productId, rating, reviewDate } = complaint;

  // Validate required fields
  if (!productId || !rating || !reviewDate) {
    console.warn('[api-helpers] generateReviewKey: Missing required fields', {
      hasProductId: !!productId,
      hasRating: !!rating,
      hasReviewDate: !!reviewDate,
      complaint
    });
    return null;
  }

  // Validate ISO 8601 format
  const date = new Date(reviewDate);
  if (isNaN(date.getTime())) {
    console.error('[api-helpers] generateReviewKey: Invalid ISO 8601 date', { reviewDate });
    return null;
  }

  // Use FULL ISO 8601 timestamp for uniqueness
  const reviewKey = `${productId}_${rating}_${reviewDate}`;

  return reviewKey;
}

/**
 * Validates complaint object structure
 *
 * Checks if complaint object has all required fields for processing.
 *
 * @param {Object} complaint - Complaint object to validate
 * @returns {Object} - Validation result {valid: boolean, errors: string[]}
 *
 * @example
 * validateComplaint({id: '123', productId: '456', rating: 5, reviewDate: '2026-01-23T08:38:44.000Z'});
 * // Returns: {valid: true, errors: []}
 *
 * validateComplaint({id: '123'});
 * // Returns: {valid: false, errors: ['Missing productId', 'Missing rating', 'Missing reviewDate']}
 */
export function validateComplaint(complaint) {
  const errors = [];

  if (!complaint) {
    return { valid: false, errors: ['Complaint object is null or undefined'] };
  }

  if (!complaint.id) {
    errors.push('Missing id');
  }

  if (!complaint.productId) {
    errors.push('Missing productId');
  }

  if (!complaint.rating || complaint.rating < 1 || complaint.rating > 5) {
    errors.push('Missing or invalid rating (must be 1-5)');
  }

  if (!complaint.reviewDate) {
    errors.push('Missing reviewDate');
  } else {
    // Validate date format
    const date = new Date(complaint.reviewDate);
    if (isNaN(date.getTime())) {
      errors.push('Invalid reviewDate format');
    }
  }

  if (!complaint.complaintText) {
    errors.push('Missing complaintText');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Batch process complaints: parse and generate keys
 *
 * Transforms array of complaints from API into processed format
 * with parsed complaintData and generated reviewKey.
 *
 * @param {Array<Object>} complaints - Array of complaint objects from API
 * @returns {Array<Object>} - Processed complaints with additional fields
 *
 * @example
 * const complaints = await api.getComplaints();
 * const processed = processComplaints(complaints);
 * // Each complaint now has: reviewDateFormatted, complaintData, reviewKey
 */
export function processComplaints(complaints) {
  if (!Array.isArray(complaints)) {
    console.warn('[api-helpers] processComplaints: Input is not an array', { complaints });
    return [];
  }

  return complaints.map((complaint, index) => {
    try {
      // ✅ Новый Backend API v2.0 возвращает разный формат
      // Определяем формат и нормализуем данные
      const isNewFormat = typeof complaint.complaintText === 'object' && complaint.createdAt;

      // Parse complaint text (если это строка в markdown, иначе используем объект как есть)
      const complaintData = isNewFormat
        ? complaint.complaintText  // Уже объект
        : parseComplaintText(complaint.complaintText); // Парсим из markdown

      // Нормализуем поле reviewDate (Backend API v2.0 использует createdAt)
      const reviewDate = complaint.reviewDate || complaint.createdAt;

      // Format date for WB
      const reviewDateFormatted = formatDateForWB(reviewDate);

      // Generate review key (используем нормализованное reviewDate)
      const reviewKey = generateReviewKey({
        ...complaint,
        reviewDate // Добавляем reviewDate если его нет
      });

      // Validate (используем нормализованное reviewDate)
      const validation = validateComplaint({
        ...complaint,
        reviewDate // Добавляем reviewDate для валидации
      });

      if (!validation.valid) {
        console.warn(`[api-helpers] processComplaints: Invalid complaint at index ${index}`, {
          errors: validation.errors,
          complaint
        });
      }

      return {
        ...complaint,
        reviewDate, // Нормализованное поле
        reviewDateFormatted,
        complaintData,
        reviewKey,
        _validation: validation
      };
    } catch (error) {
      console.error(`[api-helpers] processComplaints: Failed to process complaint at index ${index}`, {
        error: error.message,
        complaint
      });

      return {
        ...complaint,
        _error: error.message
      };
    }
  });
}

/**
 * Parse Russian date format "18 января 2026" to DD.MM.YYYY
 *
 * WB sometimes displays dates in Russian format.
 * This function converts them to DD.MM.YYYY for consistency.
 *
 * @param {string} dateText - Date in Russian format
 * @returns {string|null} - Date in DD.MM.YYYY format, or null if invalid
 *
 * @example
 * parseRussianDate('18 января 2026');
 * // Returns: "18.01.2026"
 *
 * parseRussianDate('5 декабря 2025');
 * // Returns: "05.12.2025"
 */
export function parseRussianDate(dateText) {
  if (!dateText || typeof dateText !== 'string') {
    return null;
  }

  const months = {
    'января': '01',
    'февраля': '02',
    'марта': '03',
    'апреля': '04',
    'мая': '05',
    'июня': '06',
    'июля': '07',
    'августа': '08',
    'сентября': '09',
    'октября': '10',
    'ноября': '11',
    'декабря': '12'
  };

  // Match pattern: "18 января 2026" or "5 декабря 2025"
  const match = dateText.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);

  if (!match) {
    return null;
  }

  const day = match[1].padStart(2, '0');
  const monthName = match[2].toLowerCase();
  const month = months[monthName];
  const year = match[3];

  if (!month) {
    console.warn('[api-helpers] parseRussianDate: Unknown month', { monthName, dateText });
    return null;
  }

  return `${day}.${month}.${year}`;
}

/**
 * Convert DD.MM.YYYY date to ISO 8601 format
 *
 * Reverse conversion for sending dates back to API.
 *
 * @param {string} dateStr - Date in DD.MM.YYYY format
 * @returns {string|null} - ISO 8601 date string, or null if invalid
 *
 * @example
 * convertToISO('23.01.2026');
 * // Returns: "2026-01-23T00:00:00.000Z"
 */
export function convertToISO(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);

  if (!match) {
    return null;
  }

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // Months are 0-indexed
  const year = parseInt(match[3], 10);

  try {
    const date = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

    if (isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  } catch (error) {
    console.error('[api-helpers] convertToISO: Failed to convert', { error: error.message, dateStr });
    return null;
  }
}

/**
 * Parse WB datetime format to ISO 8601
 *
 * WB shows datetime in format "DD.MM.YYYY в HH:MM" (e.g., "14.08.2025 в 15:17")
 * This function converts it to ISO 8601 format for matching with backend data.
 *
 * @param {string} wbDatetime - WB datetime string "DD.MM.YYYY в HH:MM"
 * @returns {string|null} - ISO 8601 string or null if invalid
 *
 * @example
 * parseWBDatetime('14.08.2025 в 15:17');
 * // Returns: "2025-08-14T15:17:00.000Z"
 *
 * parseWBDatetime('23.01.2026 в 08:38');
 * // Returns: "2026-01-23T08:38:00.000Z"
 */
export function parseWBDatetime(wbDatetime) {
  if (!wbDatetime || typeof wbDatetime !== 'string') {
    console.warn('[api-helpers] parseWBDatetime: Invalid input', { wbDatetime });
    return null;
  }

  // Pattern: "14.08.2025 в 15:17"
  const match = wbDatetime.match(/(\d{2})\.(\d{2})\.(\d{4})\s+в\s+(\d{2}):(\d{2})/);

  if (!match) {
    console.warn('[api-helpers] parseWBDatetime: Does not match WB format', { wbDatetime });
    return null;
  }

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // Months are 0-indexed
  const year = parseInt(match[3], 10);
  const hours = parseInt(match[4], 10);
  const minutes = parseInt(match[5], 10);

  try {
    // WB uses Moscow time (UTC+3), but we'll assume UTC for now
    // If needed, adjust timezone later
    const date = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));

    if (isNaN(date.getTime())) {
      console.error('[api-helpers] parseWBDatetime: Invalid date components', {
        day, month, year, hours, minutes
      });
      return null;
    }

    return date.toISOString();
  } catch (error) {
    console.error('[api-helpers] parseWBDatetime: Failed to parse', {
      error: error.message,
      wbDatetime
    });
    return null;
  }
}

/**
 * Format ISO 8601 datetime to WB format
 *
 * Converts ISO 8601 to WB display format "DD.MM.YYYY в HH:MM"
 *
 * @param {string} isoDatetime - ISO 8601 datetime string
 * @returns {string} - WB format string "DD.MM.YYYY в HH:MM"
 *
 * @example
 * formatDatetimeForWB('2025-08-14T15:17:00.000Z');
 * // Returns: "14.08.2025 в 15:17"
 */
export function formatDatetimeForWB(isoDatetime) {
  if (!isoDatetime) {
    return '';
  }

  try {
    const date = new Date(isoDatetime);

    if (isNaN(date.getTime())) {
      console.warn('[api-helpers] formatDatetimeForWB: Invalid date', { isoDatetime });
      return '';
    }

    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');

    return `${day}.${month}.${year} в ${hours}:${minutes}`;
  } catch (error) {
    console.error('[api-helpers] formatDatetimeForWB: Failed to format', {
      error: error.message,
      isoDatetime
    });
    return '';
  }
}

// Export all functions as default object for convenience
export default {
  parseComplaintText,
  formatDateForWB,
  formatDatetimeForWB,
  generateReviewKey,
  validateComplaint,
  processComplaints,
  parseRussianDate,
  parseWBDatetime,
  convertToISO
};
