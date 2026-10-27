# 📋 How to Use Clipboard Manager

Welcome to **Clipboard Manager** — a lightning-fast, ultra-compact, cross-platform clipboard history manager designed for macOS and Ubuntu Linux.

---

## ⚡ 1. Summoning the Clipboard HUD

![Clipboard Manager HUD Preview](screenshots/hud-preview.png)

Whenever you need your clipboard history, press the global hotkey from any application or screen:

- **macOS**: `Cmd + Shift + V` *(Default, fully customizable)*
- **Ubuntu Linux**: `Ctrl + Shift + V` *(Default, fully customizable)*

> [!TIP]
> **Change the Shortcut Anytime**: You can customize the hotkey to anything you like (e.g. `Alt+Space`, `Ctrl+Alt+V`, `Super+V`, `Cmd+Opt+V`, `F9`) directly in the **Preferences / About** window or via the command line!
> 
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

## ⌨️ 8. Customizing the Global Shortcut

You can easily change the shortcut from the default (`Cmd+Shift+V` on macOS / `Ctrl+Shift+V` on Linux) to any key combination through multiple convenient ways:

### Option A: Directly from the Main HUD (Instant Inline Panel)
1. In the floating HUD popup, click the **Settings (⚙️)** gear icon in the search bar or the **Hotkey badge** in the footer bar.
2. An inline shortcut panel smoothly slides down right inside the HUD.
3. Click the interactive shortcut button (it pulses `Press keys...`) and hit any key combo on your keyboard (e.g., `Ctrl+Alt+V`, `Alt+Space`, `Super+V`, `Cmd+Opt+V`, `F9`).
4. Or click any of the **one-click preset chips** or type an accelerator in the text field and click **Apply**.
5. To restore the default, click the **Reset (↺)** button.

### Option B: Quick Submenu from the System Tray
1. Right-click the **Clipboard Manager** tray icon in your menu bar / taskbar.
2. Hover over **Change Shortcut**.
3. Select any popular preset radio item (`Ctrl+Shift+V`, `Ctrl+Alt+V`, `Alt+Space`, `Super+V`, etc.) or click **Custom Shortcut...** to open full preferences.
4. The tray tooltip and hotkey rebind immediately.

### Option C: Preferences & About Window
1. Open the Preferences window (click **All Settings ↗** in the HUD panel or select **Preferences / About...** from the tray menu).
2. Click directly on the shortcut badge to record new keys, or click the **Edit (✏️)** button to open the presets modal.

### Option D: Command Line or Environment Variable
You can also launch or configure the daemon with a custom shortcut from terminal:
```bash
# Launch with custom hotkey
clipboard-manager --shortcut="Ctrl+Alt+V"

# Or configure via environment variable
export CLIPBOARD_SHORTCUT="Alt+Space"
clipboard-manager
```


---

## 🔄 9. Background Daemon & Startup on Restart

- **Zero Effort Startup**: Clipboard Manager registers itself in **macOS Login Items** (`~/.config/autostart` on Linux) upon first launch.
- When you reboot or restart your computer, Clipboard Manager **automatically loads itself in the background**.
- You do **not** need to manually launch the app each day — just press your global shortcut anytime!

---

## ℹ️ 10. App List & "About" Pop-up

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

