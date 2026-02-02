/**
 * Адаптер логгера для content scripts
 * Content scripts не могут использовать ES6 import, поэтому создаем упрощенную версию
 */

// Уровни логирования
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Класс логгера для content scripts
class ContentLogger {
  constructor(moduleName = 'WB-Content') {
    this.moduleName = moduleName;
    this.currentLevel = LOG_LEVELS.INFO;
    this.colors = {
      DEBUG: '#6c757d',
      INFO: '#007bff',
      WARN: '#ffc107',
      ERROR: '#dc3545',
      SUCCESS: '#28a745',
    };

    // Пытаемся загрузить уровень логирования из настроек
    this.loadLogLevel();
  }

  async loadLogLevel() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.sync.get('settings');
        if (result.settings?.logLevel) {
          const levelName = result.settings.logLevel.toUpperCase();
          this.currentLevel = LOG_LEVELS[levelName] || LOG_LEVELS.INFO;
        }
      }
    } catch (error) {
      console.error('Failed to load log level:', error);
    }
  }

  setLevel(level) {
    const levelName = level.toUpperCase();
    if (LOG_LEVELS.hasOwnProperty(levelName)) {
      this.currentLevel = LOG_LEVELS[levelName];
    }
  }

  shouldLog(level) {
    return level >= this.currentLevel;
  }

  formatMessage(level) {
    const timestamp = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
    return `[${timestamp}] [${this.moduleName}] [${level}]`;
  }

  debug(message, ...args) {
    if (!this.shouldLog(LOG_LEVELS.DEBUG)) return;
    const prefix = this.formatMessage('DEBUG');
    console.log(
      `%c${prefix}%c ${message}`,
      `color: ${this.colors.DEBUG}; font-weight: bold`,
      'color: inherit',
      ...args
    );
  }

  info(message, ...args) {
    if (!this.shouldLog(LOG_LEVELS.INFO)) return;
    const prefix = this.formatMessage('INFO');
    console.log(
      `%c${prefix}%c ${message}`,
      `color: ${this.colors.INFO}; font-weight: bold`,
      'color: inherit',
      ...args
    );
  }

  warn(message, ...args) {
    if (!this.shouldLog(LOG_LEVELS.WARN)) return;
    const prefix = this.formatMessage('WARN');
    console.warn(
      `%c${prefix}%c ${message}`,
      `color: ${this.colors.WARN}; font-weight: bold`,
      'color: inherit',
      ...args
    );
  }

  error(message, ...args) {
    if (!this.shouldLog(LOG_LEVELS.ERROR)) return;
    const prefix = this.formatMessage('ERROR');
    console.error(
      `%c${prefix}%c ${message}`,
      `color: ${this.colors.ERROR}; font-weight: bold`,
      'color: inherit',
      ...args
    );
  }

  success(message, ...args) {
    const prefix = this.formatMessage('SUCCESS');
    console.log(
      `%c${prefix}%c ${message}`,
      `color: ${this.colors.SUCCESS}; font-weight: bold`,
      'color: inherit',
      ...args
    );
  }

  group(title, collapsed = false) {
    if (!this.shouldLog(LOG_LEVELS.DEBUG)) return;
    const prefix = this.formatMessage('GROUP');
    if (collapsed) {
      console.groupCollapsed(`%c${prefix}%c ${title}`,
        `color: ${this.colors.INFO}; font-weight: bold`,
        'color: inherit'
      );
    } else {
      console.group(`%c${prefix}%c ${title}`,
        `color: ${this.colors.INFO}; font-weight: bold`,
        'color: inherit'
      );
    }
  }

  groupEnd() {
    if (!this.shouldLog(LOG_LEVELS.DEBUG)) return;
    console.groupEnd();
  }

  table(data, columns) {
    if (!this.shouldLog(LOG_LEVELS.DEBUG)) return;
    console.table(data, columns);
  }

  time(label) {
    if (!this.shouldLog(LOG_LEVELS.DEBUG)) return;
    console.time(`[${this.moduleName}] ${label}`);
  }

  timeEnd(label) {
    if (!this.shouldLog(LOG_LEVELS.DEBUG)) return;
    console.timeEnd(`[${this.moduleName}] ${label}`);
  }

  createChild(submoduleName) {
    const childLogger = new ContentLogger(`${this.moduleName}:${submoduleName}`);
    childLogger.currentLevel = this.currentLevel;
    return childLogger;
  }
}

// Создаем глобальный логгер для content scripts
if (typeof window !== 'undefined') {
  window.WBLogger = ContentLogger;
  window.logger = new ContentLogger('WB-Content');
}
