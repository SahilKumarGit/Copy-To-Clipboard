const { exec, execFile, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { systemPreferences } = require('electron');

/**
 * Platform-Aware Paste Synthesizer
 * Uses native CoreGraphics event synthesis on macOS, wtype/ydotool on Wayland, and xdotool on X11.
 */
class PasteInjector {
  static getMacHelperPath() {
    const unpackedPath = path.join(process.resourcesPath || '', 'app.asar.unpacked/bin/paste-helper-mac');
    const resourcesPath = path.join(process.resourcesPath || '', 'bin/paste-helper-mac');
    const devPath = path.join(__dirname, '../bin/paste-helper-mac');

    if (fs.existsSync(unpackedPath)) return unpackedPath;
    if (fs.existsSync(resourcesPath)) return resourcesPath;
    if (fs.existsSync(devPath)) return devPath;
    return null;
  }

  static getActivePid() {
    if (process.platform === 'darwin') {
      const helperPath = this.getMacHelperPath();
      if (helperPath) {
        try {
          const out = execFileSync(helperPath, ['--get-active-pid'], { timeout: 400 }).toString().trim();
          const pid = parseInt(out, 10);
          if (!isNaN(pid) && pid > 0) return pid;
        } catch (err) {
          console.warn('[PasteInjector] Error getting active PID:', err.message);
        }
      }
    }
    return null;
  }

  static getLinuxActiveWindow() {
    if (process.platform !== 'linux') return null;
    try {
      const out = execFileSync('/bin/sh', ['-c', 'command -v xdotool >/dev/null 2>&1 && xdotool getactivewindow'], { timeout: 300 }).toString().trim();
      const wid = parseInt(out, 10);
      if (!isNaN(wid) && wid > 0) return wid;
    } catch (_) {}
    return null;
  }

  static checkPermissions(prompt = false) {
    if (process.platform === 'darwin') {
      try {
        if (prompt) {
          const helperPath = this.getMacHelperPath();
          if (helperPath) {
            try {
              execFileSync(helperPath, ['--request-ax'], { timeout: 1000 });
            } catch (_) {}
          }
        }
        return systemPreferences.isTrustedAccessibilityClient(prompt);
      } catch (err) {
        console.warn('[PasteInjector] Error checking accessibility:', err);
      }
    } else if (process.platform === 'linux') {
      return this.hasLinuxPasteTool();
    }
    return true;
  }

  static openAccessibilitySettings() {
    if (process.platform === 'darwin') {
      try {
        exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"');
      } catch (err) {
        console.warn('[PasteInjector] Error opening accessibility settings:', err);
      }
    }
  }

  static requestPermissions() {
    if (process.platform === 'darwin') {
      try {
        systemPreferences.isTrustedAccessibilityClient(true);
        const helperPath = this.getMacHelperPath();
        if (helperPath) {
          try {
            execFileSync(helperPath, ['--request-ax'], { timeout: 1000 });
          } catch (_) {}
        }
      } catch (_) {}

      this.openAccessibilitySettings();
      return systemPreferences.isTrustedAccessibilityClient(false);
    }
    return true;
  }

  static simulatePaste(targetPid = null, targetWindowId = null) {
    const isMac = process.platform === 'darwin';
    const isLinux = process.platform === 'linux';

    if (isMac) {
      const helperPath = this.getMacHelperPath();
      const pidArg = targetPid ? String(targetPid) : '0';

      if (helperPath) {
        execFile(helperPath, [pidArg], (err) => {
          if (err) {
            console.warn('[PasteInjector] Native helper notice, falling back to AppleScript:', err.message);
            this._simulatePasteAppleScript(targetPid);
          }
        });
      } else {
        this._simulatePasteAppleScript(targetPid);
      }
    } else if (isLinux) {
      setTimeout(() => this._simulateLinuxPaste(targetWindowId), 150);
    }
  }

  static _simulateLinuxPaste(targetWindowId = null) {
    let isTerminal = false;
    if (targetWindowId) {
      try {
        const cls = execFileSync('/bin/sh', ['-c', `xdotool getwindowclassname ${targetWindowId} 2>/dev/null || xdotool getwindowname ${targetWindowId} 2>/dev/null`], { timeout: 300 }).toString().toLowerCase();
        if (/terminal|konsole|kitty|alacritty|xterm|urxvt|tilix|terminator/.test(cls)) {
          isTerminal = true;
        }
      } catch (_) {}
    }

    const pasteKey = isTerminal ? 'ctrl+shift+v' : 'ctrl+v';
    const xdotoolCmd = targetWindowId
      ? `xdotool windowactivate --sync ${targetWindowId} key --clearmodifiers ${pasteKey}`
      : `xdotool key --clearmodifiers ${pasteKey}`;

    const commands = [];
    if (process.env.WAYLAND_DISPLAY) {
      // Wayland: ydotool reaches kernel uinput; wtype reaches wlroots/KDE; xdotool reaches XWayland windows
      commands.push(isTerminal ? 'ydotool key 29:1 42:1 47:1 47:0 42:0 29:0' : 'ydotool key 29:1 47:1 47:0 29:0');
      commands.push(isTerminal ? 'wtype -M ctrl -M shift -k v -m shift -m ctrl' : 'wtype -M ctrl -k v -m ctrl');
      commands.push(xdotoolCmd);
    } else {
      commands.push(xdotoolCmd);
    }

    this._runFirstWorking(commands);
  }

  static _runFirstWorking(commands, index = 0) {
    exec(commands[index], (err) => {
      if (!err) return;
      if (index + 1 < commands.length) {
        this._runFirstWorking(commands, index + 1);
      } else {
        console.warn('[PasteInjector] No paste tool succeeded (install xdotool):', err.message);
      }
    });
  }

  /**
   * Linux auto-paste needs an external key injector; Ubuntu ships none of them by default
   */
  static hasLinuxPasteTool() {
    if (this._linuxPasteToolFound !== undefined) return this._linuxPasteToolFound;
    try {
      execFileSync('/bin/sh', ['-c', 'command -v xdotool || command -v ydotool || command -v wtype'], { timeout: 600 });
      this._linuxPasteToolFound = true;
    } catch (_) {
      this._linuxPasteToolFound = false;
    }
    return this._linuxPasteToolFound;
  }

  static _simulatePasteAppleScript(_targetPid) {
    const args = ['-e', 'tell application "System Events" to key code 9 using command down'];

    execFile('/usr/bin/osascript', args, (err) => {
      if (err) {
        console.warn('[PasteInjector] AppleScript keystroke notice:', err.message);
      }
    });
  }
}

module.exports = { PasteInjector };
