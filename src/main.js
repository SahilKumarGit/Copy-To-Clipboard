const { app, BrowserWindow, ipcMain, screen, nativeImage, Tray, Menu, shell, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { StorageEngine } = require('./storage');
const { ClipboardListener } = require('./clipboard-listener');
const { HotkeyManager } = require('./hotkey');
const { PasteInjector } = require('./paste-injector');
const { LocalSyncProvider } = require('./sync-adapter');

// Background daemon has no terminal, so mirror console output to a size-capped log file
// (macOS: ~/Library/Logs/<app>/main.log, Linux: ~/.config/<app>/logs/main.log)
const MAX_LOG_BYTES = 1024 * 1024;
function setupFileLogging() {
  try {
    const logFile = path.join(app.getPath('logs'), 'main.log');
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > MAX_LOG_BYTES) {
      fs.renameSync(logFile, `${logFile}.old`);
    }
    const stream = fs.createWriteStream(logFile, { flags: 'a' });
    ['log', 'warn', 'error'].forEach((level) => {
      const original = console[level].bind(console);
      console[level] = (...args) => {
        original(...args);
        const line = args.map(a => (a instanceof Error ? a.stack : typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        stream.write(`${new Date().toISOString()} [${level}] ${line}\n`);
      };
    });
  } catch (_) {}
}

// Chromium refuses to take over a lock written under a different hostname (macOS hostnames change with
// the network), so a crashed/killed instance would block every future launch. Clear it when its PID is gone.
function clearStaleSingletonLock() {
  try {
    const userData = app.getPath('userData');
    const target = fs.readlinkSync(path.join(userData, 'SingletonLock'));
    const pid = parseInt(target.slice(target.lastIndexOf('-') + 1), 10);
    if (!pid) return;
    try {
      process.kill(pid, 0);
      return; // owner still alive
    } catch (err) {
      if (err.code !== 'ESRCH') return;
    }
    ['SingletonLock', 'SingletonSocket', 'SingletonCookie'].forEach((name) => {
      try { fs.unlinkSync(path.join(userData, name)); } catch (_) {}
    });
  } catch (_) {}
}
clearStaleSingletonLock();

// Single-instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.exit(0);
} else {
  app.on('second-instance', (_event, commandLine) => {
    // If background start or daemon, never show any window
    if (commandLine && commandLine.some(arg => typeof arg === 'string' && arg.includes('--hidden'))) {
      return;
    }
    // If explicitly asked for about window
    if (commandLine && commandLine.some(arg => typeof arg === 'string' && arg.includes('--about'))) {
      openAboutWindow();
    } else {
      toggleWindow();
    }
  });
}

let mainWindow = null;
let aboutWindow = null;
let storage = null;
let listener = null;
let hotkeyManager = null;
let syncProvider = null;
let tray = null;
let previousAppPid = null;
let previousWindowId = null;
let lastShownAt = 0;
let rendererAckTimer = null;
let rendererCrashTimes = [];

// Compact minimal window dimensions
const WIN_WIDTH = 340;
const WIN_HEIGHT = 430;

// Ignore blur events fired while the window manager is still handing focus to the HUD
const BLUR_GRACE_MS = 250;
// Reload the HUD if its renderer doesn't answer a 'window-shown' ping within this time
const RENDERER_ACK_TIMEOUT_MS = 1500;
// Auto-reload a crashed renderer at most this many times per window of time
const MAX_RENDERER_CRASHES = 3;
const RENDERER_CRASH_WINDOW_MS = 60 * 1000;
// How often to verify the OS still delivers our global shortcut
const HOTKEY_CHECK_INTERVAL_MS = 60 * 1000;

function openAboutWindow() {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.show();
    aboutWindow.focus();
    return;
  }

  aboutWindow = new BrowserWindow({
    width: 380,
    height: 540,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    icon: path.join(__dirname, '../ui/icon.png'),
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  aboutWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      require('electron').shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  aboutWindow.webContents.on('will-navigate', (e, url) => {
    if (url !== aboutWindow.webContents.getURL()) {
      e.preventDefault();
    }
  });

  aboutWindow.loadFile(path.join(__dirname, '../ui/about.html'));

  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });
}

