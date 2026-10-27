let electronGlobalShortcut = null;
try {
  const electron = require('electron');
  if (typeof electron === 'object' && electron && electron.globalShortcut) {
    electronGlobalShortcut = electron.globalShortcut;
  }
} catch (_) {}

/**
 * Normalizes user-supplied shortcut strings into standard Electron Accelerator format.
 * Examples:
 *   "ctrl+shift+v" -> "Control+Shift+V"
 *   "cmd+shift+v"  -> "Command+Shift+V"
 *   "alt+space"    -> "Alt+Space"
 *   "super+v"      -> "Super+V"
 *   "win+v"        -> "Super+V"
 */
function normalizeAccelerator(rawShortcut) {
  if (!rawShortcut || typeof rawShortcut !== 'string') return null;

  const parts = rawShortcut
    .split('+')
    .map(p => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;

  const modifiers = new Set();
  let key = null;

  for (const part of parts) {
    const lower = part.toLowerCase();

    if (lower === 'commandorcontrol' || lower === 'cmdorctrl' || lower === 'command_or_control') {
      modifiers.add('CommandOrControl');
    } else if (lower === 'ctrl' || lower === 'control') {
      modifiers.add('Control');
    } else if (lower === 'cmd' || lower === 'command') {
      modifiers.add('Command');
    } else if (lower === 'alt' || lower === 'option' || lower === 'opt') {
      modifiers.add('Alt');
    } else if (lower === 'shift') {
      modifiers.add('Shift');
    } else if (lower === 'super' || lower === 'win' || lower === 'windows' || lower === 'meta') {
      modifiers.add('Super');
    } else {
      // It's the key part
      if (/^[a-z]$/i.test(part)) {
        key = part.toUpperCase();
      } else if (/^[0-9]$/.test(part)) {
        key = part;
      } else if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(part)) {
        key = part.toUpperCase();
      } else if (lower === 'space') {
        key = 'Space';
      } else if (lower === 'tab') {
        key = 'Tab';
      } else if (lower === 'enter' || lower === 'return') {
        key = 'Return';
      } else if (lower === 'esc' || lower === 'escape') {
        key = 'Escape';
      } else if (lower === 'backspace') {
        key = 'Backspace';
      } else if (lower === 'delete' || lower === 'del') {
        key = 'Delete';
      } else if (lower === 'insert' || lower === 'ins') {
        key = 'Insert';
      } else if (lower === 'up' || lower === 'down' || lower === 'left' || lower === 'right') {
        key = lower.charAt(0).toUpperCase() + lower.slice(1);
      } else if (lower === 'home') {
        key = 'Home';
      } else if (lower === 'end') {
        key = 'End';
      } else if (lower === 'pageup' || lower === 'pgup') {
        key = 'PageUp';
      } else if (lower === 'pagedown' || lower === 'pgdn') {
        key = 'PageDown';
      } else if (['`', '~', '-', '=', '[', ']', '\\', ';', '\'', ',', '.', '/'].includes(part)) {
        key = part;
      } else {
        key = part;
      }
    }
  }

  if (!key) return null;

  // Standalone function keys F1-F24 are allowed without modifiers; all other keys require at least 1 modifier
  const isFunctionKey = /^F([1-9]|1[0-9]|2[0-4])$/.test(key);
  if (!isFunctionKey && modifiers.size === 0) {
    return null;
  }

  // Canonical modifier ordering: CommandOrControl/Command/Control -> Alt -> Shift -> Super
  const ordered = [];
  if (modifiers.has('CommandOrControl')) ordered.push('CommandOrControl');
  else if (modifiers.has('Command')) ordered.push('Command');
  else if (modifiers.has('Control')) ordered.push('Control');

  if (modifiers.has('Alt')) ordered.push('Alt');
  if (modifiers.has('Shift')) ordered.push('Shift');
  if (modifiers.has('Super')) ordered.push('Super');

  ordered.push(key);
  return ordered.join('+');
}

