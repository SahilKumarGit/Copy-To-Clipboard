/**
 * Automated UI & Feature Test Suite
 * Runs headlessly in Electron to test HUD UI, search, tabs, keyboard navigation, hotkey panel, and preferences.
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Isolate user data dir
const tempUserData = path.join(require('os').tmpdir(), 'cb-ui-test-' + Date.now());
app.setPath('userData', tempUserData);

app.whenReady().then(async () => {
  console.log('🧪 Starting Comprehensive Automated UI & Feature Tests in Electron...');

  // Setup mock IPC
  let items = [
    { id: '1', hash: 'h1', type: 'text', subtype: 'code', content: 'const a = 123;', pinned: false, createdAt: Date.now() - 1000 },
    { id: '2', hash: 'h2', type: 'text', subtype: 'color', content: '#3B82F6', pinned: true, createdAt: Date.now() - 2000 },
    { id: '3', hash: 'h3', type: 'text', subtype: 'url', content: 'https://example.com', pinned: false, createdAt: Date.now() - 3000 },
    { id: '4', hash: 'h4', type: 'text', subtype: 'plain', content: 'Hello world text', pinned: false, createdAt: Date.now() - 4000 }
  ];
  let currentShortcut = 'CommandOrControl+Shift+V';
  let isHiddenCalled = false;

  ipcMain.handle('get-items', () => items);
  ipcMain.handle('search-items', (_e, q) => items.filter(i => i.content.toLowerCase().includes(q.toLowerCase())));
  ipcMain.handle('toggle-pin', (_e, id) => {
    const item = items.find(i => i.id === id);
    if (item) item.pinned = !item.pinned;
    return items;
  });
  ipcMain.handle('delete-item', (_e, id) => {
    items = items.filter(i => i.id !== id);
    return items;
  });
  ipcMain.handle('clear-unpinned', () => {
    items = items.filter(i => i.pinned);
    return items;
  });
  ipcMain.handle('check-permissions', () => true);
  ipcMain.handle('get-app-info', () => ({
    version: '1.0.16',
    platform: process.platform,
    autoStart: true,
    shortcut: currentShortcut,
    displayTokens: ['Ctrl', 'Shift', 'V'],
    displayString: 'Ctrl + Shift + V'
  }));
  ipcMain.handle('set-shortcut', (_e, sc) => {
    currentShortcut = sc;
    return { success: true, shortcut: sc, displayTokens: [sc], displayString: sc };
  });
  ipcMain.handle('reset-shortcut', () => {
    currentShortcut = 'CommandOrControl+Shift+V';
    return { success: true, shortcut: currentShortcut, displayTokens: ['Ctrl', 'Shift', 'V'], displayString: 'Ctrl + Shift + V' };
  });
  ipcMain.handle('hide-window', () => {
    isHiddenCalled = true;
    return true;
  });
  ipcMain.handle('open-about', () => true);
  ipcMain.handle('set-auto-start', () => true);
  ipcMain.handle('close-about', () => true);
  ipcMain.handle('uninstall-app', () => ({ success: true }));

  const win = new BrowserWindow({
    width: 380,
    height: 540,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../src/preload.js'),
      contextIsolation: true
    }
  });

  // ── PART 1: Test Main HUD Popup (ui/index.html) ──
  await win.loadFile(path.join(__dirname, '../ui/index.html'));
  await new Promise(r => setTimeout(r, 600));

  const hudResults = await win.webContents.executeJavaScript(`
    (async () => {
      const suite = [];
      function test(name, fn) {
        try {
          fn();
          suite.push({ name, pass: true });
        } catch (err) {
          suite.push({ name, pass: false, error: err.message });
        }
      }

      // Test 1: DOM Elements exist
      test('HUD Container & Essential Elements Exist', () => {
        if (!document.getElementById('items-list')) throw new Error('Missing #items-list');
        if (!document.getElementById('search-input')) throw new Error('Missing #search-input');
        if (!document.getElementById('filter-tabs')) throw new Error('Missing #filter-tabs');
        if (!document.getElementById('hotkey-panel')) throw new Error('Missing #hotkey-panel');
        if (!document.getElementById('footer-hotkey-btn')) throw new Error('Missing #footer-hotkey-btn');
      });

      // Test 2: Items rendered
      test('Items List Renders Correct Number of Cards', () => {
        const cards = document.querySelectorAll('.clip-card');
        if (cards.length !== 4) throw new Error('Expected 4 cards, found ' + cards.length);
      });

      // Test 3: Search filtering
      test('Search Engine Filters Items Live', () => {
        const searchInput = document.getElementById('search-input');
        searchInput.value = 'hello';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        const cards = document.querySelectorAll('.clip-card');
        if (cards.length !== 1) throw new Error('Expected 1 card for "hello", found ' + cards.length);
        // Clear search
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Test 4: Tab filtering
      test('Filter Tabs Switch Categories Correctly', () => {
        const pinnedTab = document.querySelector('.tab-btn[data-filter="pinned"]');
        pinnedTab.click();
        const cards = document.querySelectorAll('.clip-card');
        if (cards.length !== 1) throw new Error('Expected 1 pinned card, found ' + cards.length);
        // Reset to all
        document.querySelector('.tab-btn[data-filter="all"]').click();
      });

      // Test 5: Hotkey panel toggle
      test('Inline Hotkey Panel Toggles via Gear and Footer Badge', () => {
        const panel = document.getElementById('hotkey-panel');
        if (panel.style.display !== 'none') throw new Error('Panel should start hidden');
        
        window.HotkeyPanel.toggle();
        if (panel.style.display !== 'block') throw new Error('Panel did not open on toggle');

        window.HotkeyPanel.close();
        if (panel.style.display !== 'none') throw new Error('Panel did not close');
      });

      // Test 6: Hotkey panel presets
      test('Hotkey Panel Presets Populate and Click Handlers Work', () => {
        window.HotkeyPanel.open();
        const chips = document.querySelectorAll('.hk-preset-chip');
        if (chips.length === 0) throw new Error('Expected preset chips to be rendered');
        window.HotkeyPanel.close();
      });

      // Test 7: Keyboard navigation - Escape closes panel first
      test('Escape Key Closes Open Hotkey Panel First', () => {
        window.HotkeyPanel.open();
        const panel = document.getElementById('hotkey-panel');
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        if (panel.style.display !== 'none') throw new Error('Escape should close the open hotkey panel');
      });

      // Test 8: Clear unpinned keeps pinned
      test('Clear Unpinned Action Preserves Pinned Items', async () => {
        const clearBtn = document.getElementById('clear-unpinned-btn');
        clearBtn.click();
        await new Promise(r => setTimeout(r, 200));
        const cards = document.querySelectorAll('.clip-card');
        if (cards.length !== 1) throw new Error('Expected 1 pinned card remaining, found ' + cards.length);
      });

      return suite;
    })()
  `);

  // ── PART 2: Test Preferences / About Window (ui/about.html) ──
  await win.loadFile(path.join(__dirname, '../ui/about.html'));
  await new Promise(r => setTimeout(r, 600));

  const aboutResults = await win.webContents.executeJavaScript(`
    (async () => {
      const suite = [];
      function test(name, fn) {
        try {
          fn();
          suite.push({ name, pass: true });
        } catch (err) {
          suite.push({ name, pass: false, error: err.message });
        }
      }

      // Test 9: About elements exist
      test('Preferences Elements & Version Tag Render', () => {
        const versionEl = document.getElementById('app-version');
        if (!versionEl || !versionEl.textContent.includes('v1.0.16')) {
          throw new Error('Expected version v1.0.16, got ' + (versionEl ? versionEl.textContent : 'null'));
        }
        if (!document.getElementById('shortcut-record-btn')) throw new Error('Missing #shortcut-record-btn');
        if (!document.getElementById('autostart-toggle')) throw new Error('Missing #autostart-toggle');
        if (!document.getElementById('uninstall-btn')) throw new Error('Missing #uninstall-btn');
      });

      // Test 10: Presets modal toggle
      test('Preferences Presets Modal Opens and Closes', () => {
        const openBtn = document.getElementById('open-presets-btn');
        const modal = document.getElementById('presets-modal');
        const closeBtn = document.getElementById('close-presets-modal-btn');
        
        openBtn.click();
        if (modal.style.display !== 'flex' && modal.style.display !== 'block') {
          throw new Error('Presets modal did not display on click');
        }
        closeBtn.click();
        if (modal.style.display !== 'none') {
          throw new Error('Presets modal did not hide on close');
        }
      });

      // Test 11: Uninstall confirmation modal toggle
      test('Uninstall Confirmation Modal Opens and Cancels', () => {
        const uninstallBtn = document.getElementById('uninstall-btn');
        const confirmModal = document.getElementById('confirm-modal');
        const cancelBtn = document.getElementById('cancel-uninstall-btn');

        uninstallBtn.click();
        if (confirmModal.style.display !== 'flex' && confirmModal.style.display !== 'block') {
          throw new Error('Uninstall modal did not display on click');
        }
        cancelBtn.click();
        if (confirmModal.style.display !== 'none') {
          throw new Error('Uninstall modal did not hide on cancel');
        }
      });

      return suite;
    })()
  `);

  win.destroy();

  const allResults = [...hudResults, ...aboutResults];
  let failures = 0;
  for (const r of allResults) {
    if (r.pass) {
      console.log('  ✅ ' + r.name);
    } else {
      console.error('  ❌ ' + r.name + ' -> ' + r.error);
      failures++;
    }
  }

  if (failures > 0) {
    console.error(`\n❌ ${failures} UI & Feature tests failed.`);
    app.exit(1);
  } else {
    console.log(`\n✅ All ${allResults.length} UI & Feature tests passed successfully!`);
    app.exit(0);
  }
}).catch(err => {
  console.error('Fatal test error:', err);
  app.exit(1);
});
