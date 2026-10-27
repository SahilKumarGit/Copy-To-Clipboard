# Mandatory Cross-Platform Testing Guidelines

Whenever you make **ANY** changes to this codebase (features, bugfixes, refactoring, or UI tweaks), you **MUST** execute and verify tests on **BOTH macOS and Ubuntu Linux** before completing your task. Never assume changes work without running the automated test suites on both platforms.

---

## 1. Ubuntu Linux Testing (Mandatory)

Always run the Ubuntu 24.04 Docker end-to-end test suite to verify tray, hotkey grab, HUD popup, and auto-paste:

```bash
docker run --rm -e APP_HAS_XDOTOOL=1 -v $(pwd)/src:/app/src -v $(pwd)/ui:/app/ui clipboard-e2e:latest /opt/e2e/run.sh
```

- **Verification Criteria**:
  - The script must output `[e2e] RESULT: PASS`.
  - The text box must contain `'FIRST_ITEM'`.
  - No `UnhandledPromiseRejectionWarning` or uncaught exceptions in app logs.
  - If shortcut logic is modified, test custom shortcut binding as well (e.g. `--shortcut="Control+Alt+V"`).

---

## 2. macOS Testing (Mandatory)

Always test on macOS:

1. **Unit Test Suite**:
   ```bash
   npm test
   ```
   All StorageEngine, HotkeyManager, and CLI configuration tests must pass (100%).

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

## 3. Defensive Code Standards

- **Startup Sequence**: `setupIPC()`, `createWindow()`, and `hotkeyManager.register()` must run first and be protected against tray menu or secondary component failures.
- **`listener.isPaused`**: Remember `isPaused` on `ClipboardListener` is a boolean flag (`listener.isPaused`), **not** a function. Never call `listener.isPaused()`.
- **macOS Dual Hotkeys**: On macOS, default shortcut must always register both `Command+Shift+V` and `Control+Shift+V` so both native Mac keyboards and external PC/Windows keyboards work.