/**
 * Converts an Electron accelerator to friendly display tokens for UI rendering.
 * Examples on macOS:
 *   "CommandOrControl+Shift+V" -> ["Cmd", "Shift", "V"]
 *   "Alt+Space"                -> ["Opt", "Space"]
 * Examples on Linux:
 *   "CommandOrControl+Shift+V" -> ["Ctrl", "Shift", "V"]
 *   "Super+V"                  -> ["Super", "V"]
 */
function toDisplayTokens(accelerator, platform = process.platform) {
  if (!accelerator) return [];
  const parts = accelerator.split('+').map(p => p.trim()).filter(Boolean);
  const isMac = platform === 'darwin';

  return parts.map(part => {
    switch (part) {
      case 'CommandOrControl':
        return isMac ? 'Cmd' : 'Ctrl';
      case 'Command':
        return isMac ? 'Cmd' : 'Ctrl';
      case 'Control':
        return 'Ctrl';
      case 'Alt':
        return isMac ? 'Opt' : 'Alt';
      case 'Shift':
        return 'Shift';
      case 'Super':
        return isMac ? 'Cmd' : 'Super';
      case 'Return':
        return 'Enter';
      default:
        return part;
    }
  });
}

/**
 * Returns human-readable string: e.g. "Cmd + Shift + V"
 */
function toDisplayString(accelerator, platform = process.platform) {
  return toDisplayTokens(accelerator, platform).join(' + ');
}

/**
 * Global Shortcut Handler
 * Manages global hotkey registration, dynamic rebinding, and system event recovery.
 */
class HotkeyManager {
  constructor(shortcut = null, onTrigger = null) {
    const defaultSc = process.platform === 'darwin' ? 'Command+Shift+V' : 'Control+Shift+V';
    this.shortcut = normalizeAccelerator(shortcut) || defaultSc;
    this.onTrigger = onTrigger;
    this.registeredShortcuts = [];
  }

  getShortcut() {
    return this.shortcut;
  }

  getDisplayTokens(platform = process.platform) {
    return toDisplayTokens(this.shortcut, platform);
  }

  getDisplayString(platform = process.platform) {
    return toDisplayString(this.shortcut, platform);
  }

  getShortcutsToRegister(shortcut) {
    const list = [shortcut];
    // On macOS, if the shortcut is the default Command+Shift+V or CommandOrControl+Shift+V,
    // also register Control+Shift+V so users on external/Windows keyboards have a seamless experience.
    if (process.platform === 'darwin' && (shortcut === 'Command+Shift+V' || shortcut === 'CommandOrControl+Shift+V')) {
      if (!list.includes('Control+Shift+V')) list.push('Control+Shift+V');
    }
    return list;
  }

  register(onTrigger = null, { quiet = false } = {}) {
    if (onTrigger) {
      this.onTrigger = onTrigger;
    }
    if (!electronGlobalShortcut) {
      if (!quiet) console.warn('[HotkeyManager] electronGlobalShortcut unavailable (non-Electron environment)');
      return false;
    }

    const targets = this.getShortcutsToRegister(this.shortcut);
    let successCount = 0;

    targets.forEach((sc) => {
      try {
        const ok = electronGlobalShortcut.register(sc, () => {
          if (typeof this.onTrigger === 'function') {
            this.onTrigger();
          }
        });
        if (ok) {
          if (!this.registeredShortcuts.includes(sc)) {
            this.registeredShortcuts.push(sc);
          }
          successCount++;
          if (!quiet) console.log(`[HotkeyManager] Registered global shortcut: ${sc}`);
        } else if (!quiet) {
          console.warn(`[HotkeyManager] Failed to register global shortcut: ${sc}`);
        }
      } catch (err) {
        console.error(`[HotkeyManager] Error registering hotkey ${sc}:`, err);
      }
    });

    return successCount > 0;
  }

