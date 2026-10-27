# Mandatory Cross-Platform & UI Feature Testing Rule

Every time you make ANY change in this repository, you must verify functionality across BOTH macOS and Ubuntu Linux, including automated UI and feature test suites, before concluding your response.

## Mandatory Checklist Before Finishing Any Task:

1. **Automated UI & Feature Test Suite**:
   ```bash
   npm run test:ui
   ```
   Must pass 100% of HUD and Preferences window tests (rendering, search, tab filtering, keyboard navigation, inline hotkey panel, and preferences modals).

2. **Full Unit Test Suite**:
   ```bash
   npm test
   ```
   All StorageEngine, HotkeyManager, CLI configuration, and UI test suites must pass (100%).

3. **Ubuntu Linux End-to-End (Docker X11)**:
   ```bash
   docker run --rm -e APP_HAS_XDOTOOL=1 -v $(pwd)/src:/app/src -v $(pwd)/ui:/app/ui clipboard-e2e:latest /opt/e2e/run.sh
   ```
   Must output `[e2e] RESULT: PASS` without unhandled errors.

4. **macOS Daemon Startup Test**:
   ```bash
   ./node_modules/.bin/electron . --user-data-dir=/tmp/cb-test --hidden
   ```
   Must register both `Command+Shift+V` and `Control+Shift+V` without unhandled errors.

5. **Installed Desktop App Rebuild**:
   If modifying source files that affect the installed app bundle, rebuild `/Applications/ClipboardManager.app`:
   ```bash
   npx electron-builder --mac --dir && rm -rf /Applications/ClipboardManager.app && cp -R dist/mac-arm64/ClipboardManager.app /Applications/ClipboardManager.app
   ```
