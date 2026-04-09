/**
 * Dashboard — R5 Rating5 Main UI (Variant C: Sidebar Layout)
 *
 * Replaces diagnostic.js with sidebar-based store management.
 * Migrates all business logic: multi-round task processing, stall detection,
 * preview accordion, reparse, and adds: search, filter, sort, chatFeatureActive,
 * expandable reviews with complaint drafts, marketing upsell.
 *
 * @version 5.0.0
 * @since 2026-04-09
 */

'use strict';

// ========================================================================
// CONSTANTS
// ========================================================================

const MAX_ROUNDS_SAFETY = 50;

// ========================================================================
// STALL DETECTION HELPERS
// ========================================================================

function extractTaskKeys(tasks) {
  const keys = new Set();
  const articles = tasks.articles || {};
  for (const [articleId, articleTasks] of Object.entries(articles)) {
    for (const ch of (articleTasks.chatOpens || [])) {
      keys.add(`ch:${ch.reviewKey}`);
    }
    for (const c of (articleTasks.complaints || [])) {
      keys.add(`co:${c.reviewKey}`);
    }
  }
  return keys;
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

// ========================================================================
// HELPERS
// ========================================================================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function pluralize(n, one, few, many) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

function renderStars(rating) {
  let s = '';
  for (let i = 1; i <= 5; i++) {
    s += `<span class="star ${i <= rating ? '' : 'empty'}">&#9733;</span>`;
  }
  return s;
}

// ========================================================================
// DOM REFERENCES
// ========================================================================

const filterHideEmpty = document.getElementById('filter-hide-empty');
const filterSort = document.getElementById('filter-sort');
const filterCount = document.getElementById('filter-count');
const storeSearch = document.getElementById('store-search');
const storeListEl = document.getElementById('store-list');
const emptyState = document.getElementById('empty-state');
const storeDetailEl = document.getElementById('store-detail');

// ========================================================================
// STATE
// ========================================================================

let stores = [];
let selectedStore = null;
let loadedTasks = null;
let currentStoreId = null;
let isProcessing = false;

// ========================================================================
// INITIALIZATION
// ========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await loadStores();
});

// ========================================================================
// STORE LOADING
// ========================================================================

