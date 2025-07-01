// Data Preview JavaScript - Basic Implementation

class DataPreview {
  constructor() {
    this.baseURL = '/api/data-preview';
    this.currentPage = 1;
    this.currentFilters = {};
    this.isLoading = false;
  }

  async init() {
    // Load filter options first
    await this.loadFilterOptions();
    
    // Load initial data
    await this.loadData();
    
    // Set up event listeners
    this.setupEventListeners();
  }

  async loadFilterOptions() {
    try {
      const response = await fetch(`${this.baseURL}/filter-options`);
      const options = await response.json();
      
      this.populateFilterDropdowns(options);
    } catch (error) {
      // Filter options loading failed - UI will handle gracefully
    }
  }

  populateFilterDropdowns(options) {
    // Populate category dropdown
    const categorySelect = document.getElementById('category-select');
    options.categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categorySelect.appendChild(option);
    });

    // Populate priority dropdown
    const prioritySelect = document.getElementById('priority-select');
    options.priorities.forEach(priority => {
      const option = document.createElement('option');
      option.value = priority;
      option.textContent = priority;
      prioritySelect.appendChild(option);
    });

    // Populate sentiment dropdown
    const sentimentSelect = document.getElementById('sentiment-select');
    options.sentiments.forEach(sentiment => {
      const option = document.createElement('option');
      option.value = sentiment;
      option.textContent = sentiment;
      sentimentSelect.appendChild(option);
    });

    // Populate entity type dropdown
    const entityTypeSelect = document.getElementById('entity-type-select');
    options.entityTypes.forEach(entityType => {
      const option = document.createElement('option');
      option.value = entityType;
      option.textContent = entityType;
      entityTypeSelect.appendChild(option);
    });

    // Populate action type dropdown
    const actionTypeSelect = document.getElementById('action-type-select');
    options.actionTypes.forEach(actionType => {
      const option = document.createElement('option');
      option.value = actionType;
      option.textContent = actionType;
      actionTypeSelect.appendChild(option);
    });
  }

  async loadData(page = 1, filters = {}) {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.showLoading();
    this.hideError();

    try {
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: document.getElementById('limit-select')?.value || '10',
        ...filters
      });

      // Remove empty values
      for (const [key, value] of params.entries()) {
        if (!value || value === '') {
          params.delete(key);
        }
      }

      const response = await fetch(`${this.baseURL}/extracted-email-data?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      this.renderTable(data.data);
      this.renderPagination(data.pagination);
      this.updateResultsCount(data.pagination);
      
      this.currentPage = page;
      this.currentFilters = filters;
      
    } catch (error) {
      this.showError('Failed to load data. Please try again.');
    } finally {
      this.isLoading = false;
      this.hideLoading();
    }
  }

  renderTable(data) {
    const tableBody = document.getElementById('table-body');
    const emptyState = document.getElementById('empty-state');
    
    if (!data || data.length === 0) {
      tableBody.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    
    emptyState.classList.add('hidden');
    
    tableBody.innerHTML = data.map(item => `
      <tr class="data-row" data-id="${item.id}">
        <td class="expand-column">
          <button class="expand-button" onclick="window.dataPreview.toggleRow('${item.id}')">
            ▶
          </button>
        </td>
        <td>
          <div class="email-subject">
            <strong>${this.escapeHtml(item.email.subject)}</strong>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">
              From: ${this.escapeHtml(item.email.fromAddress)}
            </div>
          </div>
        </td>
        <td>
          <span class="status-badge category-${item.category.toLowerCase()}">
            ${item.category}
          </span>
        </td>
        <td>
          <span class="status-badge priority-${item.priority.toLowerCase()}">
            ${item.priority}
          </span>
        </td>
        <td>
          <span class="status-badge sentiment-${item.sentiment.toLowerCase()}">
            ${item.sentiment}
          </span>
        </td>
        <td>
          <div class="confidence-bar">
            <div class="confidence-progress">
              <div class="confidence-fill" style="width: ${(item.confidence * 100)}%"></div>
            </div>
            <span class="confidence-text">${(item.confidence * 100).toFixed(0)}%</span>
          </div>
        </td>
        <td>
          <div style="font-size: 0.8125rem;">
            ${new Date(item.createdAt).toLocaleDateString()}
            <div style="color: var(--text-secondary);">
              ${new Date(item.createdAt).toLocaleTimeString()}
            </div>
          </div>
        </td>
        <td class="actions-column">
          <button class="expand-button" onclick="window.dataPreview.toggleRow('${item.id}')">
            Details
          </button>
        </td>
      </tr>
      <tr id="expanded-${item.id}" class="expanded-row hidden">
        <td colspan="8">
          <div class="expanded-content">
            <div class="expanded-section">
              <h4>Summary</h4>
              <p>${this.escapeHtml(item.summary)}</p>
            </div>
            
            ${item.entities && item.entities.length > 0 ? `
              <div class="expanded-section">
                <h4>Entities (${item.entities.length})</h4>
                <div class="expanded-grid">
                  ${item.entities.map(entity => `
                    <div class="expanded-item">
                      <strong>${entity.entityType}:</strong> ${this.escapeHtml(entity.entityValue)}
                      <div style="font-size: 0.75rem; color: var(--text-secondary);">
                        Confidence: ${(entity.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
            
            ${item.actionItems && item.actionItems.length > 0 ? `
              <div class="expanded-section">
                <h4>Action Items (${item.actionItems.length})</h4>
                <div class="expanded-grid">
                  ${item.actionItems.map(action => `
                    <div class="expanded-item">
                      <strong>${action.actionType}:</strong> ${this.escapeHtml(action.description)}
                      <div style="font-size: 0.75rem;">
                        Priority: <span class="status-badge priority-${action.priority.toLowerCase()}">${action.priority}</span>
                        ${action.isCompleted ? '✅ Completed' : '⏳ Pending'}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  }

  toggleRow(id) {
    const expandedRow = document.getElementById(`expanded-${id}`);
    const expandButton = document.querySelector(`tr[data-id="${id}"] .expand-button`);
    
    if (expandedRow.classList.contains('hidden')) {
      expandedRow.classList.remove('hidden');
      expandButton.textContent = '▼';
      expandButton.classList.add('expanded');
    } else {
      expandedRow.classList.add('hidden');
      expandButton.textContent = '▶';
      expandButton.classList.remove('expanded');
    }
  }

  renderPagination(pagination) {
    const pageNumbers = document.getElementById('page-numbers');
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    
    // Update button states
    prevButton.disabled = pagination.page <= 1;
    nextButton.disabled = pagination.page >= pagination.totalPages;
    
    // Generate page numbers
    pageNumbers.innerHTML = '';
    const maxPages = 5;
    let startPage = Math.max(1, pagination.page - Math.floor(maxPages / 2));
    let endPage = Math.min(pagination.totalPages, startPage + maxPages - 1);
    
    if (endPage - startPage + 1 < maxPages) {
      startPage = Math.max(1, endPage - maxPages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      const pageButton = document.createElement('button');
      pageButton.className = `page-number ${i === pagination.page ? 'active' : ''}`;
      pageButton.textContent = i;
      pageButton.onclick = () => this.goToPage(i);
      pageNumbers.appendChild(pageButton);
    }
  }

  updateResultsCount(pagination) {
    const resultsCount = document.getElementById('results-count');
    const paginationText = document.getElementById('pagination-text');
    
    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);
    
    resultsCount.textContent = `${pagination.total} results`;
    paginationText.textContent = `Showing ${start}-${end} of ${pagination.total} results`;
  }

  goToPage(page) {
    this.loadData(page, this.currentFilters);
  }

  setupEventListeners() {
    // Filter form submission
    const filterForm = document.getElementById('filter-form');
    filterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.applyFilters();
    });

    // Clear filters
    const clearFiltersButton = document.getElementById('clear-filters');
    clearFiltersButton.addEventListener('click', () => {
      filterForm.reset();
      this.loadData(1, {});
    });

    // Pagination buttons
    document.getElementById('prev-page').addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.goToPage(this.currentPage - 1);
      }
    });

    document.getElementById('next-page').addEventListener('click', () => {
      this.goToPage(this.currentPage + 1);
    });

    // Retry button
    document.getElementById('retry-button').addEventListener('click', () => {
      this.loadData(this.currentPage, this.currentFilters);
    });
  }

  applyFilters() {
    const formData = new FormData(document.getElementById('filter-form'));
    const filters = {};
    
    for (const [key, value] of formData.entries()) {
      if (value && value.trim() !== '') {
        filters[key] = value.trim();
      }
    }
    
    this.loadData(1, filters);
  }

  showLoading() {
    document.getElementById('loading').classList.remove('hidden');
  }

  hideLoading() {
    document.getElementById('loading').classList.add('hidden');
  }

  showError(message) {
    document.getElementById('error-text').textContent = message;
    document.getElementById('error-message').classList.remove('hidden');
  }

  hideError() {
    document.getElementById('error-message').classList.add('hidden');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  window.dataPreview = new DataPreview();
  window.dataPreview.init();
}); 