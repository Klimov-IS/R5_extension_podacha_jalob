/**
 * Сервис логирования для complaints-page
 * Централизованное управление логами в UI
 *
 * @version 1.0.0
 * @description Решает проблему автоинжекта - инициализируется ДО DOMContentLoaded
 */

/**
 * Сервис для работы с логами на странице подачи жалоб
 * Инициализируется сразу при импорте, до DOMContentLoaded
 */
export class ComplaintsLoggerService {
  /**
   * @param {string} containerId - ID элемента для логов
   */
  constructor(containerId = 'logs-container') {
    this.containerId = containerId;
    this.container = null;
    this.logs = []; // Буфер для логов до инициализации DOM
    this.isInitialized = false;

    console.log('[ComplaintsLogger] Сервис создан, ожидание инициализации DOM');
  }

  /**
   * Инициализация DOM элемента (вызывается из DOMContentLoaded)
   */
  initialize() {
    this.container = document.getElementById(this.containerId);

    if (!this.container) {
      console.error(`[ComplaintsLogger] ❌ Элемент #${this.containerId} не найден!`);
      return false;
    }

    this.isInitialized = true;
    console.log('[ComplaintsLogger] ✅ DOM инициализирован');

    // Применяем буферизованные логи
    if (this.logs.length > 0) {
      console.log(`[ComplaintsLogger] 📝 Применяем ${this.logs.length} буферизованных логов`);
      this.logs.forEach(log => this._addLogToDOM(log.level, log.message));
      this.logs = []; // Очищаем буфер
    }

    return true;
  }

  /**
   * Добавление лога в UI
   * @param {string} level - Уровень: "info", "success", "warn", "error"
   * @param {string} message - Сообщение
   */
  addLog(level, message) {
    // Если DOM еще не готов - сохраняем в буфер
    if (!this.isInitialized) {
      console.log(`[ComplaintsLogger] 📦 Буферизация: [${level}] ${message}`);
      this.logs.push({ level, message });
      return;
    }

    // Иначе добавляем в DOM
    this._addLogToDOM(level, message);
  }

  /**
   * Внутренний метод для добавления лога в DOM
   * @private
   */
  _addLogToDOM(level, message) {
    if (!this.container) {
      console.warn('[ComplaintsLogger] ⚠️ Container не инициализирован');
      return;
    }

    const logDiv = document.createElement('div');
    logDiv.className = `log-entry log-${level}`;

    const time = new Date().toLocaleTimeString('ru-RU');
    logDiv.innerHTML = `<span class="log-timestamp">${time}</span>${message}`;

    this.container.appendChild(logDiv);
    this.container.scrollTop = this.container.scrollHeight;

    // Дублируем в консоль
    const emoji = {
      'info': 'ℹ️',
      'success': '✅',
      'warn': '⚠️',
      'error': '❌'
    }[level] || '📝';

    console.log(`${emoji} [Complaints] ${message}`);
  }

  /**
   * Методы для разных уровней логирования
   */
  info(message) {
    this.addLog('info', message);
  }

  success(message) {
    this.addLog('success', message);
  }

  warn(message) {
    this.addLog('warn', message);
  }

  error(message) {
    this.addLog('error', message);
  }

  /**
   * Очистка логов
   */
  clear() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.logs = [];
    console.log('[ComplaintsLogger] 🗑️ Логи очищены');
  }

  /**
   * Скачивание логов в текстовый файл
   */
  downloadLogs() {
    if (!this.container) {
      console.error('[ComplaintsLogger] ❌ Container не инициализирован');
      return;
    }

    const logs = Array.from(this.container.children).map(entry => entry.textContent);
    const text = logs.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `wb-complaints-logs-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.success('✅ Логи скачаны');
  }

  /**
   * Получить все логи как массив строк
   * @returns {string[]}
   */
  getAllLogs() {
    if (!this.container) {
      return [];
    }

    return Array.from(this.container.children).map(entry => entry.textContent);
  }
}

/**
 * Singleton экземпляр логгера
 * Создается сразу при импорте модуля, ДО DOMContentLoaded
 * Это решает проблему автоинжекта!
 */
export const complaintsLogger = new ComplaintsLoggerService();

console.log('[ComplaintsLogger] 🚀 Модуль загружен (singleton создан)');
