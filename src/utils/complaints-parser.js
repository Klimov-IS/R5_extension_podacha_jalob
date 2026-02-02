/**
 * Утилиты для парсинга данных жалоб
 * Парсинг текста жалоб, валидация
 *
 * @version 1.0.0
 */

/**
 * Парсинг текста жалобы
 * Поддерживает как новый формат (объект), так и старый (JSON-строка)
 *
 * @param {string|Object} complaintText - Текст жалобы
 * @returns {Object} - Распарсенный объект { complaintText, reasonName, reasonId }
 * @throws {Error} - Если парсинг не удался
 */
export function parseComplaintText(complaintText) {
  try {
    // ✅ Новый формат Backend API v2.0 - complaintText уже объект
    if (typeof complaintText === 'object' && complaintText !== null) {
      return {
        complaintText: complaintText.complaintText || '',
        reasonName: complaintText.reasonName || '',
        reasonId: complaintText.reasonId || null
      };
    }

    // ⚠️ Старый формат - JSON-строка обернутая в markdown
    if (typeof complaintText === 'string') {
      const rawJson = complaintText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(rawJson);

      return {
        complaintText: parsed.complaintText || '',
        reasonName: parsed.reasonName || '',
        reasonId: parsed.reasonId || null
      };
    }

    throw new Error('Неизвестный формат complaintText');
  } catch (error) {
    console.error('[Parser] ❌ Ошибка парсинга complaintText:', error);
    throw new Error(`Не удалось распарсить текст жалобы: ${error.message}`);
  }
}

/**
 * Валидация жалобы
 * @param {Object} complaint - Объект жалобы
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
export function validateComplaint(complaint) {
  const errors = [];

  // Проверка обязательных полей
  if (!complaint.id) {
    errors.push('Отсутствует поле id');
  }

  if (!complaint.productId) {
    errors.push('Отсутствует поле productId');
  }

  if (complaint.rating === undefined || complaint.rating === null) {
    errors.push('Отсутствует поле rating');
  }

  if (!complaint.complaintText) {
    errors.push('Отсутствует поле complaintText');
  }

  // Проверка формата productId (должен быть числовым)
  if (complaint.productId && !/^\d+$/.test(complaint.productId)) {
    errors.push(`productId должен быть числовым (получено: "${complaint.productId}")`);
  }

  // Проверка rating (должен быть от 1 до 5)
  if (complaint.rating && (complaint.rating < 1 || complaint.rating > 5)) {
    errors.push(`rating должен быть от 1 до 5 (получено: ${complaint.rating})`);
  }

  // Попытка парсинга complaintText
  if (complaint.complaintText) {
    try {
      parseComplaintText(complaint.complaintText);
    } catch (error) {
      errors.push(`Ошибка парсинга complaintText: ${error.message}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Валидация массива жалоб
 * @param {Array} complaints - Массив жалоб
 * @returns {Object} - { valid: [], invalid: [], stats: {} }
 */
export function validateComplaints(complaints) {
  const valid = [];
  const invalid = [];
  const stats = {
    total: complaints.length,
    validCount: 0,
    invalidCount: 0,
    errorsByType: {}
  };

  complaints.forEach(complaint => {
    const validation = validateComplaint(complaint);

    if (validation.isValid) {
      valid.push(complaint);
      stats.validCount++;
    } else {
      invalid.push({
        complaint,
        errors: validation.errors
      });
      stats.invalidCount++;

      // Подсчет ошибок по типам
      validation.errors.forEach(error => {
        if (!stats.errorsByType[error]) {
          stats.errorsByType[error] = 0;
        }
        stats.errorsByType[error]++;
      });
    }
  });

  return { valid, invalid, stats };
}

/**
 * Форматирование текста жалобы для отправки
 * Добавляет префикс с датой
 *
 * @param {string} complaintText - Текст жалобы
 * @returns {string} - Отформатированный текст
 */
export function formatComplaintTextForSubmission(complaintText) {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const prefix = `Жалоба от: ${day}.${month}.${year}\n\n`;

  return prefix + complaintText;
}

/**
 * Диагностика productId (проверка формата)
 * @param {Array} complaints - Массив жалоб
 * @returns {Object} - Результат диагностики
 */
export function diagnoseProductIds(complaints) {
  const samples = complaints.slice(0, 5).map(c => ({
    id: c.id,
    productId: c.productId,
    isNumeric: /^\d+$/.test(c.productId),
    type: typeof c.productId,
    rating: c.rating
  }));

  const numericCount = complaints.filter(c => /^\d+$/.test(c.productId)).length;
  const nonNumericCount = complaints.length - numericCount;

  const nonNumericSamples = complaints
    .filter(c => !/^\d+$/.test(c.productId))
    .slice(0, 10)
    .map(c => ({
      productId: c.productId,
      id: c.id
    }));

  return {
    samples,
    numericCount,
    nonNumericCount,
    nonNumericSamples,
    hasCriticalIssue: nonNumericCount > 0
  };
}
