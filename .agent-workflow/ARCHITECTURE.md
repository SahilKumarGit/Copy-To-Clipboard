# System Architecture: Cross-Platform Clipboard Manager

## 1. Executive Summary
This document defines the system architecture for a high-performance, low-footprint clipboard history manager targeting **Ubuntu Linux (X11 & Wayland)** and **macOS**. The system listens to system clipboard copy events (text and images), maintains an LRU ring buffer capped at the **latest 50 items**, persists data using a strict **non-SQL flat storage engine**, presents an interactive, minimal floating UI inspired by Android Gboard and Windows 10/11 `Win+V`, and exposes modular extension hooks for future multi-device synchronization (e.g., Firebase / E2E P2P).

---

## 2. High-Level Architecture Diagram

```
+------------------------------------------------------------------------+
|                          Operating System Layer                        |
|                                                                        |
|   [Ubuntu X11/Wayland]      [macOS Cocoa Pasteboard]    [Active App]   |
+-------------|--------------------------|----------------------^--------+
              |                          |                      |
              v                          v                      | Synthetic
       (Clipboard Event)          (Clipboard Event)             | Paste
              |                          |                      | (Ctrl/Cmd+V)
+-------------v--------------------------v----------------------|--------+
|                   Core Daemon Layer (Rust / Tauri v2)                 |
|                                                                        |
|  +------------------------------------------------------------------+  |
|  | Clipboard Listener Engine                                        |  |
|  | - X11/Wayland (arboard / wl-clipboard-rs / x11rb)                |  |
|  | - macOS (NSPasteboard changeCount polling / event monitor)       |  |
|  +----------------------------------|-------------------------------+  |
|                                     v                                  |
|  +------------------------------------------------------------------+  |
|  | Ingestion Pipeline                                               |  |
|  | - Deduplication: SHA-256 fingerprinting                          |  |
|  | - Content Classifier: Text / Code / URL / Color / Image / Secret |  |
|  | - Image Normalizer: Convert to optimized PNG                     |  |
|  +----------------------------------|-------------------------------+  |
|                                     v                                  |
|  +------------------------------------------------------------------+  |
|  | In-Memory Ring Buffer (LRU Cache, Max 50 Items)                  |  |
|  | - Pinned Items: Preserved across eviction cycles                 |  |
|  | - Fast Query & Search Index                                      |  |
|  +-------------------|-------------------------------|--------------+  |
|                      |                               |                 |
|                      v (Async Disk Commit)           v (IPC)           |
+----------------------|-------------------------------|-----------------+
                       |                               |
+----------------------v---------+    +----------------v-----------------+
|     Non-SQL Local Storage      |    |       Floating Paste Window      |
|                                |    |   (Minimal Acrylic / Backdrop)   |
|  ~/.config/clipboard/          |    |                                  |
|  ├── history.json (Metadata)   |    |  [ Search / Filter Box ]         |
|  └── assets/                   |    |  [ Tabs: All | Pin | Text | Img ]|
|      └── <sha256>.png          |    |  [ 50 Item Cards (Scrollable) ]  |
+--------------------------------+    |  [ Quick Keyboard Nav (Up/Down) ]|
                                      +----------------------------------+
                                                       |
+--------------------------------                      | (Future Sync)
| Multi-Device Cloud Sync Scope                        v
| (Phase 4 / Future Sprint)           +----------------------------------+
|                                     | Sync Engine Interface            |
|                                     | - AES-256-GCM Encryption Engine  |
|                                     | - Firebase / P2P Realtime Sync   |
|                                     +----------------------------------+
```

---

## 3. Core Subsystems

### 3.1 Clipboard Listener
- **Ubuntu Wayland**: Integrates with Wayland's `zwp_data_control_device_v1` protocol or `wl-paste -w` background watcher to capture copies even when our application does not hold focus.
- **Ubuntu X11**: Uses X11 SelectionNotify event loop on `CLIPBOARD` atom.
- **macOS**: Monitors `NSPasteboard` change count using native timer/hook to intercept copy events without high CPU polling.
- **Deduplication**: When text or image is copied, compute SHA-256 hash. If it matches an existing entry, bump its `updated_at` timestamp and move it to the front of the queue without creating a duplicate record.

### 3.2 Non-SQL Storage Subsystem
- **No SQL Rule**: Zero SQLite, PostgreSQL, MySQL, or relational engines.
- **Structure**:
  - `metadata`: JSON structured document (`history.json`) containing metadata for the top 50 items.
  - `media store`: `assets/` directory storing raw image files as PNGs named `<hash>.png`.
- **Eviction Strategy**:
  - Max capacity: 50 items.
  - When a new 51st item arrives:
    - Locate the oldest unpinned item.
    - Delete its image asset from disk (if applicable).
    - Evict entry from metadata index.

### 3.3 Quick-Paste UI & Global Hotkey
- **Global Hotkey**:
  - Linux: `Ctrl + Shift + V`
  - macOS: `Cmd + Shift + V`
- **Window Behavior**:
  - Windowless frameless modal with acrylic/blur background.
  - Appears near mouse pointer or centered at screen top.
  - Auto-hides when losing focus (`blur` event) or pressing `Escape`.
- **Direct Paste Injection**:
  - When an item is clicked or selected with `Enter`:
    1. Modal hides instantly.
    2. Item is placed into OS active clipboard.
    3. Low-level synthetic keyboard event (`Ctrl+V` or `Cmd+V`) is dispatched to the previously active application window.

### 3.4 Multi-Device Sync Hook (Future Scope)
- Standardized trait/interface `SyncProvider`:
  ```rust
  pub trait SyncProvider {
      async fn push_item(&self, item: &ClipboardItem) -> Result<()>;
      async fn fetch_updates(&self, since: u64) -> Result<Vec<ClipboardItem>>;
      async fn delete_item(&self, id: &str) -> Result<()>;
  }
  ```
- Before pushing to cloud (Firebase or P2P WebRTC), items pass through client-side AES-256-GCM encryption with user's private passphrase.