function setAutoStart(enable) {
  try {
    if (process.platform === 'darwin') {
      app.setLoginItemSettings({
        openAtLogin: enable,
        openAsHidden: true
      });
      cleanLegacyLaunchAgent();
    } else if (process.platform === 'linux') {
      const autostartDir = path.join(os.homedir(), '.config', 'autostart');
      const desktopFile = path.join(autostartDir, 'clipboard-manager.desktop');
      if (enable) {
        if (!fs.existsSync(autostartDir)) fs.mkdirSync(autostartDir, { recursive: true });
        // Prefer the installer's launcher script (it carries sandbox flags); an AppImage's execPath
        // is a temporary /tmp/.mount_* path that's gone after reboot
        const execTarget = process.env.CLIPBOARD_MANAGER_LAUNCHER || process.env.APPIMAGE || process.execPath;
        const content = `[Desktop Entry]
Type=Application
Version=1.0
Name=Clipboard Manager
Comment=Clipboard Manager Daemon
Exec="${execTarget}" --hidden
Terminal=false
StartupNotify=false
X-GNOME-Autostart-enabled=true
`;
        fs.writeFileSync(desktopFile, content, 'utf8');
      } else {
        if (fs.existsSync(desktopFile)) {
          fs.unlinkSync(desktopFile);
        }
      }
    }
  } catch (err) {
    console.warn('[AutoStart] Failed to update autostart:', err.message);
  }
}

function cleanLegacyLaunchAgent() {
  if (process.platform !== 'darwin') return;
  const launchAgentDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
  const plistPath = path.join(launchAgentDir, 'com.clipboardmanager.app.plist');

  try {
    if (fs.existsSync(plistPath)) {
      spawn('/bin/launchctl', ['bootout', `gui/${process.getuid ? process.getuid() : 501}/com.clipboardmanager.app`], { stdio: 'ignore' });
      spawn('/bin/launchctl', ['unload', '-w', plistPath], { stdio: 'ignore' });
      try { fs.unlinkSync(plistPath); } catch (_) {}
    }
  } catch (err) {
    console.warn('[LaunchAgent] Error cleaning legacy launch agent:', err.message);
  }
}

function isAutoStartEnabled() {
  try {
    if (process.platform === 'darwin') {
      return app.getLoginItemSettings().openAtLogin;
    } else if (process.platform === 'linux') {
      const desktopFile = path.join(os.homedir(), '.config', 'autostart', 'clipboard-manager.desktop');
      return fs.existsSync(desktopFile);
    }
  } catch (_) {}
  return true;
}

function updateTrayMenu() {
  if (!tray) return;
  const currentShortcut = hotkeyManager ? hotkeyManager.getShortcut() : (storage ? storage.getShortcut() : 'Control+Shift+V');
  const shortcutHint = HotkeyManager.toDisplayString(currentShortcut);
  tray.setToolTip(`Clipboard Manager (${shortcutHint})`);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Open Clipboard (${shortcutHint})`,
      click: () => toggleWindow()
    },
    { type: 'separator' },
    {
      label: 'Pause Recording',
      type: 'checkbox',
      checked: listener ? listener.isPaused() : false,
      click: (menuItem) => {
        if (!listener) return;
        if (menuItem.checked) {
          listener.pause();
        } else {
          listener.resume();
        }
      }
    },
    {
      label: 'Clear Unpinned History',
      click: () => {
        if (storage) storage.clearUnpinned();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('clipboard-cleared');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Check Accessibility Permission',
      click: () => {
        PasteInjector.checkPermissions(true);
      }
    },
    { type: 'separator' },
    {
      label: 'Preferences / About...',
      click: () => openAboutWindow()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        cleanLegacyLaunchAgent();
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function createTray() {
  const iconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
      <line x1="9" y1="12" x2="15" y2="12"></line>
      <line x1="9" y1="16" x2="13" y2="16"></line>
    </svg>
  `;
  const icon = nativeImage.createFromBuffer(Buffer.from(iconSvg), { width: 18, height: 18 });
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }
  
  tray = new Tray(icon);
  updateTrayMenu();
  tray.on('click', () => toggleWindow());
}

