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
      console.log(`[FetchRetry] Попытка ${attempt}/${maxRetries}: ${url}`);

      const response = await fetch(url, options);

      // Если ответ OK - возвращаем его
      if (response.ok) {
        console.log(`[FetchRetry] ✅ Успешный запрос на попытке ${attempt}`);
        return response;
      }

      // Если shouldRetry возвращает true И это не последняя попытка
      if (shouldRetry(response) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * baseDelay; // Exponential backoff: 2s, 4s, 8s
        console.warn(`[FetchRetry] ⚠️ HTTP ${response.status} на попытке ${attempt}. Повтор через ${delay}ms...`);
        await sleep(delay);
        continue; // Пробуем еще раз
      }

      // Для других ошибок или последней попытки - возвращаем ответ как есть
      return response;

    } catch (err) {
      console.error(`[FetchRetry] ❌ Ошибка на попытке ${attempt}:`, err);

      // Если это последняя попытка - выбрасываем ошибку
      if (attempt === maxRetries) {
        throw err;
      }

      // Иначе ждем и пробуем снова
      const delay = Math.pow(2, attempt) * baseDelay;
      console.log(`[FetchRetry] Повтор через ${delay}ms...`);
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
