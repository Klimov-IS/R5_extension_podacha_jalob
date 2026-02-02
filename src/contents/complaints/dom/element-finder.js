/**
 * ElementFinder - поиск элементов интерфейса Wildberries
 *
 * Этот модуль отвечает за поиск элементов DOM на странице WB:
 * - Кнопка меню (три точки)
 * - Dropdown меню
 * - Кнопка "Пожаловаться"
 * - Модальное окно жалобы
 * - Кнопка "Отправить"
 *
 * @module dom/element-finder
 * @since 1.3.0 (28.01.2026)
 */

'use strict';

/**
 * Класс для поиска элементов интерфейса WB
   */
  class ElementFinder {
    /**
     * Ищет кнопку меню (три точки) в строке отзыва
     * ЯНВАРЬ 2026: WB добавил новую колонку "Инфо о товаре", кнопки могут быть не в последней ячейке
     *
     * @param {HTMLElement} row - строка таблицы отзывов
     * @returns {HTMLButtonElement|null} - кнопка меню или null
     */
    static findMenuButton(row) {
      // ЯНВАРЬ 2026: В строке есть ДВЕ кнопки с onlyIcon:
      // 1. Кнопка чата (viewBox "0 0 16 16") - disabled
      // 2. Кнопка троеточия (viewBox "-10 -3 24 24") - активная
      // Нужно найти именно троеточие по характерному viewBox с "-10"

      // Способ 1 (ПРИОРИТЕТНЫЙ): Ищем кнопку с SVG viewBox содержащим "-10" (троеточие)
      const allButtons = row.querySelectorAll('button[class*="onlyIcon"]');
      for (const btn of allButtons) {
        const svg = btn.querySelector('svg');
        const viewBox = svg?.getAttribute('viewBox');
        if (viewBox && viewBox.includes('-10')) {
          console.log('[ElementFinder] Found menu button via viewBox -10');
          return btn;
        }
      }

      // Способ 2: Ищем по классу More-button (кнопка "Ещё")
      const moreButton = row.querySelector('[class*="More-button__button"]');
      if (moreButton) {
        console.log('[ElementFinder] Found menu button via More-button class');
        return moreButton;
      }

      // Способ 3: Fallback - ищем в ячейках справа налево
      const cells = Array.from(row.children);
      for (let i = cells.length - 1; i >= 0; i--) {
        const cell = cells[i];
        const buttonsCell = cell.querySelector('[class*="Buttons-cell"]') || cell.querySelector('div > div');
        if (!buttonsCell) continue;

        // Ищем SVG с viewBox -10 в любой кнопке
        const svgButtons = buttonsCell.querySelectorAll('button svg');
        for (const svg of svgButtons || []) {
          const viewBox = svg.getAttribute('viewBox');
          if (viewBox && viewBox.includes('-10')) {
            console.log('[ElementFinder] Found menu button via cell search');
            return svg.closest('button');
          }
        }
      }

      console.warn('[ElementFinder] Menu button not found in row');
      return null;
    }

    /**
     * Ищет открытый dropdown с меню
     *
     * СТРУКТУРА HTML (январь 2026):
     * <ul class="Dropdown-list__xxx">
     *   <li class="Dropdown-list__item__xxx">
     *     <button class="Dropdown-option__xxx">...</button>
     *   </li>
     * </ul>
     *
     * @returns {HTMLElement|null} - dropdown или null
     */
    static findOpenDropdown() {
      // Способ 1: Ищем элемент списка dropdown (li с Dropdown-list__item)
      const dropdownItem = document.querySelector('li[class*="Dropdown-list__item"]');
      if (dropdownItem) {
        // Возвращаем родительский ul или сам item
        const parentList = dropdownItem.parentElement;
        console.log('[ElementFinder] Found dropdown via Dropdown-list__item');
        return parentList || dropdownItem;
      }

      // Способ 2: По частичному классу Dropdown-list (ul контейнер)
      let dropdown = document.querySelector('ul[class*="Dropdown-list"], [class*="Dropdown-list"]:not(li)');
      if (dropdown) {
        console.log('[ElementFinder] Found dropdown via Dropdown-list class');
        return dropdown;
      }

      // Способ 3: Ищем кнопку с Dropdown-option и поднимаемся к родителю
      const optionBtn = document.querySelector('button[class*="Dropdown-option"]');
      if (optionBtn) {
        dropdown = optionBtn.closest('ul') || optionBtn.closest('[class*="Dropdown"]') || optionBtn.parentElement?.parentElement;
        if (dropdown) {
          console.log('[ElementFinder] Found dropdown via Dropdown-option button');
          return dropdown;
        }
      }

      // Способ 4: По role
      dropdown = document.querySelector('[role="menu"], [role="listbox"]');
      if (dropdown) {
        console.log('[ElementFinder] Found dropdown via role attribute');
        return dropdown;
      }

      // Способ 5: Ищем видимый popup с кнопками
      const candidates = document.querySelectorAll('div[style*="position"], div[class*="popup"], div[class*="Popup"], ul');
      for (const el of candidates) {
        const style = getComputedStyle(el);
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        const hasHighZIndex = parseInt(style.zIndex) > 100;
        const hasButtons = el.querySelectorAll('button').length > 0;

        if (isVisible && hasHighZIndex && hasButtons) {
          console.log('[ElementFinder] Found dropdown via visible popup search');
          dropdown = el;
          break;
        }
      }

      return dropdown;
    }

    /**
     * Ищет кнопку "Пожаловаться на отзыв" в dropdown
     *
     * СТРУКТУРА HTML (январь 2026):
     * <button class="Dropdown-option__xxx Dropdown-option--warning__xxx">
     *   <span data-name="Text">Пожаловаться на отзыв</span>
     * </button>
     *
     * @returns {HTMLButtonElement|null} - кнопка или null
     */
    static findComplaintButton() {
      // ЯНВАРЬ 2026: В dropdown ДВЕ кнопки с классом warning:
      // 1. "Запросить возврат" - первая
      // 2. "Пожаловаться на отзыв" - вторая (нужна нам!)
      // Поэтому ищем ТОЛЬКО по тексту, не по классу

      // Способ 1 (ПРИОРИТЕТНЫЙ): Ищем по тексту "Пожаловаться на отзыв"
      const allButtons = document.querySelectorAll('button');
      for (const button of allButtons) {
        const text = button.innerText || button.textContent;
        if (text && text.includes('Пожаловаться на отзыв')) {
          console.log('[ElementFinder] Found complaint button via text "Пожаловаться на отзыв"');
          return button;
        }
      }

      // Способ 2: Ищем в dropdown по тексту
      const dropdown = this.findOpenDropdown();
      if (dropdown) {
        const buttons = dropdown.querySelectorAll('button');
        for (const button of buttons) {
          const text = button.innerText || button.textContent;
          if (text && text.includes('Пожаловаться')) {
            console.log('[ElementFinder] Found complaint button in dropdown');
            return button;
          }
        }
      }

      // Способ 3 (Fallback): Ищем вторую кнопку с warning классом
      const warningButtons = document.querySelectorAll('button[class*="Dropdown-option--warning"]');
      if (warningButtons.length >= 2) {
        console.log('[ElementFinder] Found complaint button as 2nd warning button');
        return warningButtons[1]; // Вторая кнопка - "Пожаловаться"
      }

      return null;
    }

    /**
     * Закрывает открытый dropdown
     */
    static closeOpenDropdown() {
      const dropdown = this.findOpenDropdown();
      if (dropdown) {
        document.body.click();
        console.log("[ElementFinder] 🔄 Закрываем dropdown");
      }
    }

    /**
     * Ищет модальное окно жалобы
     *
     * @returns {HTMLElement|null} - модальное окно или null
     */
    static findComplaintModal() {
      // Способ 1: По частичному классу
      let modal = document.querySelector('[class*="Complaint-form"]');

      // Способ 2: Ищем форму с радиокнопками и textarea
      if (!modal) {
        const forms = document.querySelectorAll('form, [role="dialog"], [class*="modal"]');
        for (const form of forms) {
          if (form.querySelector('input[type="radio"]') && form.querySelector('textarea')) {
            modal = form;
            break;
          }
        }
      }

      // Способ 3: Ищем секцию с textarea#explanation
      if (!modal) {
        const textarea = document.querySelector('#explanation');
        if (textarea) {
          modal = textarea.closest('section, form, [class*="modal"], [class*="Complaint"]');
        }
      }

      return modal;
    }

    /**
     * Ищет кнопку "Отправить" в модальном окне
     *
     * СТРУКТУРА HTML (январь 2026):
     * <div class="Complaint-form__buttons__xxx">
     *   <button class="button__xxx">
     *     <span class="caption__xxx">Отправить</span>
     *   </button>
     * </div>
     *
     * @returns {HTMLButtonElement|null} - кнопка или null
     */
    static findSubmitButton() {
      // Способ 1: Ищем контейнер кнопок жалобы
      const buttonsContainer = document.querySelector('[class*="Complaint-form__buttons"]');
      if (buttonsContainer) {
        const btn = buttonsContainer.querySelector('button');
        if (btn) {
          console.log('[ElementFinder] Found submit button in Complaint-form__buttons');
          return btn;
        }
      }

      // Способ 2: Кнопка с текстом "Отправить"
      const allButtons = document.querySelectorAll('button');
      for (const b of allButtons) {
        const text = b.innerText || b.textContent;
        if (text && (text.trim() === 'Отправить' || text.includes('Отправить'))) {
          console.log('[ElementFinder] Found submit button via text');
          return b;
        }
      }

      // Способ 3: В модальном окне
      const modal = this.findComplaintModal();
      if (modal) {
        const btn = modal.querySelector('button[type="submit"]');
        if (btn) {
          console.log('[ElementFinder] Found submit button in modal');
          return btn;
        }
      }

      // Способ 4: По классу primary/main кнопки
      const btn = document.querySelector('[class*="button"][class*="m__"]');
      if (btn) {
        console.log('[ElementFinder] Found submit button via class pattern');
        return btn;
      }

      return null;
    }

    /**
     * Ищет таблицу с отзывами
     *
     * @returns {HTMLElement|null} - таблица или null
     */
    static findReviewsTable() {
      // Способ 1: По частичному классу
      let table = document.querySelector('[class*="Base-table-body"]');

      // Способ 2: Ищем tbody или контейнер со строками
      if (!table) {
        table = document.querySelector('tbody, [role="rowgroup"]');
      }

      return table;
    }
  }

  // Экспортируем в глобальную область для использования в content scripts
  window.ElementFinder = ElementFinder;

console.log('[ElementFinder] Модуль успешно загружен');