function createWindow() {
  const isMac = process.platform === 'darwin';
  const win = new BrowserWindow({
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
    type: isMac ? 'panel' : undefined,
    frame: false,
    // Transparent windows on Linux frequently come back blank/black after hide/show,
    // so use an opaque background matching the HUD colour there.
    transparent: isMac,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    resizable: false,
    backgroundColor: isMac ? '#00000000' : '#14161b',
    hasShadow: true,
    icon: path.join(__dirname, '../ui/icon.png'),
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      // Keep the hidden HUD's renderer painting so it never reappears as a blank frame
      backgroundThrottling: false
    }
  });
  mainWindow = win;

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      require('electron').shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) {
      e.preventDefault();
    }
  });

  // Recover from renderer crashes / hangs instead of leaving a blank HUD forever
  // Any exit counts: the OS can also terminate an idle hidden renderer "cleanly", which still leaves
  // an empty transparent window that looks like the HUD never opened.
  win.webContents.on('render-process-gone', (_e, details) => {
    console.warn('[HUD] Renderer gone:', details.reason);
    if (app.isQuitting || win.isDestroyed()) return;

    const now = Date.now();
    rendererCrashTimes = rendererCrashTimes.filter(t => now - t < RENDERER_CRASH_WINDOW_MS);
    rendererCrashTimes.push(now);
    // Stop eager reloads in a crash loop; showWindow() still rebuilds the window on the next hotkey press
    if (rendererCrashTimes.length <= MAX_RENDERER_CRASHES) {
      // Reloading synchronously inside this event aborts the whole app (SIGTRAP), so defer it
      setTimeout(() => {
        if (!win.isDestroyed()) win.webContents.reload();
      }, 100);
    }
  });

  win.webContents.on('unresponsive', () => {
    console.warn('[HUD] Renderer unresponsive, restarting it');
    if (!win.isDestroyed()) {
      win.webContents.forcefullyCrashRenderer();
    }
  });

  applyWorkspaceBehavior(win);

  win.loadFile(path.join(__dirname, '../ui/index.html'));

  // Automatically hide floating HUD when user clicks away
  win.on('blur', () => {
    if (Date.now() - lastShownAt < BLUR_GRACE_MS) return;
    if (!win.isDestroyed() && win.isVisible()) {
      hideWindow();
    }
  });

  // Never destroy window on close unless quitting
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });
}

// Throw away a hidden HUD and build a fresh one (after GPU crashes, sleep/resume, display changes)
function recreateHiddenWindow(reason) {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible()) return;
  console.log(`[HUD] Recreating window (${reason})`);
  mainWindow.destroy();
  mainWindow = null;
  createWindow();
}

function applyWorkspaceBehavior(win = mainWindow) {
  if (!win || win.isDestroyed()) return;
  // skipTransformProcessType: true so macOS does NOT switch Spaces
  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
    win.setAlwaysOnTop(true, 'screen-saver', 1);
  } else {
    win.setVisibleOnAllWorkspaces(true);
    win.setAlwaysOnTop(true, 'floating', 1);
  }
}

function positionWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const cursor = screen.getCursorScreenPoint();
  const currentDisplay = screen.getDisplayNearestPoint(cursor);
  const { x: dx, y: dy, width: dw, height: dh } = currentDisplay.workArea;

  // Center horizontally relative to current cursor on this specific display
  let x = Math.round(cursor.x - WIN_WIDTH / 2);
  let y = Math.round(cursor.y + 12);

  // Clamp horizontally within this display's boundary
  if (x + WIN_WIDTH > dx + dw - 10) {
    x = dx + dw - WIN_WIDTH - 10;
  }
  if (x < dx + 10) {
    x = dx + 10;
  }

  // Clamp vertically within this display's boundary
  if (y + WIN_HEIGHT > dy + dh - 10) {
    y = cursor.y - WIN_HEIGHT - 12;
  }
  if (y < dy + 10) {
    y = dy + 10;
  }

  // Set bounds on the target display
  mainWindow.setBounds({ x, y, width: WIN_WIDTH, height: WIN_HEIGHT });
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else if (mainWindow.webContents.isCrashed()) {
    // Renderer died while hidden and wasn't reloaded: start over with a fresh window
    console.warn('[HUD] Renderer was dead on show, recreating window');
    mainWindow.destroy();
    mainWindow = null;
    createWindow();
  }

  // Capture frontmost app PID or window ID synchronously BEFORE showing the HUD
  if (process.platform === 'darwin') {
    const activePid = PasteInjector.getActivePid();
    if (activePid && activePid !== process.pid) {
      previousAppPid = activePid;
    }
  } else if (process.platform === 'linux') {
    previousWindowId = PasteInjector.getLinuxActiveWindow();
  }

  applyWorkspaceBehavior();
  positionWindow();
  lastShownAt = Date.now();

  if (process.platform === 'darwin') {
    // show() calls [NSApp activateIgnoringOtherApps:YES], which makes macOS jump to the Space our
    // app (or Chrome's main window) last lived on. A non-activating panel shown inactive and then
    // made key stays on the current Space, including full-screen ones, and leaves the target app active.
    mainWindow.showInactive();
    mainWindow.focus();
  } else {
    mainWindow.show();
    // Window managers drop the sticky/above state when a window is unmapped, and Electron re-maps it
    // onto the workspace it remembers, so re-apply after mapping to bring it to the current workspace.
    applyWorkspaceBehavior();
    mainWindow.moveTop();
    mainWindow.focus();
    const win = mainWindow;
    setTimeout(() => {
      if (!win.isDestroyed() && win.isVisible() && !win.isFocused()) {
        win.focus();
      }
    }, 60);
  }

  notifyRendererShown();
}

function hideWindow() {
  clearTimeout(rendererAckTimer);
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    mainWindow.hide();
  }
}

function toggleWindow() {
  // A visible but unfocused HUD is usually sitting on another workspace/Space: bring it here instead of hiding
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && mainWindow.isFocused()) {
    hideWindow();
  } else {
    showWindow();
  }
}

// Ask the renderer to refresh itself; reload it if it doesn't answer (blank/hung page)
function notifyRendererShown() {
  const wc = mainWindow.webContents;
  clearTimeout(rendererAckTimer);
  // A page that's still loading renders fresh data on its own
  if (wc.isLoading()) return;

  rendererAckTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
      console.warn('[HUD] Renderer did not respond, reloading');
      mainWindow.webContents.reload();
    }
  }, RENDERER_ACK_TIMEOUT_MS);
  wc.send('window-shown');
}

