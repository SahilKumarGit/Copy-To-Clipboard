/**
 * Main UI Application Controller
 */
class ClipboardApp {
  constructor() {
    this.items = [];
    this.filteredItems = [];
    this.searchEngine = new window.SearchEngine();
    this.keyboardNav = new window.KeyboardNavigator(this);

    this.dom = {
      itemsList: document.getElementById('items-list'),
      emptyState: document.getElementById('empty-state'),
      searchInput: document.getElementById('search-input'),
      countBadge: document.getElementById('count-badge'),
      filterTabs: document.getElementById('filter-tabs'),
      clearBtn: document.getElementById('clear-unpinned-btn')
    };

    this._bindEvents();
    this.loadData();
  }

  _bindEvents() {
    // Search input live filtering
    this.dom.searchInput.addEventListener('input', (e) => {
      this.searchEngine.setQuery(e.target.value);
      this.render();
      this.keyboardNav.reset();
    });

    // Tab buttons
    this.dom.filterTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;

      this.dom.filterTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      this.searchEngine.setFilter(btn.dataset.filter);
      this.render();
      this.keyboardNav.reset();
    });

    // Clear unpinned
    this.dom.clearBtn.addEventListener('click', async () => {
      if (window.clipboardAPI) {
        this.items = await window.clipboardAPI.clearUnpinned();
      } else {
        this.items = this.items.filter(i => i.pinned);
      }
      this.render();
    });

    // Permission grant button
    const grantBtn = document.getElementById('grant-perm-btn');
    if (grantBtn) {
      grantBtn.addEventListener('click', async () => {
        if (window.clipboardAPI && window.clipboardAPI.requestPermissions) {
          grantBtn.textContent = 'Opening...';
          await window.clipboardAPI.requestPermissions();
          
          let attempts = 0;
          const interval = setInterval(async () => {
            attempts++;
            const isGranted = await this.checkAccessibility();
            if (isGranted || attempts > 20) {
              clearInterval(interval);
              grantBtn.textContent = 'Grant';
            }
          }, 1000);
        }
      });
    }

    // Refresh accessibility state when window regains focus
    window.addEventListener('focus', () => {
      this.checkAccessibility();
    });

    // Listen for real-time copy events pushed from main process
    if (window.clipboardAPI) {
      window.clipboardAPI.onClipboardChanged((newItem) => {
        const existingIdx = this.items.findIndex(i => i.hash === newItem.hash);
        if (existingIdx !== -1) {
          this.items.splice(existingIdx, 1);
        }
        this.items.unshift(newItem);
        if (this.items.length > 50) {
          this.items = this.items.slice(0, 50);
        }
        this.render();
      });

      if (window.clipboardAPI.onWindowShown) {
        window.clipboardAPI.onWindowShown(() => {
          this.checkAccessibility();
        });
      }
    }
  }

  async checkAccessibility() {
    if (window.clipboardAPI && window.clipboardAPI.checkPermissions) {
      const isGranted = await window.clipboardAPI.checkPermissions();
      const banner = document.getElementById('permission-banner');
      if (banner) {
        banner.style.display = isGranted ? 'none' : 'flex';
      }
    }
  }

  async loadData() {
    this.checkAccessibility();
    if (window.clipboardAPI) {
      this.items = await window.clipboardAPI.getItems('all');
    } else {
      // Mock data for standalone browser testing / preview
      this.items = this._getMockData();
    }
    this.render();
  }

  render() {
    this.filteredItems = this.searchEngine.apply(this.items);
    this.dom.countBadge.textContent = `${this.items.length}/50`;

    if (this.filteredItems.length === 0) {
      this.dom.itemsList.innerHTML = '';
      this.dom.emptyState.style.display = 'flex';
      return;
    }

    this.dom.emptyState.style.display = 'none';
    this.dom.itemsList.innerHTML = this.filteredItems
      .map((item, index) => this._renderCardHtml(item, index))
      .join('');

    // Re-attach card click & button listeners
    this.dom.itemsList.querySelectorAll('.clip-card').forEach((card, idx) => {
      const id = card.dataset.id;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.action-icon-btn')) return;
        this.pasteItem(id);
      });

      card.addEventListener('mouseenter', () => {
        this.keyboardNav.setSelectedIndex(idx);
      });

      // Pin button
      const pinBtn = card.querySelector('.pin-btn');
      if (pinBtn) {
        pinBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.togglePin(id);
        });
      }

      // Delete button
      const deleteBtn = card.querySelector('.delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteItem(id);
        });
      }
    });

    this.keyboardNav.updateVisualSelection();
  }

  _renderCardHtml(item, index) {
    const isPinned = item.pinned;
    const timeFormatted = this._formatTimeAgo(item.createdAt);
    const chipClass = item.type === 'image' ? 'image' : item.subtype;
    const chipLabel = item.type === 'image' ? 'Image' : (item.subtype === 'plain' ? 'Text' : item.subtype);

    let chipIcon = '';
    if (item.type === 'image') {
      chipIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="chip-svg"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    } else if (item.subtype === 'code') {
      chipIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="chip-svg"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
    } else if (item.subtype === 'url') {
      chipIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="chip-svg"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
    } else if (item.subtype === 'color') {
      chipIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="chip-svg"><circle cx="12" cy="12" r="9"/></svg>`;
    } else {
      chipIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="chip-svg"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="3" y2="18"/></svg>`;
    }

    let bodyContent = '';
    if (item.type === 'text') {
      if (item.subtype === 'color') {
        bodyContent = `
          <div class="color-preview-row">
            <span class="color-swatch" style="background-color: ${this._escapeHtml(item.content)}"></span>
            <span class="color-hex-label">${this._escapeHtml(item.content)}</span>
          </div>
        `;
      } else if (item.subtype === 'code') {
        bodyContent = `<div class="card-content code-snippet">${this._escapeHtml(item.content)}</div>`;
      } else {
        bodyContent = `<div class="card-content">${this._escapeHtml(item.content)}</div>`;
      }
    } else if (item.type === 'image') {
      const imgSrc = item.assetPath ? `file://${item.assetPath}` : '';
      bodyContent = `
        <div class="image-preview-wrapper">
          <img src="${this._escapeHtml(imgSrc)}" class="image-preview-thumb" alt="Clipboard screenshot" />
        </div>
        <div class="image-meta-text">${this._escapeHtml(item.preview)}</div>
      `;
    }

    return `
      <div class="clip-card ${index === 0 ? 'selected' : ''}" data-id="${item.id}">
        <div class="card-header">
          <div class="card-tags">
            <span class="type-chip ${chipClass}">${chipIcon}<span>${chipLabel}</span></span>
            <span class="timestamp">${timeFormatted}</span>
          </div>
          <div class="card-actions">
            <button class="action-icon-btn pin-btn ${isPinned ? 'pinned' : ''}" title="${isPinned ? 'Unpin' : 'Pin to top'}">
              <svg viewBox="0 0 384 512" fill="currentColor" width="11" height="11">
                <path d="M32 32C32 14.3 46.3 0 64 0L320 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-29.5 0 11.4 148.2c36.7 19.9 65.7 53.2 79.5 94.7l1 3.1H376c4.4 0 8 3.6 8 8s-3.6 8-8 8H208v168c0 13.3-10.7 24-24 24s-24-10.7-24-24V320H8c-4.4 0-8-3.6-8-8s3.6-8 8-8h2.6l1-3.1C25.4 259.4 54.4 226.1 91.1 206.2L102.5 64 64 64C46.3 64 32 49.7 32 32z"/>
              </svg>
            </button>
            <button class="action-icon-btn delete-btn" title="Delete snippet">
              <svg viewBox="0 0 448 512" fill="currentColor" width="11" height="11">
                <path d="M135.2 17.7C140.6 6.8 151.7 0 163.8 0h120.4c12.1 0 23.2 6.8 28.6 17.7L320 32h96c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 96 0 81.7 0 64s14.3-32 32-32h96l7.2-14.3zM32 128h384l-21.6 339c-1.6 25.3-22.6 45-47.9 45H101.5c-25.3 0-46.3-19.7-47.9-45L32 128zm112 80c-8.8 0-16 7.2-16 16v192c0 8.8 7.2 16 16 16s16-7.2 16-16V224c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16v192c0 8.8 7.2 16 16 16s16-7.2 16-16V224c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16v192c0 8.8 7.2 16 16 16s16-7.2 16-16V224c0-8.8-7.2-16-16-16z"/>
              </svg>
            </button>
          </div>
        </div>
        ${bodyContent}
      </div>
    `;
  }

  async pasteItem(id) {
    if (this.isPasting) return;
    this.isPasting = true;
    try {
      if (window.clipboardAPI) {
        await window.clipboardAPI.pasteItem(id);
      } else {
        console.log('Mock paste for item:', id);
      }
    } finally {
      setTimeout(() => {
        this.isPasting = false;
      }, 400);
    }
  }

  async togglePin(id) {
    if (window.clipboardAPI) {
      const updated = await window.clipboardAPI.togglePin(id);
      const idx = this.items.findIndex(i => i.id === id);
      if (idx !== -1 && updated) {
        this.items[idx] = updated;
      }
    } else {
      const item = this.items.find(i => i.id === id);
      if (item) item.pinned = !item.pinned;
    }
    this.render();
  }

  async deleteItem(id) {
    if (window.clipboardAPI) {
      await window.clipboardAPI.deleteItem(id);
      this.items = this.items.filter(i => i.id !== id);
    } else {
      this.items = this.items.filter(i => i.id !== id);
    }
    this.render();
  }

  pasteSelected() {
    if (this.filteredItems.length === 0) return;
    const selected = this.filteredItems[this.keyboardNav.selectedIndex];
    if (selected) {
      this.pasteItem(selected.id);
    }
  }

  togglePinSelected() {
    if (this.filteredItems.length === 0) return;
    const selected = this.filteredItems[this.keyboardNav.selectedIndex];
    if (selected) {
      this.togglePin(selected.id);
    }
  }

  deleteSelected() {
    if (this.filteredItems.length === 0) return;
    const selected = this.filteredItems[this.keyboardNav.selectedIndex];
    if (selected) {
      this.deleteItem(selected.id);
    }
  }

  hide() {
    if (window.clipboardAPI) {
      window.clipboardAPI.hideWindow();
    }
  }

  _formatTimeAgo(timestamp) {
    const elapsed = Math.floor((Date.now() - timestamp) / 1000);
    if (elapsed < 60) return 'Just now';
    if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ago`;
    if (elapsed < 86400) return `${Math.floor(elapsed / 3600)}h ago`;
    return `${Math.floor(elapsed / 86400)}d ago`;
  }

  _escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  _getMockData() {
    return [
      {
        id: 'mock_1',
        hash: 'hash_1',
        type: 'text',
        subtype: 'code',
        content: 'const clipboard = new StorageEngine();\nclipboard.addText("Hello World");',
        pinned: true,
        createdAt: Date.now() - 1000 * 60 * 2,
        preview: 'const clipboard = new StorageEngine();'
      },
      {
        id: 'mock_2',
        hash: 'hash_2',
        type: 'text',
        subtype: 'color',
        content: '#3B82F6',
        pinned: false,
        createdAt: Date.now() - 1000 * 60 * 15,
        preview: '#3B82F6'
      },
      {
        id: 'mock_3',
        hash: 'hash_3',
        type: 'text',
        subtype: 'url',
        content: 'https://github.com/sahilkumarsahoo',
        pinned: false,
        createdAt: Date.now() - 1000 * 60 * 45,
        preview: 'https://github.com/sahilkumarsahoo'
      }
    ];
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new ClipboardApp();
});