async function loadStores(forceRefresh = false) {
  try {
    storeListEl.innerHTML = '<div class="store-list-loading">Загрузка магазинов...</div>';

    const response = await chrome.runtime.sendMessage({
      type: 'getStores',
      forceRefresh
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Не удалось загрузить магазины');
    }

    stores = (response.data || []).filter(s => s.isActive);
    renderStoreList();

  } catch (error) {
    console.error('[Dashboard] Store loading error:', error);
    storeListEl.innerHTML = `<div class="store-list-empty">Ошибка: ${escapeHtml(error.message)}</div>`;
  }
}

// ========================================================================
// STORE LIST RENDERING (SIDEBAR)
// ========================================================================

function getFilteredStores() {
  const hideEmpty = filterHideEmpty.checked;
  const sort = filterSort.value;
  const search = (storeSearch.value || '').trim().toLowerCase();

  let filtered = stores.slice();
  if (search) filtered = filtered.filter(s => s.name.toLowerCase().includes(search));
  if (hideEmpty) filtered = filtered.filter(s => (s.draftComplaintsCount || 0) + (s.pendingChatsCount || 0) > 0);

  filtered.sort((a, b) => {
    const tA = (a.draftComplaintsCount || 0) + (a.pendingChatsCount || 0);
    const tB = (b.draftComplaintsCount || 0) + (b.pendingChatsCount || 0);
    if (sort === 'tasks-desc') return tB - tA;
    if (sort === 'tasks-asc') return tA - tB;
    return a.name.localeCompare(b.name);
  });
  return filtered;
}

function renderStoreList() {
  const filtered = getFilteredStores();

  filterCount.textContent = `${filtered.length} из ${stores.length}`;

  if (filtered.length === 0) {
    storeListEl.innerHTML = '<div class="store-list-empty">Нет магазинов с задачами</div>';
    return;
  }

  storeListEl.innerHTML = '';
  filtered.forEach(s => {
    const total = (s.draftComplaintsCount || 0) + (s.pendingChatsCount || 0);
    const item = document.createElement('div');
    item.className = `store-item${total === 0 ? ' no-tasks' : ''}${selectedStore?.id === s.id ? ' selected' : ''}`;
    item.dataset.storeId = s.id;

    let badges = '';
    if ((s.draftComplaintsCount || 0) > 0) {
      badges += `<span class="store-item-badge badge-complaints">${s.draftComplaintsCount} жалоб</span>`;
    }
    if ((s.pendingChatsCount || 0) > 0) {
      badges += `<span class="store-item-badge badge-chats">${s.pendingChatsCount} чатов</span>`;
    }
    const potTotal = (s.potentialChatsNeg || 0) + (s.potentialChats4 || 0);
    if (s.chatFeatureActive === false && potTotal > 0) {
      badges += `<span class="store-item-badge badge-chat-off">+${potTotal} чатов</span>`;
    }

    item.innerHTML = `
      <div class="store-item-header">
        <span class="store-item-name">${escapeHtml(s.name)}</span>
        <span class="store-item-total ${total === 0 ? 'zero' : ''}">${total}</span>
      </div>
      <div class="store-item-meta">${badges}</div>
    `;
    storeListEl.appendChild(item);
  });
}

// Store list click handler (delegation)
storeListEl.addEventListener('click', (e) => {
  if (isProcessing) return;
  const item = e.target.closest('.store-item');
  if (!item) return;
  const storeId = item.dataset.storeId;
  const store = stores.find(s => s.id === storeId);
  if (store) selectStore(store);
});

// Filter/sort/search handlers
filterHideEmpty.addEventListener('change', renderStoreList);
filterSort.addEventListener('change', renderStoreList);
storeSearch.addEventListener('input', renderStoreList);

// ========================================================================
// STORE SELECTION
// ========================================================================

async function selectStore(store) {
  selectedStore = store;
  currentStoreId = store.id;
  loadedTasks = null;

  // Save to storage for API usage
  await chrome.storage.local.set({ currentStoreId: store.id });

  // Update sidebar highlight
  renderStoreList();

  // Show detail, hide empty state
  emptyState.style.display = 'none';
  storeDetailEl.classList.add('active');

  // Render detail view
  renderStoreDetail(store);

  // Auto-fetch tasks
  await getTasks();
}

// ========================================================================
// STORE DETAIL RENDERING
// ========================================================================

function renderStoreDetail(store) {
  const complaints = store.draftComplaintsCount || 0;
  const chats = store.pendingChatsCount || 0;
  const total = complaints + chats;

  // Chat feature badge
  let chatBadgeHtml = '';
  if (store.chatFeatureActive === true) {
    chatBadgeHtml = '<span class="detail-chat-badge on">Чаты подключены</span>';
  } else if (store.chatFeatureActive === false) {
    chatBadgeHtml = '<span class="detail-chat-badge off">Чаты не подключены</span>';
  }

  storeDetailEl.innerHTML = `
    <div class="detail-header fade-in">
      <div>
        <h2>${escapeHtml(store.name)}</h2>
        <div class="detail-header-badges">${chatBadgeHtml}</div>
      </div>
      <div class="detail-header-actions">
        <button class="btn btn-secondary btn-sm" id="btn-refresh-tasks">Обновить</button>
        <button class="btn btn-secondary btn-sm" id="btn-reparse">Перепарсить</button>
      </div>
    </div>

    <!-- Error -->
    <div class="detail-error" id="detail-error">
      <span class="detail-error-text" id="detail-error-text"></span>
    </div>

    <!-- Stats -->
    <div class="stats-row fade-in" id="stats-row">
      <div class="stat-card">
        <div class="stat-card-value purple" id="stat-complaints">${complaints}</div>
        <div class="stat-card-label">Жалобы</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-value blue" id="stat-chats">${chats}</div>
        <div class="stat-card-label">Чаты</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-value dark" id="stat-total">${total}</div>
        <div class="stat-card-label">Всего задач</div>
      </div>
    </div>

    <!-- Upsell placeholder -->
    <div class="chat-upsell" id="chat-upsell"></div>

    <!-- Task types & launch -->
    <div class="card fade-in" id="task-card" style="display:none;">
      <div class="card-title">Типы задач</div>
      <div class="task-type-row" id="row-complaints">
        <input type="checkbox" id="chk-complaints">
        <span class="task-type-name">Подача жалоб</span>
        <span class="task-type-count empty" id="count-complaints">0</span>
      </div>
      <div class="task-type-row" id="row-chats">
        <input type="checkbox" id="chk-chat-opens">
        <span class="task-type-name">Открытие чатов</span>
        <span class="task-type-count empty" id="count-chat-opens">0</span>
      </div>
      <div class="action-center">
        <button class="btn btn-primary btn-large" id="btn-launch" disabled>Нет задач</button>
      </div>
      <div class="progress-section" id="progress-section">
        <div class="progress-bar-bg">
          <div class="progress-bar" id="progress-bar"></div>
        </div>
        <div class="progress-text" id="progress-text"></div>
        <div class="progress-details" id="progress-details">
          <span><span class="pdot ok"></span>Успешно: <span id="pdot-ok">0</span></span>
          <span><span class="pdot nf"></span>Не найдено: <span id="pdot-nf">0</span></span>
          <span><span class="pdot err"></span>Ошибки: <span id="pdot-err">0</span></span>
        </div>
      </div>
    </div>

    <!-- Preview -->
    <div class="card fade-in" id="preview-card" style="display:none;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <span class="card-title" style="margin-bottom:0;">Превью задач</span>
        <span class="card-subtitle" id="preview-subtitle"></span>
      </div>
      <div id="preview-accordion"></div>
    </div>
  `;

  // Bind detail event handlers
  bindDetailEvents();

  // Render upsell if applicable
  renderUpsell(store);
}

function bindDetailEvents() {
  // Refresh button
  const btnRefresh = document.getElementById('btn-refresh-tasks');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      if (!isProcessing) getTasks();
    });
  }

  // Reparse button
  const btnReparse = document.getElementById('btn-reparse');
  if (btnReparse) {
    btnReparse.addEventListener('click', () => {
      if (!isProcessing) reparseStore();
    });
  }

  // Launch button
  const btnLaunch = document.getElementById('btn-launch');
  if (btnLaunch) {
    btnLaunch.addEventListener('click', () => {
      if (!isProcessing) submitTasks();
    });
  }

  // Task type checkboxes
  const chkComplaints = document.getElementById('chk-complaints');
  const chkChatOpens = document.getElementById('chk-chat-opens');
  if (chkComplaints) chkComplaints.addEventListener('change', updateSelectedCount);
  if (chkChatOpens) chkChatOpens.addEventListener('change', updateSelectedCount);

  // Task type row click → toggle checkbox
  const rowComplaints = document.getElementById('row-complaints');
  const rowChats = document.getElementById('row-chats');
  if (rowComplaints) {
    rowComplaints.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || rowComplaints.classList.contains('disabled')) return;
      chkComplaints.checked = !chkComplaints.checked;
      updateSelectedCount();
    });
  }
  if (rowChats) {
    rowChats.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || rowChats.classList.contains('disabled')) return;
      chkChatOpens.checked = !chkChatOpens.checked;
      updateSelectedCount();
    });
  }
}