function setupIPC() {
  ipcMain.handle('get-items', (_e, filter) => {
    return storage.getItems(filter);
  });

  ipcMain.handle('search-items', (_e, query) => {
    return storage.search(query);
  });

  ipcMain.handle('toggle-pin', (_e, id) => {
    return storage.togglePin(id);
  });

  ipcMain.handle('delete-item', (_e, id) => {
    return storage.deleteItem(id);
  });

  ipcMain.handle('clear-unpinned', () => {
    return storage.clearUnpinned();
  });

  ipcMain.handle('hide-window', () => {
    hideWindow();
  });

  ipcMain.on('hud-ready', () => {
    clearTimeout(rendererAckTimer);
  });

  ipcMain.handle('check-permissions', () => {
    return PasteInjector.checkPermissions(false);
  });

  ipcMain.handle('request-permissions', () => {
    return PasteInjector.requestPermissions();
  });

  ipcMain.handle('open-accessibility-guide', () => {
    shell.openExternal('https://github.com/SahilKumarGit/Copy-To-Clipboard/blob/main/docs/MACOS_ACCESSIBILITY_GUIDE.md');
  });

  let isPasting = false;
  ipcMain.handle('paste-item', (_e, id) => {
    if (isPasting) return false;
    isPasting = true;
    setTimeout(() => { isPasting = false; }, 400);

    const item = storage.items.find(i => i.id === id);
    if (!item) return false;

    // 1. Immediately write selected item to OS clipboard
    if (item.type === 'text') {
      listener.writeTextSilently(item.content);
    } else if (item.type === 'image' && item.assetPath && fs.existsSync(item.assetPath)) {
      const img = nativeImage.createFromPath(item.assetPath);
      listener.writeImageSilently(img);
    }

    // 2. Hide HUD window and surrender active focus back to the target application
    hideWindow();

    // If macOS Accessibility permissions are not granted, prompt the user
    if (process.platform === 'darwin' && !PasteInjector.checkPermissions(false)) {
      PasteInjector.checkPermissions(true);
      return true;
    }

    // 3. Inject synthetic paste keystroke targeting the original process PID or window ID
    PasteInjector.simulatePaste(previousAppPid, previousWindowId);

    return true;
  });

  // App Information Handler for About Dialog & Preferences
  ipcMain.handle('get-app-info', () => {
    const activeShortcut = hotkeyManager ? hotkeyManager.getShortcut() : (storage ? storage.getShortcut() : 'Control+Shift+V');
    const defaultShortcut = storage ? storage.getDefaultShortcut() : (process.platform === 'darwin' ? 'Command+Shift+V' : 'Control+Shift+V');
    return {
      version: app.getVersion() || '1.0.0',
      platform: process.platform,
      autoStart: isAutoStartEnabled(),
      shortcut: activeShortcut,
      defaultShortcut: defaultShortcut,
      displayTokens: HotkeyManager.toDisplayTokens(activeShortcut),
      displayString: HotkeyManager.toDisplayString(activeShortcut),
      defaultDisplayTokens: HotkeyManager.toDisplayTokens(defaultShortcut),
      defaultDisplayString: HotkeyManager.toDisplayString(defaultShortcut)
    };
  });

  // Hotkey Customization Handlers
  ipcMain.handle('set-shortcut', (_e, newShortcut) => {
    if (!hotkeyManager) {
      return { success: false, error: 'Hotkey manager is unavailable' };
    }
    const result = hotkeyManager.updateShortcut(newShortcut);
    if (result.success) {
      if (storage) storage.setShortcut(result.shortcut);
      updateTrayMenu();
      const payload = {
        shortcut: result.shortcut,
        displayTokens: result.displayTokens,
        displayString: result.displayString
      };
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('shortcut-updated', payload);
      }
      if (aboutWindow && !aboutWindow.isDestroyed()) {
        aboutWindow.webContents.send('shortcut-updated', payload);
      }
    }
    return result;
  });

  ipcMain.handle('reset-shortcut', () => {
    const defaultSc = storage ? storage.getDefaultShortcut() : (process.platform === 'darwin' ? 'Command+Shift+V' : 'Control+Shift+V');
    if (!hotkeyManager) {
      if (storage) storage.setShortcut(defaultSc);
      return {
        success: true,
        shortcut: defaultSc,
        displayTokens: HotkeyManager.toDisplayTokens(defaultSc),
        displayString: HotkeyManager.toDisplayString(defaultSc)
      };
    }
    const result = hotkeyManager.updateShortcut(defaultSc);
    if (result.success) {
      if (storage) storage.setShortcut(defaultSc);
      updateTrayMenu();
      const payload = {
        shortcut: defaultSc,
        displayTokens: result.displayTokens,
        displayString: result.displayString
      };
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('shortcut-updated', payload);
      }
      if (aboutWindow && !aboutWindow.isDestroyed()) {
        aboutWindow.webContents.send('shortcut-updated', payload);
      }
    }
    return result;
  });

  // Autostart Toggle Handler
  ipcMain.handle('set-auto-start', (_e, enabled) => {
    setAutoStart(enabled);
    return isAutoStartEnabled();
  });

  // Close About Dialog
  ipcMain.handle('close-about', () => {
    if (aboutWindow && !aboutWindow.isDestroyed()) {
      aboutWindow.close();
      aboutWindow = null;
    }
  });

  // Open About Dialog
  ipcMain.handle('open-about', () => {
    openAboutWindow();
  });

  // Uninstall App Handler
  ipcMain.handle('uninstall-app', async (_e, options) => {
    try {
      // 1. Disable autostart
      setAutoStart(false);
      cleanLegacyLaunchAgent();

      // 2. Stop active listener and hotkeys
      if (hotkeyManager) hotkeyManager.unregisterAll();
      if (listener) listener.stop();

      // 3. Delete stored data if user checked history deletion
      if (options && options.deleteHistory && storage) {
        storage.destroyAllData();
      }

      // 4. Detached bundle removal
      if (process.platform === 'darwin') {
        const execPath = process.execPath;
        const match = execPath.match(/(.*?\.app)/);
        const appBundle = match ? match[1] : '/Applications/ClipboardManager.app';

        if (fs.existsSync(appBundle)) {
          const child = spawn('/bin/sh', ['-c', 'sleep 1 && rm -rf "$TARGET"', '--'], {
            env: { ...process.env, TARGET: appBundle },
            detached: true,
            stdio: 'ignore'
          });
          child.unref();
        }
      } else if (process.platform === 'linux') {
        const script = `sleep 1 && rm -rf ~/.local/share/clipboard-manager && rm -f ~/.local/bin/clipboard-manager /usr/local/bin/clipboard-manager ~/.local/share/applications/clipboard-manager.desktop ~/.config/autostart/clipboard-manager.desktop`;
        const child = spawn('/bin/bash', ['-c', script], {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();
      }

      // 5. Exit application cleanly
      setTimeout(() => {
        app.isQuitting = true;
        app.quit();
      }, 500);

      return { success: true };
    } catch (err) {
      console.error('[Uninstall] Error during uninstall:', err);
      return { success: false, error: err.message };
    }
  });
}

// macOS app menu without a Quit item: Cmd+Q in the About window only closes it, so the daemon
// keeps running. The Edit menu keeps copy/paste/select-all working in the HUD search box.
function setupAppMenu() {
  if (process.platform !== 'darwin') return;
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { label: 'About Clipboard Manager', click: () => openAboutWindow() },
        { type: 'separator' },
        { label: 'Close Window', accelerator: 'Command+Q', role: 'close' },
        { role: 'close' }
      ]
    },
    { role: 'editMenu' }
  ]));
}

