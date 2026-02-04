/**
 * Утилиты для content scripts (жалобы на WB)
 * Создаём глобальный объект window.WBUtils для использования в content.js
 */

'use strict';

  // ========================================================================
  // УТИЛИТЫ ДЛЯ РАБОТЫ С DOM
  // ========================================================================

  /**
   * Установить значение input/textarea напрямую через нативное свойство
   * Это нужно для React-компонентов, которые не реагируют на обычное присвоение value
   *
   * @param {HTMLInputElement|HTMLTextAreaElement} element
   * @param {string} value
   */
  function setNativeValue(element, value) {
    if (!element) {
      console.error('[setNativeValue] Element is null');
      return;
    }

    // Определяем правильный prototype в зависимости от типа элемента
    let prototype;
    if (element instanceof HTMLTextAreaElement) {
      prototype = HTMLTextAreaElement.prototype;
    } else if (element instanceof HTMLInputElement) {
      prototype = HTMLInputElement.prototype;
    } else {
      prototype = Object.getPrototypeOf(element);
    }

    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set ||
                       Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (valueSetter) {
      // Фокусируемся на элементе
      element.focus();

      // Устанавливаем значение через нативный setter
      valueSetter.call(element, value);

      // Dispatch события для React/Vue
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        composed: true,
        inputType: 'insertText',
        data: value
      }));

      element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

      console.log(`[setNativeValue] ✅ Значение установлено (${value.length} символов)`);
    } else {
      // Fallback: прямое присвоение
      console.warn('[setNativeValue] ⚠️ Setter не найден, используем прямое присвоение');
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /**
   * Очистить input
   */
  function clearInput(input) {
    setNativeValue(input, '');
  }

  /**
   * Пауза (Promise-based sleep)
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Кликнуть по элементу (с небольшой паузой после клика)
   *
   * ВАЖНО: WB использует React, порядок действий критичен:
   * 1. scrollIntoView - элемент должен быть видим
   * 2. focus() - фокус на элементе
   * 3. .click() - сначала нативный клик
   * 4. MouseEvent - если нативный не сработал
   *
   * @param {HTMLElement} element - элемент для клика
   * @param {number} pauseAfter - пауза после клика в мс (по умолчанию 100)
   */
  async function clickElement(element, pauseAfter = 100) {
    if (!element) {
      throw new Error('Element is null or undefined');
    }

    // 1. Прокручиваем элемент в видимую область
    element.scrollIntoView({ behavior: 'instant', block: 'center' });
    await sleep(100);

    // 2. Фокусируемся на элементе
    element.focus();
    await sleep(50);

    // 3. Пробуем нативный .click() сначала
    element.click();
    await sleep(pauseAfter);
  }

  /**
   * Усиленный клик для React-кнопок
   * Использует PointerEvents + MouseEvents + нативный click
   *
   * @param {HTMLElement} element - элемент для клика
   * @param {number} pauseAfter - пауза ПОСЛЕ всех событий (по умолчанию 700мс)
   */
  async function clickElementForced(element, pauseAfter = 700) {
    if (!element) {
      throw new Error('Element is null or undefined');
    }

    console.log('[clickElementForced] Кликаем на элемент:', element.tagName, element.className);

    // 1. Прокручиваем элемент в видимую область
    element.scrollIntoView({ behavior: 'instant', block: 'center' });
    await sleep(100);

    // 2. Получаем координаты центра элемента
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const eventOptions = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: centerX,
      clientY: centerY,
      screenX: centerX,
      screenY: centerY,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
    };

    // 3. Фокусируемся
    element.focus();

    // 4. PointerEvents (современный React)
    element.dispatchEvent(new PointerEvent('pointerdown', eventOptions));
    element.dispatchEvent(new PointerEvent('pointerup', eventOptions));

    // 5. MouseEvents (fallback)
    element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
    element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
    element.dispatchEvent(new MouseEvent('click', eventOptions));

    // 6. Нативный клик
    element.click();

    console.log('[clickElementForced] Все события отправлены');

    // 7. Ждём после всех событий (даём React время показать меню)
    await sleep(pauseAfter);
  }

  /**
   * Ожидание появления элемента в DOM
   */
  function waitForElement(selector, options = {}) {
    const { timeout = 10000, checkInterval = 100 } = options;

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const check = () => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`Элемент "${selector}" не найден за ${timeout}мс`));
          return;
        }

        setTimeout(check, checkInterval);
      };

      check();
    });
  }

  /**
   * Получить ID отзыва из строки таблицы
   * ВНИМАНИЕ: С января 2026 WB убрал ID из интерфейса
   * Эта функция оставлена для legacy кода, но возвращает null
   */
  function getIdFromRow(row) {
    try {
      // Способ 1: Через data-атрибут
      const id = row.getAttribute('data-id') || row.getAttribute('data-review-id');
      if (id) return id;

      // Способ 2: Через ссылку на товар
      const link = row.querySelector('a[href*="/catalog/"]');
      if (link) {
        const match = link.href.match(/feedbackId=(\d+)/);
        if (match) return match[1];
      }

      // Способ 3: Через скрытый input
      const hiddenInput = row.querySelector('input[name="feedbackId"], input[data-feedback-id]');
      if (hiddenInput) return hiddenInput.value;

      // Способ 4: Парсинг из onclick или data-атрибутов
      const allElements = row.querySelectorAll('[data-testid], [data-id]');
      for (const el of allElements) {
        const dataId = el.getAttribute('data-id') || el.getAttribute('data-testid');
        if (dataId && /^\d+$/.test(dataId)) {
          return dataId;
        }
      }

      return null;
    } catch (error) {
      console.error('Ошибка при получении ID из строки:', error);
      return null;
    }
  }

  /**
   * Получить дату отзыва из строки таблицы
   *
   * ВАЖНО (январь 2026): WB показывает ТОЛЬКО ДАТУ, время в отдельном элементе
   * Формат даты: "18.01.2026"
   *
   * ПРИМЕЧАНИЕ: Эта функция возвращает ТОЛЬКО дату для совместимости.
   * Для полного datetime используйте DataExtractor.getReviewDate()
   *
   * @param {HTMLElement} row - строка таблицы
   * @returns {string|null} - дата в формате "DD.MM.YYYY" или null
   */
  function getReviewDateFromRow(row) {
    try {
      // Ищем родительский контейнер с датой и временем
      const parentContainer = row.querySelector('[class*="Col-date-time-with-readmark__"]');

      if (!parentContainer) {
        return null;
      }

      // Ищем контейнер с датой
      const dateContainer = parentContainer.querySelector('[class*="Col-date-time-with-readmark__date-with-marker"]');

      if (!dateContainer) {
        return null;
      }

      // Извлекаем текст первого span внутри контейнера
      const dateSpan = dateContainer.querySelector('span');
      if (dateSpan) {
        const dateText = dateSpan.textContent.trim();
        // Проверяем формат DD.MM.YYYY
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateText)) {
          return dateText;
        }
      }

      return null;
    } catch (error) {
      console.error('[WBUtils] Ошибка при извлечении даты отзыва:', error);
      return null;
    }
  }

  /**
   * Получить рейтинг отзыва из строки таблицы
   * Подсчитывает количество оранжевых звезд
   *
   * ВАЖНО: Каждая звезда - это отдельный SVG элемент
   * Оранжевые звезды (заполненные): fill="#FF773C"
   * Серые звезды (пустые): fill="#d1cfd7"
   *
   * @param {HTMLElement} row - строка таблицы
   * @returns {number|null} - рейтинг (1-5) или null
   */
  function getReviewRatingFromRow(row) {
    try {
      // Ищем контейнер с рейтингом
      const ratingContainer = row.querySelector('[class*="Rating__"]');

      if (!ratingContainer) {
        return null;
      }

      // Подсчитываем SVG элементы с оранжевыми звездами
      const allStarsSvg = ratingContainer.querySelectorAll('svg');
      let orangeStarsCount = 0;

      for (const svg of allStarsSvg) {
        // Ищем path с оранжевым цветом внутри SVG
        const orangePath = svg.querySelector('path[fill="#FF773C"], path[fill="#ff773c"]');
        if (orangePath) {
          orangeStarsCount++;
        }
      }

      // Валидация: рейтинг должен быть от 1 до 5
      if (orangeStarsCount >= 1 && orangeStarsCount <= 5) {
        return orangeStarsCount;
      }

      return null;
    } catch (error) {
      console.error('[WBUtils] Ошибка при извлечении рейтинга:', error);
      return null;
    }
  }

  /**
   * Очистить состояние модального окна (закрыть, если открыто)
   */
  function clearModalState(modal) {
    if (!modal) return;

    // Ищем кнопку закрытия
    const closeButton = modal.querySelector('[class*="close"], [aria-label="Close"], button[type="button"]');
    if (closeButton) {
      closeButton.click();
    } else {
      // Если нет кнопки закрытия, кликаем по overlay
      const overlay = document.querySelector('[class*="overlay"], [class*="backdrop"]');
      if (overlay) {
        overlay.click();
      } else {
        // Последний способ - ESC
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 }));
      }
    }
  }

  // ========================================================================
  // УТИЛИТЫ ДЛЯ ПОИСКА ЭЛЕМЕНТОВ WB
  // ========================================================================

  /**
   * Поиск поля поиска по артикулу (синхронная версия)
   * @param {boolean} verbose - Выводить ли подробные логи
   */
  function findSearchInputSync(verbose = false) {
    if (verbose) console.log('[WBUtils] Начинаем поиск поля ввода поиска...');

    // Способ 1: По placeholder
    let input = document.querySelector('input[placeholder*="Поиск"], input[placeholder*="поиск"]');
    if (input) {
      if (verbose) console.log('[WBUtils] ✅ Найдено по placeholder:', input);
      return input;
    }

    // Способ 2: По type="search"
    input = document.querySelector('input[type="search"]');
    if (input) {
      if (verbose) console.log('[WBUtils] ✅ Найдено по type=search:', input);
      return input;
    }

    // Способ 3: По классу с "search" или "Search"
    input = document.querySelector('input[class*="search" i], input[class*="Search"]');
    if (input) {
      if (verbose) console.log('[WBUtils] ✅ Найдено по классу search:', input);
      return input;
    }

    // Способ 4: Первый видимый input type="text"
    const textInputs = document.querySelectorAll('input[type="text"]');
    for (const inp of textInputs) {
      const style = getComputedStyle(inp);
      if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
        if (verbose) console.log('[WBUtils] ✅ Найдено первое видимое поле text:', inp);
        return inp;
      }
    }

    if (verbose) console.log('[WBUtils] ❌ Поле поиска НЕ найдено');
    return null;
  }

  /**
   * Поиск поля поиска (асинхронная версия с ожиданием)
   */
  async function findSearchInput(timeout = 5000) {
    try {
      return await waitForElement('input[placeholder*="Поиск"], input[type="search"]', { timeout });
    } catch {
      return findSearchInputSync(false);
    }
  }

  /**
   * Поиск кнопки "Следующая страница"
   *
   * ВАЖНО (февраль 2026): WB имеет 4 кнопки пагинации:
   * [0] - ◀◀ В начало (двойная стрелка влево)
   * [1] - ◀ Предыдущая (одна стрелка влево)
   * [2] - ▶ Следующая (одна стрелка вправо)  <-- ИНДЕКС 2!
   * [3] - ▶▶ В конец (двойная стрелка вправо)
   *
   * Проверено консольным тестом 01.02.2026
   * HTML: docs/HTML/Пагинация.html
   *
   * @param {boolean} verbose - Выводить ли подробные логи
   * @returns {HTMLButtonElement|null} - кнопка "Следующая страница" или null
   */
  function findNextPageButton(verbose = false) {
    if (verbose) console.log('[WBUtils] Ищем кнопку следующей страницы...');

    // Ищем все кнопки пагинации по классу Token-pagination__arrow
    const paginationButtons = document.querySelectorAll('[class*="Token-pagination__arrow"]');

    if (verbose) {
      console.log(`[WBUtils] Найдено ${paginationButtons.length} кнопок пагинации`);
    }

    // Проверяем что найдены все 5 кнопок (WB добавил 5-ю кнопку 04.02.2026)
    if (paginationButtons.length < 5) {
      if (verbose) console.log(`[WBUtils] ❌ Найдено ${paginationButtons.length} кнопок пагинации, ожидалось 5`);
      return null;
    }

    // Логируем все кнопки для диагностики
    if (verbose) {
      const buttonLabels = ['В начало ◀◀', 'Предыдущая ◀', '??? (новая)', 'Следующая ▶', 'В конец ▶▶'];
      paginationButtons.forEach((btn, index) => {
        const isDisabled = btn.disabled || btn.hasAttribute('disabled');
        console.log(`[WBUtils] Кнопка [${index}] "${buttonLabels[index] || '?'}": disabled=${isDisabled}`);
      });
    }

    // ✅ ФИКСИРОВАННАЯ ПОЗИЦИЯ: кнопка "Следующая" на индексе [3]
    // Обновлено 04.02.2026 - WB добавил 5-ю кнопку, индекс сместился с [2] на [3]
    const nextButton = paginationButtons[3];

    if (!nextButton) {
      if (verbose) console.log('[WBUtils] ❌ Кнопка с индексом [3] не найдена');
      return null;
    }

    // Проверяем что кнопка НЕ disabled (если disabled - это последняя страница)
    const isDisabled = nextButton.disabled || nextButton.hasAttribute('disabled');

    if (verbose) {
      if (isDisabled) {
        console.log('[WBUtils] ⚠️ Кнопка "Следующая страница" [3] найдена, но disabled (последняя страница)');
      } else {
        console.log('[WBUtils] ✅ Кнопка "Следующая страница" [3] найдена и активна');
      }
    }

    return nextButton;
  }

  /**
   * Проверить, можно ли перейти на следующую страницу
   */
  function canGoToNextPage(button) {
    if (!button) return false;
    return !button.disabled && !button.hasAttribute('disabled');
  }

  // ========================================================================
  // УТИЛИТЫ ДЛЯ ПАУЗЫ
  // ========================================================================

  let isPaused = false;
  let pauseButton = null;

  /**
   * Создать кнопку паузы
   */
  function createPauseButton() {
    if (pauseButton) return; // Уже создана

    pauseButton = document.createElement('button');
    pauseButton.id = 'wbPauseButton';
    pauseButton.textContent = '⏸ Пауза';

    Object.assign(pauseButton.style, {
      position: 'fixed',
      bottom: '120px',
      right: '20px',
      zIndex: '999999',
      padding: '10px 16px',
      borderRadius: '10px',
      background: '#ffc107',
      color: '#000',
      fontSize: '15px',
      fontWeight: 'bold',
      border: 'none',
      cursor: 'pointer',
      boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
    });

    pauseButton.onclick = () => {
      isPaused = !isPaused;
      if (isPaused) {
        pauseButton.textContent = '▶️ Продолжить';
        pauseButton.style.background = '#28a745';
        pauseButton.style.color = '#fff';
        console.log('⏸️ Обработка приостановлена');
      } else {
        pauseButton.textContent = '⏸ Пауза';
        pauseButton.style.background = '#ffc107';
        pauseButton.style.color = '#000';
        console.log('▶️ Обработка возобновлена');
      }
    };

    document.body.appendChild(pauseButton);
  }

  /**
   * Ожидание пока пауза не будет снята
   */
  async function waitWhilePaused() {
    while (isPaused) {
      await sleep(500);
    }
  }

  // ========================================================================
  // ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
  // ========================================================================

  window.WBUtils = {
    // DOM утилиты
    setNativeValue,
    clearInput,
    sleep,
    clickElement,
    clickElementForced,
    waitForElement,
    getIdFromRow,
    getReviewDateFromRow,
    getReviewRatingFromRow,
    clearModalState,

    // Поиск элементов WB
    findSearchInput,
    findSearchInputSync,
    findNextPageButton,
    canGoToNextPage,

    // Утилиты паузы
    createPauseButton,
    waitWhilePaused
  };

console.log('[WBUtils] Утилиты успешно загружены');
