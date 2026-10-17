const { app, BrowserWindow, ipcMain, screen, nativeImage, Tray, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { StorageEngine } = require('./storage');
const { ClipboardListener } = require('./clipboard-listener');
const { HotkeyManager } = require('./hotkey');
const { PasteInjector } = require('./paste-injector');
const { LocalSyncProvider } = require('./sync-adapter');

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
      toggleMainWindow();
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

// Compact minimal window dimensions
const WIN_WIDTH = 340;
const WIN_HEIGHT = 430;

function openAboutWindow() {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.show();
    aboutWindow.focus();
    return;
  }

  aboutWindow = new BrowserWindow({
    width: 360,
    height: 490,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
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
        const content = `[Desktop Entry]
Type=Application
Version=1.0
Name=Clipboard Manager
Comment=Clipboard Manager Daemon
Exec="${process.execPath}" --hidden
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
  tray.setToolTip('Clipboard Manager (Ctrl+Shift+V / Cmd+Shift+V)');

  const shortcutHint = process.platform === 'darwin' ? 'Cmd+Shift+V' : 'Ctrl+Shift+V';
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Open Clipboard (${shortcutHint})`,
      click: () => toggleWindow()
    },
    { type: 'separator' },
    {
      label: 'Pause Recording',
      type: 'checkbox',
      checked: false,
      click: (menuItem) => {
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
        storage.clearUnpinned();
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
      label: 'About Clipboard Manager...',
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
  tray.on('click', () => toggleWindow());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    resizable: false,
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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      require('electron').shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      e.preventDefault();
    }
  });

  // Enable on all workspaces so macOS allows window to jump to any monitor / Space
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'floating', 1);

  mainWindow.loadFile(path.join(__dirname, '../ui/index.html'));

  // Automatically hide floating HUD when user clicks away
  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
      mainWindow.hide();
    }
  });

  // Never destroy window on close unless quitting
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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

function toggleWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    // Capture frontmost app PID synchronously in 1ms BEFORE showing the HUD
    const activePid = PasteInjector.getActivePid();
    if (activePid && activePid !== process.pid) {
      previousAppPid = activePid;
    }

    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    positionWindow();
    mainWindow.show();
    mainWindow.focus();
    if (mainWindow.webContents) {
      mainWindow.webContents.send('window-shown');
    }
  }
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
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide();
      if (process.platform === 'darwin') app.hide();
    }
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
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide();
    }
    if (process.platform === 'darwin') {
      app.hide();
    }

    // If macOS Accessibility permissions are not granted, prompt the user
    if (process.platform === 'darwin' && !PasteInjector.checkPermissions(false)) {
      PasteInjector.checkPermissions(true);
      return true;
    }

    // 3. Inject synthetic paste keystroke targeting the original process PID
    PasteInjector.simulatePaste(previousAppPid);

    return true;
  });

  // App Information Handler for About Dialog
  ipcMain.handle('get-app-info', () => {
    return {
      version: app.getVersion() || '1.0.0',
      platform: process.platform,
      autoStart: isAutoStartEnabled(),
      shortcut: process.platform === 'darwin' ? 'Cmd+Shift+V' : 'Ctrl+Shift+V'
    };
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
        const script = `sleep 1 && rm -f /usr/local/bin/clipboard-manager ~/.local/share/applications/clipboard-manager.desktop ~/.config/autostart/clipboard-manager.desktop`;
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

// App lifecycle
app.whenReady().then(() => {
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

  // Create System Tray and HUD window
  createTray();
  createWindow();
  setupIPC();

  // Register global hotkey
  hotkeyManager = new HotkeyManager('CommandOrControl+Shift+V');
  hotkeyManager.register(() => {
    toggleWindow();
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

// Intercept window close / Cmd+Q: prevent quitting the background daemon
app.on('before-quit', (e) => {
  if (!app.isQuitting) {
    e.preventDefault();
    if (aboutWindow && !aboutWindow.isDestroyed()) {
      aboutWindow.close();
      aboutWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }
  }
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