// App lifecycle
app.whenReady().then(() => {
  setupFileLogging();
  setupAppMenu();
  console.log(`[App] Starting v${app.getVersion()} on ${process.platform}`);
  cleanLegacyLaunchAgent();

  // On macOS, run purely as a menu bar HUD without taking up a dock icon
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  // Ensure autostart is enabled by default
  setAutoStart(true);

  // Initialize storage
  storage = new StorageEngine();

  // Initialize sync provider (local-only for sprint 1)
  syncProvider = new LocalSyncProvider();
  syncProvider.initialize();

  // Initialize clipboard listener
  listener = new ClipboardListener(storage);
  listener.onNewItem((item) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('clipboard-item-added', item);
    }
  });
  listener.start();

  // Check accessibility permissions on startup
  PasteInjector.checkPermissions(true);

  // Parse CLI shortcut or environment variable
  function parseShortcutFromArgv(argv) {
    if (!Array.isArray(argv)) return null;
    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i];
      if (typeof arg !== 'string') continue;
      if (arg.startsWith('--shortcut=')) {
        return arg.slice(11).replace(/^["']|["']$/g, '');
      }
      if (arg.startsWith('--set-shortcut=')) {
        return arg.slice(15).replace(/^["']|["']$/g, '');
      }
      if ((arg === '--shortcut' || arg === '--set-shortcut') && argv[i + 1]) {
        return argv[i + 1].replace(/^["']|["']$/g, '');
      }
    }
    return null;
  }

  const cliShortcut = parseShortcutFromArgv(process.argv);
  const envShortcut = process.env.CLIPBOARD_SHORTCUT;
  if (cliShortcut) {
    storage.setShortcut(cliShortcut);
    console.log(`[App] Custom shortcut configured via CLI argument: ${cliShortcut}`);
  } else if (envShortcut && !storage.getSetting('shortcut')) {
    storage.setShortcut(envShortcut);
    console.log(`[App] Shortcut configured from CLIPBOARD_SHORTCUT env: ${envShortcut}`);
  }

  const initialShortcut = storage.getShortcut();

  // Create System Tray and HUD window
  createTray();
  createWindow();
  setupIPC();

  // Register global hotkey
  hotkeyManager = new HotkeyManager(initialShortcut);
  hotkeyManager.register(() => {
    toggleWindow();
  });

  // The OS can silently drop the hotkey grab across sleep, screen lock or keyboard/layout changes
  // (notably X11 on Ubuntu), so re-register it then and verify it periodically.
  setInterval(() => {
    // On X11 isRegistered() only reflects Electron's own bookkeeping, not whether the X server still
    // honours the key grab, so re-grab outright there (cheap) while the HUD isn't in use.
    if (process.platform === 'linux' && !(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible())) {
      hotkeyManager.refresh();
    } else {
      hotkeyManager.ensureRegistered();
    }
  }, HOTKEY_CHECK_INTERVAL_MS);
  powerMonitor.on('unlock-screen', () => hotkeyManager.refresh());

  // A hidden HUD can lose its compositor surface across these events and later show up blank
  powerMonitor.on('resume', () => {
    hotkeyManager.refresh();
    recreateHiddenWindow('system resume');
  });
  screen.on('display-added', () => recreateHiddenWindow('display added'));
  screen.on('display-removed', () => recreateHiddenWindow('display removed'));
  app.on('child-process-gone', (_e, details) => {
    if (details.type === 'GPU') {
      recreateHiddenWindow('GPU process gone');
    }
  });

  // If user launched manually (not at system boot / not with --hidden), open the About/Details window
  const isHiddenLaunch = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAtLogin;
  if (!isHiddenLaunch) {
    openAboutWindow();
  }
});

// If app is activated (e.g. clicked in Finder / Applications / Dock)
app.on('activate', () => {
  openAboutWindow();
});

// Every real quit (tray Quit, installer/updater `killall`, logout, shutdown) must go through: a
// blocked quit leaves an outdated process running against a replaced app bundle, which then reads
// garbage out of the new app.asar. Accidental Cmd+Q is handled by the app menu instead (see below).
app.on('before-quit', () => {
  // Lets the HUD's close handler stop turning close into hide
  app.isQuitting = true;
});

app.on('will-quit', () => {
  if (hotkeyManager) hotkeyManager.unregisterAll();
  if (listener) listener.stop();
});

// Keep daemon running in background on macOS/Linux even when windows are closed
app.on('window-all-closed', (e) => {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }
});
