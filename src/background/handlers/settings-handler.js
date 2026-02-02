/**
 * Handler для операций с настройками
 * Обрабатывает событие SETTINGS_UPDATED
 *
 * @version 1.2.0
 * @description Обрабатывает обновления настроек и сбрасывает кеш
 */

import { settingsService } from '../../services/settings-service.js';

/**
 * Handler для операций с настройками
 */
export class SettingsHandler {
  /**
   * Обработать обновление настроек
   * @param {Object} message - Сообщение
   * @returns {Promise<Object>} { success: boolean }
   */
  async onSettingsUpdated(message) {
    console.log('[SettingsHandler] Настройки обновлены, сбрасываем кеш');

    try {
      // Сбрасываем кеш настроек
      settingsService.invalidateCache();

      console.log('[SettingsHandler] ✅ Кеш настроек сброшен');
      return { success: true };

    } catch (err) {
      console.error('[SettingsHandler] ❌ Ошибка сброса кеша:', err);
      return { error: err.message };
    }
  }

  /**
   * Получить текущие настройки
   * @returns {Promise<Object>} { data: Object } или { error: string }
   */
  async getSettings() {
    console.log('[SettingsHandler] Запрос текущих настроек');

    try {
      const settings = await settingsService.getSettings(false); // Без кеша
      console.log('[SettingsHandler] ✅ Настройки получены');
      return { data: settings };

    } catch (err) {
      console.error('[SettingsHandler] ❌ Ошибка получения настроек:', err);
      return { error: err.message };
    }
  }

  /**
   * Валидировать настройки
   * @returns {Promise<Object>} { data: Object }
   */
  async validateSettings() {
    console.log('[SettingsHandler] Валидация настроек');

    try {
      const validation = await settingsService.validateSettings();
      console.log('[SettingsHandler] ✅ Валидация завершена:', validation);
      return { data: validation };

    } catch (err) {
      console.error('[SettingsHandler] ❌ Ошибка валидации:', err);
      return { error: err.message };
    }
  }
}