  unregister() {
    if (!electronGlobalShortcut) return;
    this.registeredShortcuts.forEach((sc) => {
      try {
        electronGlobalShortcut.unregister(sc);
      } catch (_) {}
    });
    this.registeredShortcuts = [];
  }

  unregisterAll() {
    if (!electronGlobalShortcut) return;
    try {
      electronGlobalShortcut.unregisterAll();
    } catch (_) {}
    this.registeredShortcuts = [];
  }

  /**
   * Dynamically change the global shortcut to any valid accelerator string.
   * If registration fails (e.g. system reserved), rolls back cleanly to previous shortcut.
   */
  updateShortcut(newShortcut) {
    const normalized = normalizeAccelerator(newShortcut);
    if (!normalized) {
      return {
        success: false,
        error: 'Invalid shortcut. Please include at least one modifier key (Ctrl, Alt/Opt, Shift, or Cmd/Super) with a key.'
      };
    }

    const previousShortcut = this.shortcut;
    const previousRegistered = [...this.registeredShortcuts];

    // Temporarily unregister current shortcut(s)
    this.unregister();

    // Try registering the new one
    this.shortcut = normalized;
    const targets = this.getShortcutsToRegister(normalized);
    let anySuccess = false;

    if (electronGlobalShortcut) {
      for (const sc of targets) {
        try {
          const ok = electronGlobalShortcut.register(sc, () => {
            if (typeof this.onTrigger === 'function') {
              this.onTrigger();
            }
          });
          if (ok) {
            this.registeredShortcuts.push(sc);
            anySuccess = true;
          }
        } catch (err) {
          console.warn(`[HotkeyManager] Registration candidate failed: ${sc}:`, err.message);
        }
      }
    } else {
      // In headless / test environment without Electron
      anySuccess = true;
    }

    if (!anySuccess) {
      // Rollback to previous working shortcut
      this.unregister();
      this.shortcut = previousShortcut;
      if (electronGlobalShortcut) {
        for (const sc of this.getShortcutsToRegister(previousShortcut)) {
          try {
            const ok = electronGlobalShortcut.register(sc, () => {
              if (typeof this.onTrigger === 'function') {
                this.onTrigger();
              }
            });
            if (ok) this.registeredShortcuts.push(sc);
          } catch (_) {}
        }
      }
      return {
        success: false,
        error: `Could not register "${newShortcut}". The shortcut may be reserved by the system or another application.`
      };
    }

    console.log(`[HotkeyManager] Hotkey successfully updated to: ${normalized}`);
    return {
      success: true,
      shortcut: normalized,
      displayTokens: toDisplayTokens(normalized),
      displayString: toDisplayString(normalized)
    };
  }

  /**
   * Re-register any shortcut Electron no longer reports as registered
   */
  ensureRegistered() {
    if (!this.onTrigger || !electronGlobalShortcut) return;
    const targets = this.getShortcutsToRegister(this.shortcut);
    const missing = targets.filter((sc) => !electronGlobalShortcut.isRegistered(sc));
    if (missing.length > 0) {
      console.warn(`[HotkeyManager] Shortcuts lost, re-registering: ${missing.join(', ')}`);
      this.refresh();
    }
  }

  /**
   * Drop and re-create the OS-level grabs (sleep/resume, screen unlock)
   */
  refresh() {
    if (!this.onTrigger || !electronGlobalShortcut) return;
    this.unregister();
    this.register(this.onTrigger, { quiet: true });
    if (this.registeredShortcuts.length === 0) {
      console.warn('[HotkeyManager] Could not re-register global shortcut');
    }
  }
}

HotkeyManager.normalizeAccelerator = normalizeAccelerator;
HotkeyManager.toDisplayTokens = toDisplayTokens;
HotkeyManager.toDisplayString = toDisplayString;

module.exports = {
  HotkeyManager,
  normalizeAccelerator,
  toDisplayTokens,
  toDisplayString
};
