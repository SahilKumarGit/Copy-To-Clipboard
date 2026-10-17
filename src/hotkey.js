const { globalShortcut } = require('electron');

/**
 * Global Shortcut Handler
 * Binds Ctrl+Shift+V (Ubuntu Linux) or Cmd+Shift+V (macOS)
 */
class HotkeyManager {
  constructor(shortcut = 'CommandOrControl+Shift+V') {
    this.shortcuts = Array.isArray(shortcut) ? shortcut : [shortcut];
    if (process.platform === 'darwin') {
      if (!this.shortcuts.includes('Command+Shift+V')) this.shortcuts.push('Command+Shift+V');
      if (!this.shortcuts.includes('Control+Shift+V')) this.shortcuts.push('Control+Shift+V');
    }
    this.registeredShortcuts = [];
  }

  register(onTrigger) {
    this.shortcuts.forEach((sc) => {
      try {
        const ok = globalShortcut.register(sc, () => {
          if (typeof onTrigger === 'function') {
            onTrigger();
          }
        });
        if (ok) {
          this.registeredShortcuts.push(sc);
          console.log(`[HotkeyManager] Registered global shortcut: ${sc}`);
        } else {
          console.warn(`[HotkeyManager] Failed to register global shortcut: ${sc}`);
        }
      } catch (err) {
        console.error(`[HotkeyManager] Error registering hotkey ${sc}:`, err);
      }
    });
  }

  unregister() {
    this.registeredShortcuts.forEach((sc) => {
      globalShortcut.unregister(sc);
    });
    this.registeredShortcuts = [];
  }

  unregisterAll() {
    globalShortcut.unregisterAll();
  }
}

module.exports = { HotkeyManager };
