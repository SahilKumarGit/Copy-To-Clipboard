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

  register(onTrigger, { quiet = false } = {}) {
    this.onTrigger = onTrigger;
    this.shortcuts.forEach((sc) => {
      try {
        const ok = globalShortcut.register(sc, () => {
          if (typeof onTrigger === 'function') {
            onTrigger();
          }
        });
        if (ok) {
          this.registeredShortcuts.push(sc);
          if (!quiet) console.log(`[HotkeyManager] Registered global shortcut: ${sc}`);
        } else if (!quiet) {
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

  /**
   * Re-register any shortcut Electron no longer reports as registered
   */
  ensureRegistered() {
    if (!this.onTrigger) return;
    const missing = this.shortcuts.filter((sc) => !globalShortcut.isRegistered(sc));
    if (missing.length > 0) {
      console.warn(`[HotkeyManager] Shortcuts lost, re-registering: ${missing.join(', ')}`);
      this.refresh();
    }
  }

  /**
   * Drop and re-create the OS-level grabs, for when the OS may have dropped them
   * while Electron still believes they are registered (sleep/resume, screen unlock)
   */
  refresh() {
    if (!this.onTrigger) return;
    this.unregister();
    this.register(this.onTrigger, { quiet: true });
    if (this.registeredShortcuts.length === 0) {
      console.warn('[HotkeyManager] Could not re-register any global shortcut');
    }
  }
}

module.exports = { HotkeyManager };
