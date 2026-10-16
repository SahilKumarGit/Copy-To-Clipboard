# Phases & Execution Roadmap

## Phase 1: Architecture, Guidelines & Skeleton Scaffolding (Current)
- [x] Create `.agent-workflow/` folder with complete architectural specifications.
- [x] Create `RESTRICTIONS_AND_GUIDELINES.md` specifying zero-SQL rule, memory limits, and platform rules.
- [x] Create `UI_UX_SPECIFICATION.md` defining Android & Windows 11 clipboard-inspired interface.
- [x] Create `STORAGE_SPECIFICATION.md` defining atomic JSON + file assets ring buffer.
- [x] Create `SYNC_ROADMAP.md` defining future E2EE sync with Firebase / P2P.
- [x] Scaffold all skeleton project files with complete type signatures and structural comments.

---

## Phase 2: Core Storage & Background Ingestion Daemon
- [ ] Implement Rust `StorageEngine`:
  - In-memory ring buffer (50 items capacity).
  - SHA-256 deduplication.
  - Pinning flag and eviction protection.
  - Atomic JSON disk persistence (`history.json`).
  - Image file manager (`assets/<hash>.png`).
- [ ] Implement Clipboard Listeners:
  - Linux Wayland listener (`wl-clipboard` / data-control protocol).
  - Linux X11 listener (X11 SelectionNotify loop).
  - macOS `NSPasteboard` event monitor.
- [ ] Content detection & classifiers:
  - Text, Code, URL, Hex Color, and Image detection.

---

## Phase 3: Floating Acrylic UI & Global Hotkey Integration
- [ ] Register global shortcuts:
  - Linux: `Ctrl + Shift + V`
  - macOS: `Cmd + Shift + V`
- [ ] Floating window management:
  - Frameless, translucent, pinned-to-top HUD.
  - Auto-hide on blur or `Escape`.
- [ ] Interactive UI Implementation:
  - Top search bar with fuzzy text filtering.
  - Filter chips: `All`, `Pinned`, `Text`, `Images`, `Links`.
  - Responsive cards with preview, pin icon, delete icon, and timestamps.
  - Full keyboard accessibility (Up/Down arrow navigation, Enter to paste, Del to remove).
- [ ] Keystroke injector:
  - Inject paste event into active window on item selection.

---

## Phase 4: Multi-Device Sync & Production Packaging
- [ ] Implement `FirebaseSyncProvider` and E2E AES-GCM-256 crypto wrapper.
- [ ] Multi-workstation sync pairing (QR code or passphrase).
- [ ] Ubuntu packaging (`.deb`, `.AppImage`).
- [ ] macOS packaging (`.dmg`, `.app` with codesign readiness).
