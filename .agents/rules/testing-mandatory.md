# Mandatory Cross-Platform Testing Rule

Every time you make ANY change in this repository, you must verify functionality on BOTH macOS and Ubuntu Linux before concluding your response.

## Checklist Before Finishing Any Task:

1. **Ubuntu Linux (Docker E2E)**:
   ```bash
   docker run --rm -e APP_HAS_XDOTOOL=1 -v $(pwd)/src:/app/src -v $(pwd)/ui:/app/ui clipboard-e2e:latest /opt/e2e/run.sh
   ```
   Must output `[e2e] RESULT: PASS`.

2. **macOS Unit Tests**:
   ```bash
   npm test
   ```
   All test suites must pass.

3. **macOS Daemon Startup Test**:
   ```bash
   ./node_modules/.bin/electron . --user-data-dir=/tmp/cb-test --hidden
   ```
   Must register both `Command+Shift+V` and `Control+Shift+V` without unhandled errors.

4. **Installed App Rebuild**:
   If modifying source files that affect the installed app bundle, rebuild `/Applications/ClipboardManager.app`:
   ```bash
   npx electron-builder --mac --dir && rm -rf /Applications/ClipboardManager.app && cp -R dist/mac-arm64/ClipboardManager.app /Applications/ClipboardManager.app
   ```