// ========================================================================
// MARKETING UPSELL
// ========================================================================

function renderUpsell(store) {
  const upsellEl = document.getElementById('chat-upsell');
  if (!upsellEl) return;

  // Show when chats not active (regardless of potential counts)
  if (store.chatFeatureActive !== false) {
    upsellEl.classList.remove('active');
    return;
  }

  const potNeg = store.potentialChatsNeg || 0;
  const pot4 = store.potentialChats4 || 0;
  const potTotal = potNeg + pot4;

  // Build copyable message — with or without specific counts
  const msgLines = [];
  const htmlLines = [];
  if (potNeg > 0) {
    msgLines.push(`- ${potNeg} ${pluralize(potNeg, 'негативный отзыв', 'негативных отзыва', 'негативных отзывов')} (1-3 звезды) — можно связаться с покупателем, уточнить ситуацию и предложить варианты`);
    htmlLines.push(`&mdash; <b>${potNeg}</b> ${pluralize(potNeg, 'негативный отзыв', 'негативных отзыва', 'негативных отзывов')} (1-3 звезды) &mdash; можно связаться с покупателем, уточнить ситуацию и предложить варианты`);
  }
  if (pot4 > 0) {
    msgLines.push(`- ${pot4} ${pluralize(pot4, 'отзыв', 'отзыва', 'отзывов')} на 4 звезды — можно уточнить у покупателя, что можно улучшить, и собрать полезную обратную связь по товару`);
    htmlLines.push(`&mdash; <b>${pot4}</b> ${pluralize(pot4, 'отзыв', 'отзыва', 'отзывов')} на 4 звезды &mdash; можно уточнить у покупателя, что можно улучшить, и собрать полезную обратную связь по товару`);
  }

  const storeName = escapeHtml(store.name);

  // Message body: detailed (with counts) or generic (without)
  let msgBody, htmlBody;
  if (potTotal > 0) {
    msgBody = `По магазину "${store.name}" сейчас есть отзывы, которые можно отработать через чаты:\n\n${msgLines.join('\n')}\n\nЧаты помогают повысить лояльность покупателей, снизить процент возвратов и получить ценную обратную связь для улучшения карточек.`;
    htmlBody = `По магазину <b>"${storeName}"</b> сейчас есть отзывы, которые можно отработать через чаты:<br><br>${htmlLines.join('<br>')}<br><br>Чаты помогают повысить лояльность покупателей, снизить процент возвратов и получить ценную обратную связь для улучшения карточек.`;
  } else {
    msgBody = `По магазину "${store.name}" функция "Чаты с покупателями отзывов" не подключена.\n\nЧаты помогают повысить лояльность покупателей, снизить процент возвратов и получить ценную обратную связь для улучшения карточек.`;
    htmlBody = `По магазину <b>"${storeName}"</b> функция "Чаты с покупателями отзывов" не подключена.<br><br>Чаты помогают повысить лояльность покупателей, снизить процент возвратов и получить ценную обратную связь для улучшения карточек.`;
  }

  const copyText = `Добрый день!\n\n${msgBody}\n\nДля запуска необходимо активировать функцию "Чаты с покупателями отзывов" в личном кабинете WB: Отзывы и вопросы → Настройки. После активации мы сможем приступить к работе.`;

  upsellEl.innerHTML = `
    <button class="chat-upsell-dismiss" id="upsell-dismiss" title="Скрыть">&times;</button>
    <div class="chat-upsell-header">
      <div class="chat-upsell-icon">&#128172;</div>
      <div>
        <div class="chat-upsell-title">Чаты с покупателями не подключены</div>
        <div class="chat-upsell-subtitle">Готовое сообщение для клиента</div>
      </div>
    </div>
    <div class="chat-upsell-message">Добрый день!<br><br>${htmlBody}<br><br>Для запуска необходимо активировать функцию <b>"Чаты с покупателями отзывов"</b> в личном кабинете WB: Отзывы и вопросы &rarr; Настройки. После активации мы сможем приступить к работе.</div>
    <button class="chat-upsell-copy" id="upsell-copy-btn">Скопировать сообщение</button>
  `;
  upsellEl.classList.add('active', 'fade-in');

  // Store plain text for copy
  upsellEl.dataset.copyText = copyText;

  // Dismiss handler
  document.getElementById('upsell-dismiss').addEventListener('click', () => {
    upsellEl.classList.remove('active');
  });

  // Copy handler
  document.getElementById('upsell-copy-btn').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    navigator.clipboard.writeText(copyText).then(() => {
      btn.classList.add('copied');
      btn.textContent = 'Скопировано!';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.textContent = 'Скопировать сообщение';
      }, 2000);
    }).catch(() => {
      // Fallback: select text
      const msgEl = upsellEl.querySelector('.chat-upsell-message');
      if (msgEl) {
        const range = document.createRange();
        range.selectNodeContents(msgEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
  });
}

// ========================================================================
// TASK TYPE SELECTION
// ========================================================================

function getEnabledTaskTypes() {
  const types = [];
  const chkChatOpens = document.getElementById('chk-chat-opens');
  const chkComplaints = document.getElementById('chk-complaints');
  if (chkChatOpens && chkChatOpens.checked) types.push('chatOpens');
  if (chkComplaints && chkComplaints.checked) types.push('complaints');
  return types;
}

function updateSelectedCount() {
  if (!loadedTasks) return;
  const tc = loadedTasks.totalCounts || loadedTasks.totals || {};
  const chkChatOpens = document.getElementById('chk-chat-opens');
  const chkComplaints = document.getElementById('chk-complaints');
  const btnLaunch = document.getElementById('btn-launch');

  let total = 0;
  if (chkChatOpens && chkChatOpens.checked) total += tc.chatOpens || 0;
  if (chkComplaints && chkComplaints.checked) total += tc.complaints || 0;

  if (btnLaunch) {
    btnLaunch.disabled = total === 0;
    btnLaunch.textContent = total > 0
      ? `Запустить (${total} ${pluralize(total, 'задача', 'задачи', 'задач')})`
      : 'Нет задач';
  }
}

// ========================================================================
// TASK FETCHING
// ========================================================================

async function getTasks() {
  if (!currentStoreId) return;

  const btnRefresh = document.getElementById('btn-refresh-tasks');
  if (btnRefresh) {
    btnRefresh.disabled = true;
    btnRefresh.textContent = '⏳...';
  }
  hideDetailError();

  try {
    const apiResponse = await chrome.runtime.sendMessage({
      type: 'getTasks',
      storeId: currentStoreId
    });

    if (!apiResponse || apiResponse.error) {
      throw new Error(apiResponse?.error || 'Не удалось получить задачи от API');
    }

    loadedTasks = apiResponse.data;

    const totals = loadedTasks.totals || {};
    const tc = loadedTasks.totalCounts || totals;
    const totalCount = (tc.chatOpens || 0) + (tc.complaints || 0);

    // Update stats cards
    const statComplaints = document.getElementById('stat-complaints');
    const statChats = document.getElementById('stat-chats');
    const statTotal = document.getElementById('stat-total');
    if (statComplaints) statComplaints.textContent = tc.complaints || 0;
    if (statChats) statChats.textContent = tc.chatOpens || 0;
    if (statTotal) statTotal.textContent = totalCount;

    // Task type card
    const taskCard = document.getElementById('task-card');
    const countComplaints = document.getElementById('count-complaints');
    const countChatOpens = document.getElementById('count-chat-opens');
    const chkComplaints = document.getElementById('chk-complaints');
    const chkChatOpens = document.getElementById('chk-chat-opens');
    const rowComplaints = document.getElementById('row-complaints');
    const rowChats = document.getElementById('row-chats');

    if (totalCount === 0) {
      if (taskCard) taskCard.style.display = 'none';
      const previewCard = document.getElementById('preview-card');
      if (previewCard) previewCard.style.display = 'none';
      return;
    }

    // Show task card
    if (taskCard) taskCard.style.display = '';

    // Update counts
    if (countComplaints) {
      countComplaints.textContent = tc.complaints || 0;
      countComplaints.className = `task-type-count ${(tc.complaints || 0) > 0 ? 'has' : 'empty'}`;
    }
    if (countChatOpens) {
      countChatOpens.textContent = tc.chatOpens || 0;
      countChatOpens.className = `task-type-count ${(tc.chatOpens || 0) > 0 ? 'has' : 'empty'}`;
    }

    // Enable/disable checkboxes
    if (chkComplaints) {
      chkComplaints.disabled = !(tc.complaints > 0);
      chkComplaints.checked = tc.complaints > 0;
    }
    if (chkChatOpens) {
      chkChatOpens.disabled = !(tc.chatOpens > 0);
      chkChatOpens.checked = tc.chatOpens > 0;
    }
    if (rowComplaints) rowComplaints.classList.toggle('disabled', !(tc.complaints > 0));
    if (rowChats) rowChats.classList.toggle('disabled', !(tc.chatOpens > 0));

    // Update launch button
    updateSelectedCount();

    // Show preview
    showPreview(loadedTasks);

  } catch (error) {
    console.error('[Dashboard] getTasks error:', error);
    showDetailError(error.message);
  } finally {
    if (btnRefresh) {
      btnRefresh.disabled = false;
      btnRefresh.textContent = 'Обновить';
    }
  }
}

// ========================================================================
// REPARSE STORE
// ========================================================================

async function reparseStore() {
  if (!currentStoreId || !selectedStore) return;

  if (!confirm(`Перепарсить кабинет?\n\n${selectedStore.name}\n\nВсе статусы отзывов будут сброшены и отправлены на повторный парсинг.\n\nПродолжить?`)) return;

  const btnReparse = document.getElementById('btn-reparse');
  const btnRefresh = document.getElementById('btn-refresh-tasks');
  const btnLaunch = document.getElementById('btn-launch');

  if (btnReparse) { btnReparse.disabled = true; btnReparse.textContent = '⏳ Сброс...'; }
  if (btnRefresh) btnRefresh.disabled = true;
  if (btnLaunch) btnLaunch.disabled = true;
  hideDetailError();

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'reparseStore',
      storeId: currentStoreId
    });

    if (!response || response.error) {
      if (response?.error?.startsWith('TOO_MANY_REVIEWS:')) {
        throw new Error('Слишком много отзывов (>2000). Обратитесь к менеджеру или используйте фильтр по артикулам.');
      }
      throw new Error(response?.error || 'Не удалось перепарсить кабинет');
    }

    const result = response.data?.data || response.data;
    const resetCount = result.reset || 0;
    console.log(`[Dashboard] Reparse: reset=${resetCount}, skipped=${result.skipped || 0}`);

    if (btnReparse) btnReparse.textContent = `✅ ${resetCount} в очереди`;
    await new Promise(r => setTimeout(r, 1500));

    // Auto-refresh tasks
    await getTasks();

  } catch (error) {
    console.error('[Dashboard] Reparse error:', error);
    showDetailError(error.message);
  } finally {
    if (btnReparse) { btnReparse.disabled = false; btnReparse.textContent = 'Перепарсить'; }
    if (btnRefresh) btnRefresh.disabled = false;
  }
}

