# Clipboard Manager (Ubuntu & macOS)

A lightning-fast, lightweight, cross-platform clipboard manager built with Tauri v2 and modern web technologies. Stores the latest 50 copied text and image items, provides an instant floating HUD triggered via `Ctrl+Shift+V` / `Cmd+Shift+V`, and stores data without any SQL databases.

## Features
- **50-Item Ring Buffer**: Automatically retains your 50 most recent copies.
- **Text & Image Support**: Captures rich text snippets, code, links, and screenshots/bitmaps.
- **Minimal HUD**: Inspired by Microsoft Windows `Win+V` and Android Gboard clipboard.
- **Zero SQL Database**: Pure atomic JSON metadata index + flat-file image cache.
- **Keyboard-First**: Navigate with arrows, filter by typing, paste with Enter, dismiss with Esc.
- **Sync Ready**: Designed with modular hooks for future multi-device E2EE cloud sync (Firebase / P2P).

## Agent & Architecture Documentation
All design documents, rules, and specifications are located in [`.agent-workflow/`](.agent-workflow/):
- [`ARCHITECTURE.md`](.agent-workflow/ARCHITECTURE.md)
- [`RESTRICTIONS_AND_GUIDELINES.md`](.agent-workflow/RESTRICTIONS_AND_GUIDELINES.md)
- [`UI_UX_SPECIFICATION.md`](.agent-workflow/UI_UX_SPECIFICATION.md)
- [`STORAGE_SPECIFICATION.md`](.agent-workflow/STORAGE_SPECIFICATION.md)
- [`SYNC_ROADMAP.md`](.agent-workflow/SYNC_ROADMAP.md)
- [`PHASES_AND_TASKS.md`](.agent-workflow/PHASES_AND_TASKS.md)
