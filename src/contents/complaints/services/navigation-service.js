/**
 * NavigationService - навигация по страницам (пагинация)
 *
 * Этот модуль отвечает за переключение страниц в таблице отзывов WB
 * и проверку успешности переключения
 *
 * @module services/navigation-service
 * @since 1.3.0 (28.01.2026)
 */

'use strict';

/**
 * Сервис навигации по страницам
   */
  class NavigationService {
    /**
     * Перейти на следующую страницу
     * Проверяет изменение страницы по дате первой строки
     *
     * @returns {Promise<boolean>} - true если страница успешно переключилась
     */
    static async goToNextPage() {
      // Используем функцию поиска кнопки из WBUtils (с verbose логированием)
      const nextButton = window.WBUtils.findNextPageButton(true);

      if (!nextButton) {
        return false;
      }

      if (!window.WBUtils.canGoToNextPage(nextButton)) {
        return false;
      }

      // Получаем данные ДО клика для проверки изменения
      let tableBefore = window.ElementFinder
        ? window.ElementFinder.findReviewsTable()
        : document.querySelector('[class*="Base-table-body"]') || document.querySelector('tbody');
      const rowsCountBefore = tableBefore?.children.length || 0;
      const firstRowDateBefore = tableBefore?.children[0]
        ? window.DataExtractor.getReviewDate(tableBefore.children[0])
        : null;
      tableBefore = null; // Release DOM ref before sleep

      // Кликаем по кнопке "Следующая страница"
      nextButton.click();

      // Ждем загрузки новой страницы (4 секунды - WB API медленный)
      await window.WBUtils.sleep(4000);

      // Проверяем данные ПОСЛЕ клика
      let tableAfter = window.ElementFinder
        ? window.ElementFinder.findReviewsTable()
        : document.querySelector('[class*="Base-table-body"]') || document.querySelector('tbody');
      const rowsCountAfter = tableAfter?.children.length || 0;
      const firstRowDateAfter = tableAfter?.children[0]
        ? window.DataExtractor.getReviewDate(tableAfter.children[0])
        : null;
      tableAfter = null; // Release DOM ref

      // Страница переключилась, если:
      // 1. Дата первой строки изменилась (самая надежная проверка)
      // 2. ИЛИ изменилось количество строк (fallback для крайних случаев)
      const pageChanged =
        (firstRowDateBefore !== firstRowDateAfter && firstRowDateAfter !== null) ||
        (rowsCountBefore !== rowsCountAfter && rowsCountAfter > 0);

      return pageChanged;
    }

    /**
     * Вставить артикул в поле поиска и выполнить поиск
     *
     * @param {string} productId - артикул товара
     * @returns {Promise<boolean>} - true если поиск выполнен успешно
     */
    static async searchByArticle(productId) {
      // Используем СИНХРОННУЮ функцию поиска input из WBUtils
      const input = window.WBUtils.findSearchInputSync(true);

      if (!input) {
        console.error('[NavigationService] ❌ Поле поиска не найдено');
        return false;
      }

      // КРИТИЧНО: Фокусируемся на input ПЕРЕД установкой значения!
      input.focus();

      // Выделяем весь текст (как Ctrl+A) - при вставке он будет заменён
      // Это избегает промежуточного состояния "пустое поле" которое вызывает лишнюю загрузку
      input.select();

      // Вставляем артикул через prototype setter (работает с React)
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, productId);
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // КРИТИЧНО: Нажимаем Enter для активации поиска!
      input.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      }));
      input.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      }));

      // Ждем применения фильтра (7.5 секунд - для медленного интернета)
      await window.WBUtils.sleep(7500);

      return true;
    }

    /**
     * Очистить поле поиска
     *
     * @returns {Promise<boolean>} - true если очистка успешна
     */
    static async clearSearch() {
      const input = window.WBUtils.findSearchInputSync(false);

      if (!input) {
        return false;
      }

      window.WBUtils.clearInput(input);
      await window.WBUtils.sleep(500);

      return true;
    }
  }

  // Экспортируем в глобальную область
  window.NavigationService = NavigationService;

console.log('[NavigationService] Модуль успешно загружен');
