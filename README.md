# 📋 Clipboard Manager (macOS & Ubuntu Linux)

A lightning-fast, ultra-lightweight, cross-platform clipboard manager with instant floating HUD, auto-paste into active inputs, auto-start on boot, Font Awesome vector icons, and strict Non-SQL atomic storage.

---

## ⚡ Quick Install & Execute (One-Line Command)

Run this single command in your terminal to build, install, register autostart, and launch:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/sahilkumarsahoo/Copy-To-Clipboard/main/install.sh)
```

Or run locally if already cloned:
```bash
bash install.sh
```

---

## 📖 Step-by-Step Documentation

- **[User Guide (How to Use)](docs/HOW_TO_USE.md)**: Complete walkthrough of hotkeys, navigation, auto-pasting, pinning, categories, and tray controls.
- **[Installation Guide (How to Install)](docs/HOW_TO_INSTALL.md)**: One-liner script, manual compilation, macOS Accessibility permissions setup, autostart verification, and uninstall instructions.

---

## ✨ Features

- **Global Hotkey HUD**: Triggered instantly via `Cmd+Shift+V` (macOS) or `Ctrl+Shift+V` (Linux) right next to your active cursor.
- **Auto-Paste Injection**: Click any card or press `Enter` to automatically inject the content directly into your active input field.
- **Multi-Monitor Intelligent Clamping**: Seamlessly floats on whichever monitor or desktop workspace your mouse is located without snapping back to primary display.
- **Auto-Start on Reboot**: Automatically registers into **macOS Login Items** (`~/.config/autostart` on Linux) so you never need to manually start it.
- **Interactive About & Settings Pop-up**: Double-click the app in `/Applications` or click the Menu Bar icon to view version details, toggle autostart, and uninstall.
- **Built-in Safe Uninstaller**: Easily uninstall the app bundle with a confirmation dialog ("Would you like to uninstall this?") and optional history wipe.
- **Clean Vector UI**: 100% Font Awesome vector SVG icons for categories, pins, and deletion. Zero emojis.
- **50-Item FIFO Ring Buffer**: Maintains your 50 most recent copied items with pin-preservation.
- **Zero SQL / Pure Atomic Flat Storage**: Uses atomic JSON index files and an assets directory. Absolutely no SQLite or ORMs.

---

## 🏗️ Architecture & Specifications
Comprehensive documentation located in [`.agent-workflow/`](.agent-workflow/):
- [`ARCHITECTURE.md`](.agent-workflow/ARCHITECTURE.md)
- [`RESTRICTIONS_AND_GUIDELINES.md`](.agent-workflow/RESTRICTIONS_AND_GUIDELINES.md)
- [`UI_UX_SPECIFICATION.md`](.agent-workflow/UI_UX_SPECIFICATION.md)
- [`STORAGE_SPECIFICATION.md`](.agent-workflow/STORAGE_SPECIFICATION.md)
- [`SYNC_ROADMAP.md`](.agent-workflow/SYNC_ROADMAP.md)
- [`PHASES_AND_TASKS.md`](.agent-workflow/PHASES_AND_TASKS.md)
