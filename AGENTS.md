# Mandatory Cross-Platform Testing Guidelines for Agents

Whenever you make **ANY** changes to this codebase (features, bugfixes, refactoring, or UI tweaks), you **MUST** execute and verify tests on **BOTH macOS and Ubuntu Linux**, including automated UI and feature test suites, before completing your task. Never assume changes work without running the automated test suites on both platforms.

---

## 1. Automated UI & Feature Testing (Mandatory)

Execute the comprehensive UI & Feature test suite:

```bash
npm run test:ui
```
*(Also executed automatically as part of `npm test`)*

### Tested Features & UI Behaviors:
1. **HUD Interface & Elements**: Verifies all critical DOM structures (`#items-list`, `#search-input`, `#filter-tabs`, `#hotkey-panel`, `#footer-hotkey-btn`).
2. **Card Rendering**: Verifies card count, metadata tags, and type classification (plain text, code, color, links, images).
3. **Real-Time Search**: Live input dispatch verifies real-time filtering and search query matching.
4. **Category Filter Tabs**: Tab click handlers verify category isolation (`all`, `pinned`, `text`, `image`, `url`).
5. **Inline Hotkey Panel**:
   - Opens/closes smoothly via Gear icon (`#open-settings-btn`) and footer badge (`#footer-hotkey-btn`).
   - One-click preset chip generation and selection.
   - Interactive key recording and manual accelerator input.
   - Default reset button functionality.
6. **Keyboard Navigation & Esc Priority**:
   - Pressing <kbd>Esc</kbd> closes the open hotkey panel first without abruptly dismissing the HUD window.
   - Arrow keys navigate items; <kbd>Enter</kbd> triggers auto-paste.
7. **History Actions**: Pin toggling, item deletion, and "Clear Unpinned" maintaining pinned items.
8. **Preferences & About Window (`ui/about.html`)**:
   - Version tag display and app metadata.
   - Autostart toggle switch.
   - Presets selection modal open/close.
   - Built-in uninstaller confirmation modal and cancel actions.

---

## 2. Ubuntu Linux Testing (Mandatory via Docker)

Always run the Ubuntu 24.04 Docker end-to-end test suite to verify tray, hotkey grab, HUD popup, and auto-paste in a real X11 desktop environment:

```bash
docker run --rm -e APP_HAS_XDOTOOL=1 -v $(pwd)/src:/app/src -v $(pwd)/ui:/app/ui clipboard-e2e:latest /opt/e2e/run.sh
```

- **Verification Criteria**:
  - The script must output `[e2e] RESULT: PASS`.
  - The target text box must contain `'FIRST_ITEM'`.
  - No `UnhandledPromiseRejectionWarning` or uncaught exceptions in app logs.
  - If shortcut logic is modified, test custom shortcut binding as well (e.g. `--shortcut="Control+Alt+V"`).

---

## 3. macOS Testing (Mandatory Native)

Always test on macOS:

1. **Full Test Suite (Unit + UI)**:
   ```bash
   npm test
   ```
   All 17 StorageEngine tests, 12 HotkeyManager tests, CLI configuration tests, and 11 UI & Feature tests must pass (100%).

2. **JavaScript Syntax Verification**:
   ```bash
   node -c src/main.js src/preload.js src/hotkey.js src/storage.js ui/scripts/*.js
   ```

3. **Daemon Startup & Hotkey Registration Verification**:
   Test launching the Electron daemon with an isolated profile:
   ```bash
   ./node_modules/.bin/electron . --user-data-dir=/tmp/cb-test --hidden &
   PID=$!
   sleep 2
   kill -0 $PID && kill $PID
   ```
   Check output for:
   - `[HotkeyManager] Registered global shortcut: Command+Shift+V`
   - `[HotkeyManager] Registered global shortcut: Control+Shift+V`
   - Zero unhandled promise rejections or fatal exceptions.

4. **Preserve User Settings**:
   - Never leave hardcoded test shortcuts in `~/Library/Application Support/clipboard-history/settings.json`. Always use temporary directories for test storage engines.

5. **Local App Sync**:
   - When modifying files packaged into the desktop app, ensure `/Applications/ClipboardManager.app` is rebuilt (`npx electron-builder --mac --dir`) so local testing reflects active source code.

---

## 4. Defensive Code Standards

- **Startup Sequence**: `setupIPC()`, `createWindow()`, and `hotkeyManager.register()` must run first and be protected against tray menu or secondary component failures.
- **`listener.isPaused`**: Remember `isPaused` on `ClipboardListener` is a boolean flag (`listener.isPaused`), **not** a function. Never call `listener.isPaused()`.
- **macOS Dual Hotkeys**: On macOS, default shortcut must always register both `Command+Shift+V` and `Control+Shift+V` so both native Mac keyboards and external PC/Windows keyboards work.
