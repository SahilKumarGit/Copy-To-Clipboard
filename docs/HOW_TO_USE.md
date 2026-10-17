# 📋 How to Use Clipboard Manager

Welcome to **Clipboard Manager** — a lightning-fast, ultra-compact, cross-platform clipboard history manager designed for macOS and Ubuntu Linux.

---

## ⚡ 1. Summoning the Clipboard HUD

![Clipboard Manager HUD Preview](screenshots/hud-preview.png)

Whenever you need your clipboard history, press the global hotkey from any application or screen:

- **macOS**: `Cmd + Shift + V`
- **Ubuntu Linux**: `Ctrl + Shift + V`

> [!TIP]
> The floating acrylic HUD dynamically positions itself right beside your current mouse cursor on whichever monitor or virtual desktop (Space) you are actively working on.

---

## 🎯 2. Selecting & Auto-Pasting Items

You do **not** need to manually copy and switch back to your application to paste. The manager automatically handles this for you:

### Using Mouse:
- Click on any clipboard item card.
- The window immediately dismisses and automatically pastes the content directly into your active input field (terminal, text editor, browser, Slack, etc.).

### Using Keyboard Navigation:
- `↑` / `↓` Arrow keys: Highlight items in the list.
- `Enter`: Select the highlighted item and paste it automatically.
- `Esc`: Dismiss the clipboard HUD without pasting.

---

## 🔍 3. Real-Time Search & Filtering

Start typing immediately when the window appears to filter your history:
- Matches against text content, code snippets, URL domains, hex colors, and image attributes.
- Press `Esc` while searching to clear your query.

---

## 🏷️ 4. Category Filters

Filter your clipboard stream by clicking the vector category icons at the top of the HUD:

| Icon | Category | Description |
| :--- | :--- | :--- |
| **All** | All Items | Chronological stream of the last 50 items (FIFO ring buffer). |
| **Pinned** | Starred / Pinned | Essential snippets you've locked so they are never auto-deleted. |
| **Text** | Plain Text | Standard copied text and multi-line notes. |
| **Code** | Code Snippets | Auto-detected programming code (JavaScript, Python, JSON, HTML, SQL, etc.). |
| **Links** | Web URLs | Clickable URLs with domain badges. |
| **Colors** | Color Swatches | Hex / RGB color codes with a live visual color swatch preview. |
| **Images** | Copied Images | Screenshots and bitmap images with aspect-ratio preserved thumbnails. |

---

## 📌 5. Pinning Items (Save Permanently)

The history manager enforces a strict **50-item FIFO limit** to keep memory and disk footprint near zero. 

- To protect important snippets, API keys, addresses, or links from being evicted, click the **Pin icon** on the card.
- Pinned items are locked into storage and will **never be deleted** by new incoming clipboard copies.
- Access all your pinned items anytime by clicking the **Pinned** tab.

---

## 🗑️ 6. Deleting & Clearing History

- **Delete Single Item**: Click the **Trash icon** on any item to remove it and its cached assets permanently.
- **Clear All Unpinned**: Click the Menu Bar / System Tray icon and select **"Clear Unpinned History"**. All non-pinned items will be wiped, leaving your pinned favorites intact.

---

## 🎛️ 7. Menu Bar / System Tray Controls

Look for the small clipboard icon in your macOS Menu Bar or Linux System Tray:

1. **Open Clipboard (`Cmd+Shift+V` / `Ctrl+Shift+V`)**: Toggle the clipboard window.
2. **Pause Recording**: Temporarily pause clipboard capture (useful when copying passwords or sensitive tokens).
3. **Clear Unpinned History**: Purges all unpinned history in one click.
4. **Check Accessibility Permission**: Tests and prompts for macOS accessibility permissions.
5. **About Clipboard Manager...**: Displays the version, system details, autostart toggle, and uninstaller.
6. **Quit**: Completely shuts down the background daemon.

---

## 🔄 8. Background Daemon & Startup on Restart

- **Zero Effort Startup**: Clipboard Manager registers itself in **macOS Login Items** (`~/.config/autostart` on Linux) upon first launch.
- When you reboot or restart your computer, Clipboard Manager **automatically loads itself in the background**.
- You do **not** need to manually launch the app each day — just press `Cmd+Shift+V` anytime!

---

## ℹ️ 9. App List & "About" Pop-up

If you click **Clipboard Manager** inside your Applications folder or launch it from Spotlight / Launchpad:
- A compact **About & Details** pop-up appears displaying:
  - Current App Version
  - Active Global Shortcut
  - Capacity & Storage Specifications
  - Supported Media Types
  - **Launch at Startup Toggle** (turn on/off auto-start on reboot)
  - Built-in **Uninstall Clipboard Manager** option

![About & Settings Preview](screenshots/about-preview.png)

- To close the pop-up, simply click the prominent **Close** button at the bottom center or press `Esc`.

### Built-in Safe Uninstaller
From the About window, you can also safely remove the app and optionally wipe cached clipboard history:

![Uninstall Modal Preview](screenshots/uninstall-preview.png)

