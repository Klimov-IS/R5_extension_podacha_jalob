/**
 * Обработчик UI для страницы подачи жалоб
 * Управление отображением статистики, прогресса, результатов
 *
 * @version 1.0.0
 */

import { complaintsLogger } from '../services/complaints-logger-service.js';

/**
 * Обработчик для управления UI
 */
export class ComplaintsUIHandler {
  constructor() {
    this.elements = null;
  }

  /**
   * Инициализация DOM элементов
   * @param {Object} elements - Объект с DOM элементами
   */
  initializeElements(elements) {
    this.elements = elements;
  }

  /**
   * Показ превью статистики перед запуском
   * @param {Array} filteredComplaints - Отфильтрованные жалобы
   * @param {Object} articleStats - Статистика по артикулам
   * @param {boolean} isFilterByArticles - Фильтр по артикулам включен?
   * @param {Array<number>} checkedStars - Выбранные звезды
   */
  showPreviewStats(filteredComplaints, articleStats, isFilterByArticles, checkedStars) {
    if (!this.elements) {
      console.error('[UIHandler] ❌ Elements не инициализированы');
      return;
    }

    const totalComplaints = filteredComplaints.length;

    // Генерация HTML для превью
    let html = `
      <div class="preview-stats">
        <h3>📊 Статистика жалоб</h3>

        <div class="stat-row">
          <span class="stat-label">Всего жалоб для обработки:</span>
          <span class="stat-value">${totalComplaints}</span>
        </div>

        <div class="stat-row">
          <span class="stat-label">Выбранные звезды:</span>
          <span class="stat-value">${checkedStars.join(', ')}</span>
        </div>
    `;

    // Статистика по артикулам
    if (isFilterByArticles && Object.keys(articleStats).length > 0) {
      html += `
        <div class="stat-row">
          <span class="stat-label">Фильтр по артикулам:</span>
          <span class="stat-value">✅ Включен</span>
        </div>

        <div class="article-stats">
          <h4>Распределение по артикулам:</h4>
          <table class="stats-table">
            <thead>
              <tr>
                <th>Артикул</th>
                <th>Количество жалоб</th>
              </tr>
            </thead>
            <tbody>
      `;

      Object.entries(articleStats).forEach(([articleId, count]) => {
        html += `
          <tr>
            <td>${articleId}</td>
            <td>${count}</td>
          </tr>
        `;
      });

      html += `
            </tbody>
          </table>
        </div>
      `;
    } else {
      html += `
        <div class="stat-row">
          <span class="stat-label">Фильтр по артикулам:</span>
          <span class="stat-value">❌ Выключен (все артикулы)</span>
        </div>
      `;
    }

    html += `
        <div class="preview-actions">
          <p class="preview-note">⚠️ После подтверждения начнется автоматическая обработка жалоб</p>
        </div>
      </div>
    `;

    this.elements.apiStatsContent.innerHTML = html;
    this.elements.apiStatsPreview.classList.remove('hidden');
    this.elements.btnStartComplaints.classList.add('hidden');

    complaintsLogger.info(`📊 Готово к обработке: ${totalComplaints} жалоб`);
  }

  /**
   * Скрытие превью статистики
   */
  hidePreviewStats() {
    if (!this.elements) return;

    this.elements.apiStatsPreview.classList.add('hidden');
    this.elements.btnStartComplaints.classList.remove('hidden');
  }

  /**
   * Обновление прогресса обработки
   * @param {Object} stats - Статистика обработки
   */
  updateProgress(stats) {
    if (!this.elements) return;

    const {
      batchNumber,
      processed,
      sent,
      notFound,
      errors,
      totalProcessed,
      totalSent
    } = stats;

    const html = `
      <div class="progress-info">
        <h3>⏳ Обработка жалоб</h3>

        <div class="batch-info">
          <p><strong>Батч #${batchNumber}</strong></p>
        </div>

        <div class="progress-stats">
          <div class="stat-item">
            <span class="stat-label">Обработано в батче:</span>
            <span class="stat-value">${processed}</span>
          </div>

          <div class="stat-item">
            <span class="stat-label">Отправлено:</span>
            <span class="stat-value success">${sent}</span>
          </div>

          <div class="stat-item">
            <span class="stat-label">Не найдено:</span>
            <span class="stat-value warning">${notFound}</span>
          </div>

          <div class="stat-item">
            <span class="stat-label">Ошибки:</span>
            <span class="stat-value error">${errors}</span>
          </div>
        </div>

        <div class="total-stats">
          <h4>Всего за сессию:</h4>
          <div class="stat-item">
            <span class="stat-label">Обработано:</span>
            <span class="stat-value">${totalProcessed}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Отправлено:</span>
            <span class="stat-value success">${totalSent}</span>
          </div>
        </div>
      </div>
    `;

    this.elements.complaintsProgress.innerHTML = html;
    this.elements.complaintsProgress.classList.remove('hidden');
  }

