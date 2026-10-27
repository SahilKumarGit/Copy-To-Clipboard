# Guidelines and Restrictions

## 1. Absolute Restrictions

### 1.1 Zero SQL Databases (Strict Rule)
- **Forbidden**: Do NOT import or use SQLite, PostgreSQL, MySQL, DuckDB, or any relational database library.
- **Forbidden**: Do NOT use SQL ORMs (Prisma, Diesel, SeaORM, TypeORM, SQLAlchemy, etc.).
- **Allowed**:
  - Structured flat files (`history.json` or `history.jsonl`).
  - Binary/Key-Value flat file stores (if required) or raw disk files for image media (`assets/`).
  - In-memory data structures (Rust `VecDeque`, Ring Buffer, LRU HashMap).

### 1.2 Capacity & Retention Limit
- **Max Items**: 50 entries max.
- **FIFO Eviction**: When item count exceeds 50, the oldest **unpinned** item must be evicted immediately.
- **Orphan Cleanup**: Evicting an image item must simultaneously delete its cached image file on disk (`assets/<hash>.png`) to prevent disk bloat.

### 1.3 Memory & Performance Budget
- **Idle RAM**: Must not exceed 30MB in background daemon mode.
- **Popup Invocation Latency**: From hotkey press to window visual render must be under **150ms**.
- **Search Latency**: Filtering 50 items must be real-time (< 10ms response).

---

## 2. Platform-Specific Guidelines

### 2.1 Ubuntu Linux
- **Wayland Compatibility**: Wayland restricts background apps from reading clipboard selections without focused windows. The daemon must handle Wayland protocols (via `wl-clipboard` / data-control protocol) and provide automatic fallback for X11.
- **X11 Compatibility**: Support standard X11 selection notify events on `CLIPBOARD` atom.
- **Keystroke Simulation**: Use `wtype` / `ydotool` (on Wayland) or `xdotool` / `xtest` (on X11) or native Rust input injection (`enigo`) with proper fallback.

### 2.2 macOS
- **Pasteboard Access**: Polling `changeCount` of `NSPasteboard` with dynamic backoff (e.g. 200ms when idle, 50ms upon active window switch) to minimize CPU usage.
- **Accessibility Permissions**: macOS requires Accessibility privileges to inject `Cmd+V`. The app must detect missing permissions and present a graceful setup guide instead of failing silently.
- **Visual Vibrancy**: Support macOS native NSVisualEffectView (acrylic/frosted glass).

---

## 3. Privacy & Security Guidelines

- **Password Manager Exclusion**: When clipboard items originate from known password manager window titles or MIME markers (e.g. `x-kde-passwordManagerHint`, 1Password, Bitwarden, KeePassXC), flag them as sensitive.
- **Masking**: Provide an eye toggle to blur or mask sensitive data (OTP, API keys, bearer tokens) in the UI.
- **Session-only Mode**: Allow users to toggle "Pause Recording" from the tray or popup.

---

## 4. UI/UX Guidelines

- **Minimalist & Clean**: No cluttered chrome, no bulky titlebars, no unnecessary borders.
- **Keyboard-First**: A user should be able to press `Ctrl+Shift+V`, hit `Down`, and press `Enter` to paste without touching the mouse.
- **Compact Cards**: Max height per text item preview: 3 lines. Expandable on hover or click.
- **Image Thumbnails**: Render crisp, aspect-ratio-preserved thumbnails with dimensions badge (e.g., `800x600 · 124 KB`).

---

## 5. Mandatory Verification & Testing Policy

Whenever **ANY** modification is made to the codebase (features, bug fixes, refactoring, or UI changes), the changes **MUST** be verified on **BOTH macOS and Ubuntu Linux** before concluding:

### 5.1 Ubuntu Linux Verification (via Docker)
- Execute the end-to-end container test:
  ```bash
  docker run --rm -e APP_HAS_XDOTOOL=1 -v $(pwd)/src:/app/src -v $(pwd)/ui:/app/ui clipboard-e2e:latest /opt/e2e/run.sh
  ```
- **Requirements**: Must exit with `[e2e] RESULT: PASS`, verify target text injection, and check for zero unhandled promise rejections or tray exceptions.

### 5.2 macOS Verification
- Run unit test suite: `npm test` (all StorageEngine, HotkeyManager, and CLI configuration tests must pass 100%).
- Verify JS syntax: `node -c src/main.js src/preload.js src/hotkey.js src/storage.js ui/scripts/*.js`.
- Verify background daemon startup & global hotkey binding (`Command+Shift+V` + `Control+Shift+V`) with isolated user data profile.
- Rebuild and update local `/Applications/ClipboardManager.app` (`npx electron-builder --mac --dir`).
- Never leave hardcoded test shortcuts in `~/Library/Application Support/clipboard-history/settings.json`.

### 5.3 Automated UI & Feature Verification
- Execute `npm run test:ui` (or `npm test`):
  - **HUD Rendering**: Verifies all critical cards, metadata badges, and DOM nodes.
  - **Live Search**: Validates real-time filtering without lag.
  - **Filter Tabs**: Verifies category switching (`all`, `pinned`, `text`, `image`, `url`).
  - **Keyboard Navigation**: Validates arrow key navigation, auto-paste on Enter, and Esc priority closing the hotkey panel first.
  - **Inline Hotkey Panel**: Tests toggle mechanism, preset chips, key recording mode, and default reset.
  - **Preferences Window**: Validates version display, autostart toggle, custom preset modal, and uninstaller confirmation dialog.



