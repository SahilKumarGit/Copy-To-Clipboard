const { globalShortcut } = require('electron');

/**
 * Global Shortcut Handler
 * Binds Ctrl+Shift+V (Ubuntu Linux) or Cmd+Shift+V (macOS)
 */
class HotkeyManager {
  constructor(shortcut = 'CommandOrControl+Shift+V') {
    this.shortcut = shortcut;
    this.isRegistered = false;
  }

  register(onTrigger) {
    try {
      this.isRegistered = globalShortcut.register(this.shortcut, () => {
        if (typeof onTrigger === 'function') {
          onTrigger();
        }
      });

      if (!this.isRegistered) {
        console.warn(`[HotkeyManager] Failed to register global shortcut: ${this.shortcut}`);
      } else {
        console.log(`[HotkeyManager] Registered global shortcut: ${this.shortcut}`);
      }
    } catch (err) {
      console.error('[HotkeyManager] Error registering hotkey:', err);
    }
  }

  unregister() {
    if (this.isRegistered) {
      globalShortcut.unregister(this.shortcut);
      this.isRegistered = false;
    }
  }

  unregisterAll() {
    globalShortcut.unregisterAll();
  }
}

module.exports = { HotkeyManager };
