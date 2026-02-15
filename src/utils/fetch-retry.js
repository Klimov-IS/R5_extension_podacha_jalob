/**
 * Утилита для fetch запросов с автоматическими повторными попытками
 * Реализует exponential backoff стратегию
 *
 * @version 1.2.0
 * @description Выполняет fetch с автоматическими повторами при ошибках сети или HTTP 503
 */

/**
 * Fetch с автоматическими повторными попытками
 * @param {string} url - URL для запроса
 * @param {RequestInit} options - Опции fetch
 * @param {Object} config - Конфигурация retry
 * @param {number} [config.maxRetries=3] - Максимум попыток
 * @param {number} [config.baseDelay=1000] - Базовая задержка в мс
 * @param {Function} [config.shouldRetry] - Функция проверки нужно ли повторять
 * @returns {Promise<Response>}
 * @throws {Error} Если все попытки исчерпаны
 *
 * @example
 * const response = await fetchWithRetry('https://api.example.com/data', {
 *   method: 'GET',
 *   headers: { 'Authorization': 'Bearer token' }
 * }, {
 *   maxRetries: 3,
 *   baseDelay: 1000,
 *   shouldRetry: (res) => res.status === 503
 * });
 */
export async function fetchWithRetry(url, options = {}, config = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    shouldRetry = (response) => response.status === 503
  } = config;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return response;
      }

      if (shouldRetry(response) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * baseDelay;
        await sleep(delay);
        continue;
      }

      // Для других ошибок или последней попытки - возвращаем ответ как есть
      return response;

    } catch (err) {
      if (attempt === maxRetries) {
        throw err;
      }
      const delay = Math.pow(2, attempt) * baseDelay;
      await sleep(delay);
    }
  }

  throw new Error('Все попытки исчерпаны');
}

/**
 * Вспомогательная функция задержки
 * @param {number} ms - Миллисекунды
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