  /**
   * Показ финальных результатов
   * @param {Object} results - Финальные результаты
   */
  showResults(results) {
    if (!this.elements) return;

    const {
      totalBatches,
      totalProcessed,
      totalSent,
      totalNotFound,
      totalErrors,
      duration,
      batchesHistory
    } = results;

    const durationMinutes = Math.floor(duration / 60);
    const durationSeconds = duration % 60;

    let html = `
      <div class="final-results">
        <h3>✅ Обработка завершена</h3>

        <div class="result-stats">
          <div class="stat-card">
            <div class="stat-icon">📦</div>
            <div class="stat-info">
              <span class="stat-label">Обработано батчей</span>
              <span class="stat-value">${totalBatches}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">📝</div>
            <div class="stat-info">
              <span class="stat-label">Всего обработано</span>
              <span class="stat-value">${totalProcessed}</span>
            </div>
          </div>

          <div class="stat-card success">
            <div class="stat-icon">✅</div>
            <div class="stat-info">
              <span class="stat-label">Отправлено</span>
              <span class="stat-value">${totalSent}</span>
            </div>
          </div>

          <div class="stat-card warning">
            <div class="stat-icon">⚠️</div>
            <div class="stat-info">
              <span class="stat-label">Не найдено</span>
              <span class="stat-value">${totalNotFound}</span>
            </div>
          </div>

          <div class="stat-card error">
            <div class="stat-icon">❌</div>
            <div class="stat-info">
              <span class="stat-label">Ошибки</span>
              <span class="stat-value">${totalErrors}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">⏱️</div>
            <div class="stat-info">
              <span class="stat-label">Время обработки</span>
              <span class="stat-value">${durationMinutes}м ${durationSeconds}с</span>
            </div>
          </div>
        </div>
    `;

    // История батчей
    if (batchesHistory && batchesHistory.length > 0) {
      html += `
        <div class="batches-history">
          <h4>📊 История батчей:</h4>
          <table class="batches-table">
            <thead>
              <tr>
                <th>Батч</th>
                <th>Обработано</th>
                <th>Отправлено</th>
                <th>Не найдено</th>
                <th>Ошибки</th>
              </tr>
            </thead>
            <tbody>
      `;

      batchesHistory.forEach(batch => {
        html += `
          <tr>
            <td>#${batch.batchNumber}</td>
            <td>${batch.processed}</td>
            <td class="success">${batch.sent}</td>
            <td class="warning">${batch.notFound}</td>
            <td class="error">${batch.errors}</td>
          </tr>
        `;
      });

      html += `
            </tbody>
          </table>
        </div>
      `;
    }

    html += `
      </div>
    `;

    this.elements.complaintsResults.innerHTML = html;
    this.elements.complaintsResults.classList.remove('hidden');
    this.elements.complaintsProgress.classList.add('hidden');

    // Показываем кнопки
    this.elements.btnDownloadResults.classList.remove('hidden');
    this.elements.btnNewComplaints.classList.remove('hidden');

    complaintsLogger.success(`✅ Обработка завершена! Отправлено: ${totalSent}/${totalProcessed}`);
  }

  /**
   * Сброс UI для новой обработки
   */
  resetUI() {
    if (!this.elements) return;

    this.elements.complaintsProgress.classList.add('hidden');
    this.elements.complaintsResults.classList.add('hidden');
    this.elements.apiStatsPreview.classList.add('hidden');
    this.elements.btnStartComplaints.classList.remove('hidden');
    this.elements.btnDownloadResults.classList.add('hidden');
    this.elements.btnNewComplaints.classList.add('hidden');

    complaintsLogger.info('🔄 UI сброшен для новой обработки');
  }
}

/**
 * Singleton экземпляр UI handler
 */
export const complaintsUIHandler = new ComplaintsUIHandler();