// ========================================================================
// TASK SUBMISSION (MULTI-ROUND LOOP)
// ========================================================================

async function submitTasks() {
  if (!loadedTasks || !currentStoreId) {
    showDetailError('Сначала получите задачи');
    return;
  }

  const totals = loadedTasks.totals || {};
  const tc = loadedTasks.totalCounts || totals;
  const enabledTypes = getEnabledTaskTypes();

  // Confirmation dialog
  const typeLines = [];
  if (enabledTypes.includes('chatOpens')) typeLines.push(`  • Открытие чатов: ${tc.chatOpens || 0} (батч: ${totals.chatOpens || 0})`);
  if (enabledTypes.includes('complaints')) typeLines.push(`  • Подача жалоб: ${tc.complaints || 0} (батч: ${totals.complaints || 0})`);

  const confirmed = confirm(
    `ВНИМАНИЕ! РЕАЛЬНАЯ ОБРАБОТКА ЗАДАЧ!\n\n` +
    `Магазин: ${selectedStore.name}\n\n` +
    `Выбранные задачи (всего / первый батч):\n` +
    typeLines.join('\n') + `\n\n` +
    `Система будет запрашивать задачи порциями,\n` +
    `пока API не вернёт 0 задач (все обработаны).\n\n` +
    `Перед ПЕРВОЙ жалобой вы увидите заполненную форму для проверки.\n\n` +
    `Продолжить?`
  );

  if (!confirmed) return;

  // Lock UI
  isProcessing = true;
  const btnLaunch = document.getElementById('btn-launch');
  const btnRefresh = document.getElementById('btn-refresh-tasks');
  const btnReparse = document.getElementById('btn-reparse');

  if (btnLaunch) { btnLaunch.disabled = true; btnLaunch.textContent = '⏳ Обработка...'; }
  if (btnRefresh) btnRefresh.disabled = true;
  if (btnReparse) btnReparse.disabled = true;
  hideDetailError();

  // Clear preview (memory)
  const previewCard = document.getElementById('preview-card');
  const previewAccordion = document.getElementById('preview-accordion');
  if (previewCard) previewCard.style.display = 'none';
  if (previewAccordion) previewAccordion.innerHTML = '';

  showProgress('Поиск вкладки WB...');

  let overallStatus = 'COMPLETED';

  try {
    // 1. Find WB tab
    const tabs = await chrome.tabs.query({});
    const wbTab = tabs.find(tab =>
      tab.url &&
      tab.url.includes('seller.wildberries.ru') &&
      tab.url.includes('/feedbacks')
    );

    if (!wbTab) {
      throw new Error('Не найдена вкладка seller.wildberries.ru/feedbacks\n\nОткройте страницу отзывов WB и попробуйте снова.');
    }

    updateProgress(5, 'Проверка content script...');

    // 2. Ping content script
    try {
      await chrome.tabs.sendMessage(wbTab.id, { type: 'ping' });
    } catch (error) {
      throw new Error('Content script не готов!\n\nОбновите страницу WB (F5) и попробуйте снова.');
    }

    // ========================================================================
    // MULTI-ROUND LOOP
    // ========================================================================
    let round = 1;
    let previousTaskKeys = null;

    while (round <= MAX_ROUNDS_SAFETY) {
      updateProgress(10 + (round - 1) * 2, `Раунд ${round}: Получение задач...`);

      // 3. Fetch tasks
      const apiResponse = await chrome.runtime.sendMessage({
        type: 'getTasks',
        storeId: currentStoreId
      });

      if (!apiResponse || apiResponse.error) {
        console.error('[Dashboard] API error:', apiResponse?.error);
        overallStatus = 'ERROR: API failed';
        break;
      }

      const tasks = apiResponse.data;
      const roundTotals = tasks.totals || {};
      const roundTotal = (roundTotals.chatOpens || 0) + (roundTotals.complaints || 0);

      // Exit: 0 tasks
      if (roundTotal === 0) {
        overallStatus = 'SUCCESS: Все задачи обработаны';
        break;
      }

      // Stall detection
      const currentTaskKeys = extractTaskKeys(tasks);
      if (previousTaskKeys && setsEqual(currentTaskKeys, previousTaskKeys)) {
        console.warn(`[Dashboard] Round ${round}: tasks identical (${currentTaskKeys.size}). Stopping.`);
        overallStatus = `DONE: Оставшиеся ${currentTaskKeys.size} задач не найдены на площадке`;
        break;
      }
      previousTaskKeys = currentTaskKeys;

      updateProgress(
        15 + (round - 1) * 2,
        `Раунд ${round}: Обработка ${roundTotal} задач (чаты: ${roundTotals.chatOpens || 0}, жалобы: ${roundTotals.complaints || 0})...`
      );

      // 4. Send to WB tab
      const response = await chrome.tabs.sendMessage(wbTab.id, {
        type: 'runTaskWorkflow',
        tasks: tasks,
        storeId: currentStoreId,
        enabledTaskTypes: enabledTypes
      });

      if (!response.success) {
        console.error('[Dashboard] Processing error:', response.error);
        overallStatus = `ERROR: ${response.error || 'Processing failed'}`;
        break;
      }

      const roundReport = response.report;

      // Update progress dots
      updateProgressDots(roundReport);

      // Cancelled
      if (roundReport.cancelled) {
        overallStatus = 'CANCELLED: Прервано пользователем';
        break;
      }

      // Next round
      round++;

      if (round <= MAX_ROUNDS_SAFETY) {
        updateProgress(18 + (round - 2) * 2, `Пауза перед раундом ${round}...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Safety cap check
    if (round > MAX_ROUNDS_SAFETY && overallStatus === 'COMPLETED') {
      overallStatus = `WARNING: Достигнут safety-лимит ${MAX_ROUNDS_SAFETY} раундов`;
    }

    hideProgress();
    console.log(`[Dashboard] Finished: ${overallStatus}`);

  } catch (error) {
    console.error('[Dashboard] Error:', error);
    hideProgress();
    showDetailError(error.message);
  } finally {
    isProcessing = false;
    loadedTasks = null;

    if (btnLaunch) { btnLaunch.disabled = true; btnLaunch.textContent = 'Нет задач'; }
    if (btnRefresh) btnRefresh.disabled = false;
    if (btnReparse) btnReparse.disabled = false;

    // Refresh stores to update counts
    const selectedId = currentStoreId;
    await loadStores(true);
    // Re-select store to update detail view
    const updatedStore = stores.find(s => s.id === selectedId);
    if (updatedStore) {
      selectedStore = updatedStore;
      currentStoreId = updatedStore.id;
      renderStoreDetail(updatedStore);
      await getTasks();
    }
  }
}

// ========================================================================
// PROGRESS HELPERS
// ========================================================================

function showProgress(text) {
  const section = document.getElementById('progress-section');
  const bar = document.getElementById('progress-bar');
  const textEl = document.getElementById('progress-text');
  if (section) section.classList.add('active');
  if (bar) bar.style.width = '0%';
  if (textEl) textEl.textContent = text;
  // Reset dots
  const okEl = document.getElementById('pdot-ok');
  const nfEl = document.getElementById('pdot-nf');
  const errEl = document.getElementById('pdot-err');
  if (okEl) okEl.textContent = '0';
  if (nfEl) nfEl.textContent = '0';
  if (errEl) errEl.textContent = '0';
}

function updateProgress(percent, text) {
  const bar = document.getElementById('progress-bar');
  const textEl = document.getElementById('progress-text');
  if (bar) bar.style.width = `${percent}%`;
  if (text && textEl) textEl.textContent = text;
}

function updateProgressDots(report) {
  const okEl = document.getElementById('pdot-ok');
  const nfEl = document.getElementById('pdot-nf');
  const errEl = document.getElementById('pdot-err');
  if (!report) return;

  const ok = (report.complaintsSubmitted || 0) + (report.chatsOpened || 0);
  const nf = report.notFoundSent || 0;
  const err = (report.complaintsErrors || 0) + (report.chatErrors || 0);

  if (okEl) okEl.textContent = ok;
  if (nfEl) nfEl.textContent = nf;
  if (errEl) errEl.textContent = err;
}

function hideProgress() {
  const section = document.getElementById('progress-section');
  if (section) section.classList.remove('active');
}

// ========================================================================
// ERROR HELPERS
// ========================================================================

function showDetailError(message) {
  const el = document.getElementById('detail-error');
  const textEl = document.getElementById('detail-error-text');
  if (el && textEl) {
    textEl.textContent = message;
    el.classList.add('active');
  }
}

function hideDetailError() {
  const el = document.getElementById('detail-error');
  if (el) el.classList.remove('active');
}

// ========================================================================
// PREVIEW — ENHANCED WITH EXPANDABLE REVIEWS
// ========================================================================

function showPreview(tasks) {
  const articles = tasks.articles || {};
  const totals = tasks.totals || {};
  const previewCard = document.getElementById('preview-card');
  const previewAccordion = document.getElementById('preview-accordion');
  const previewSubtitle = document.getElementById('preview-subtitle');

  if (!previewCard || !previewAccordion) return;

  const articleIds = Object.keys(articles);
  let totalReviews = 0;
  let html = '';

  for (const articleId of articleIds) {
    const articleTasks = articles[articleId];
    const chatOpens = articleTasks.chatOpens || [];
    const complaints = articleTasks.complaints || [];
    const all = [
      ...complaints.map(c => ({ ...c, _type: 'complaint' })),
      ...chatOpens.map(c => ({ ...c, _type: 'chat' }))
    ];
    totalReviews += all.length;

    let badgesHtml = '';
    if (complaints.length > 0) badgesHtml += `<span class="accordion-count complaint-c">${complaints.length} жалоб</span>`;
    if (chatOpens.length > 0) badgesHtml += `<span class="accordion-count chat-c">${chatOpens.length} чатов</span>`;

    html += `
      <div class="accordion-item">
        <div class="accordion-header">
          <div class="accordion-header-left">
            <span class="accordion-article">${escapeHtml(articleId)}</span>
            <div class="accordion-badges">${badgesHtml}</div>
          </div>
          <span class="accordion-arrow">&#9660;</span>
        </div>
        <div class="accordion-content">
    `;

    all.forEach((r, idx) => {
      const reviewId = `review-${articleId}-${idx}`;
      const isComplaint = r._type === 'complaint';
      const typeLabel = isComplaint ? 'Жалоба' : (r.type === 'link' ? 'Привязка' : 'Чат');
      const typeClass = isComplaint ? 'type-complaint' : 'type-chat';
      const reasonName = isComplaint ? (r.reasonName || `Причина #${r.reasonId}`) : '';
      const reviewText = r.text || r.complaintText || '';
      const reviewDate = r.date || (r.reviewKey ? r.reviewKey.split('_').slice(2).join('_').substring(0, 10) : '');

      html += `
        <div class="review-item" data-review-id="${reviewId}">
          <div class="review-row">
            <span class="review-rating">${renderStars(r.rating || 0)}</span>
            <span class="review-date">${escapeHtml(reviewDate)}</span>
            <span class="review-type ${typeClass}">${typeLabel}</span>
            ${reasonName ? `<span class="review-category">${escapeHtml(reasonName)}</span>` : ''}
            <span class="review-expand-arrow">&#9660;</span>
          </div>
          <div class="review-detail">
            ${reviewText ? `<div class="review-text">${escapeHtml(reviewText)}</div>` : ''}
            ${isComplaint && r.complaintText ? `
              <div class="complaint-draft">
                <div class="complaint-draft-label">Жалоба к подаче</div>
                ${r.reasonName ? `<div class="complaint-draft-category">${escapeHtml(r.reasonName)}</div>` : ''}
                <div class="complaint-draft-text">${escapeHtml(r.complaintText)}</div>
              </div>
            ` : ''}
            <div class="review-meta">
              ${reasonName ? `<span>Категория: ${escapeHtml(reasonName)}</span>` : ''}
              <span>Рейтинг: ${r.rating || 0}/5</span>
            </div>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  }

  previewAccordion.innerHTML = html;
  if (previewSubtitle) previewSubtitle.textContent = `${articleIds.length} артикулов, ${totalReviews} задач`;
  previewCard.style.display = '';
}

// ========================================================================
// GLOBAL EVENT DELEGATION
// ========================================================================

document.addEventListener('click', (e) => {
  // Accordion toggle
  const header = e.target.closest('.accordion-header');
  if (header) {
    header.parentElement.classList.toggle('open');
    return;
  }

  // Review expand/collapse
  const reviewRow = e.target.closest('.review-row');
  if (reviewRow) {
    const reviewItem = reviewRow.parentElement;
    if (reviewItem) reviewItem.classList.toggle('expanded');
    return;
  }
});
