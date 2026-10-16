const { app, BrowserWindow, ipcMain, screen, nativeImage, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { StorageEngine } = require('./storage');
const { ClipboardListener } = require('./clipboard-listener');
const { HotkeyManager } = require('./hotkey');
const { PasteInjector } = require('./paste-injector');
const { LocalSyncProvider } = require('./sync-adapter');

let mainWindow = null;
let storage = null;
let listener = null;
let hotkeyManager = null;
let syncProvider = null;
let tray = null;
let previousAppPid = null;

// Compact minimal window dimensions
const WIN_WIDTH = 340;
const WIN_HEIGHT = 430;

function createTray() {
  const iconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1 2-2h2"></path>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
    </svg>
  `;
  const icon = nativeImage.createFromBuffer(Buffer.from(iconSvg), { width: 16, height: 16 });
  
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
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
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
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Enable on all workspaces so macOS allows window to jump to any monitor / Space
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'floating', 1);

  mainWindow.loadFile(path.join(__dirname, '../ui/index.html'));

  // Automatically hide floating HUD when user clicks away
  mainWindow.on('blur', () => {
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide();
      if (process.platform === 'darwin') {
        app.hide();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function positionWindow() {
  if (!mainWindow) return;
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
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
    if (process.platform === 'darwin') app.hide();
  } else {
    // Capture frontmost app PID synchronously in 1ms BEFORE showing the HUD
    previousAppPid = PasteInjector.getActivePid();

    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    positionWindow();
    mainWindow.show();
    mainWindow.focus();
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
    return PasteInjector.checkPermissions(true);
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

    // 3. Inject synthetic paste keystroke targeting the original process PID
    PasteInjector.simulatePaste(previousAppPid);

    return true;
  });
}

// App lifecycle
app.whenReady().then(() => {
  // On macOS, run purely as a menu bar HUD without taking up a dock icon
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

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
});

app.on('will-quit', () => {
  if (hotkeyManager) hotkeyManager.unregisterAll();
  if (listener) listener.stop();
});

// Keep daemon running in background on macOS/Linux even when window is closed
app.on('window-all-closed', (e) => {
  if (!app.isQuitting) {
    e.preventDefault();
  }
});
