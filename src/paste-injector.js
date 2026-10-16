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

  static checkPermissions(prompt = false) {
    if (process.platform === 'darwin') {
      try {
        return systemPreferences.isTrustedAccessibilityClient(prompt);
      } catch (err) {
        console.warn('[PasteInjector] Error checking accessibility:', err);
      }
    }
    return true;
  }

  static simulatePaste(targetPid = null) {
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
      const isWayland = Boolean(process.env.WAYLAND_DISPLAY);

      if (isWayland) {
        exec('wtype -M ctrl -k v -m ctrl', (err) => {
          if (err) {
            exec('ydotool key 29:1 47:1 47:0 29:0', () => {});
          }
        });
      } else {
        exec('xdotool key --clearmodifiers ctrl+v', (err) => {
          if (err) {
            console.warn('[PasteInjector] xdotool notice:', err.message);
          }
        });
      }
    }
  }

  static _simulatePasteAppleScript(targetPid) {
    const safePid = (targetPid && Number.isInteger(Number(targetPid)) && Number(targetPid) > 0) ? parseInt(targetPid, 10) : null;
    const args = [];

    if (safePid) {
      args.push('-e', `tell application "System Events" to set frontmost of the first process whose unix id is ${safePid} to true`);
    }
    args.push('-e', 'tell application "System Events" to key code 9 using command down');

    execFile('/usr/bin/osascript', args, (err) => {
      if (err) {
        console.warn('[PasteInjector] AppleScript keystroke notice:', err.message);
      }
    });
  }
}

module.exports = { PasteInjector };
