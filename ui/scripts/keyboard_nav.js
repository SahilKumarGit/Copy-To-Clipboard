/**
 * Keyboard Navigation Controller for Clipboard Manager HUD
 */
class KeyboardNavigator {
  constructor(app) {
    this.app = app;
    this.selectedIndex = 0;
    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener('keydown', (e) => {
      const searchInput = document.getElementById('search-input');
      const isSearchFocused = document.activeElement === searchInput;

      // Escape to close HUD immediately
      if (e.key === 'Escape') {
        e.preventDefault();
        this.app.hide();
        return;
      }

      // Enter to paste currently selected item
      if (e.key === 'Enter') {
        e.preventDefault();
        this.app.pasteSelected();
        return;
      }

      // Arrow Down
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.moveSelection(1);
        return;
      }

      // Arrow Up
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.moveSelection(-1);
        return;
      }

      // 'P' key to toggle pin on selected item (only when search input not focused)
      if ((e.key === 'p' || e.key === 'P') && !isSearchFocused) {
        e.preventDefault();
        this.app.togglePinSelected();
        return;
      }

      // Delete / Backspace to remove selected item (only when search input not focused)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isSearchFocused) {
        e.preventDefault();
        this.app.deleteSelected();
        return;
      }

      // If user types standard alphanumeric characters while search is not focused, focus search
      if (!isSearchFocused && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        searchInput.focus();
      }
    });
  }

  reset() {
    this.selectedIndex = 0;
    this.updateVisualSelection();
  }

  moveSelection(direction) {
    const cards = document.querySelectorAll('.clip-card');
    if (cards.length === 0) return;

    this.selectedIndex += direction;
    if (this.selectedIndex < 0) {
      this.selectedIndex = cards.length - 1;
    } else if (this.selectedIndex >= cards.length) {
      this.selectedIndex = 0;
    }

    this.updateVisualSelection();
  }

  setSelectedIndex(index) {
    this.selectedIndex = index;
    this.updateVisualSelection();
  }

  updateVisualSelection() {
    const cards = document.querySelectorAll('.clip-card');
    cards.forEach((card, idx) => {
      if (idx === this.selectedIndex) {
        card.classList.add('selected');
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        card.classList.remove('selected');
      }
    });
  }
}

window.KeyboardNavigator = KeyboardNavigator;
