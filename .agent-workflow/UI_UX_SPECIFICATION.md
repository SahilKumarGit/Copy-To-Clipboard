# UI / UX Specification

## 1. Design Philosophy
The clipboard history popup must feel like a native OS HUD (Heads-Up Display)—feather-light, non-intrusive, instant, and clean. It synthesizes the best aspects of:
- **Microsoft Windows Clipboard (`Win+V`)**: Compact floating card layout, one-click pin buttons, clear-all unpinned button, and category filters.
- **Android Gboard Clipboard**: Smart category chips (Links, Code, Colors, Numbers), auto-detection pill badges, and quick touch/click paste.

---

## 2. Window Dimensions & Positioning
- **Dimensions**:
  - Width: `380px` – `420px` (fixed, readable line-length).
  - Height: `520px` max (automatically resizes based on item count, up to 50 items with smooth vertical scrolling).
- **Positioning**:
  - Near the current caret/cursor position (where supported by the OS), or anchored at the center/top of the primary active monitor.
- **Backdrop & Styling**:
  - Translucent acrylic / frosted glass effect (`backdrop-filter: blur(20px)`).
  - Rounded corners (`border-radius: 14px`).
  - Subtle 1px translucent border (`border: 1px solid rgba(255, 255, 255, 0.12)` in dark mode).
  - Deep floating shadow (`box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35)`).

---

## 3. UI Component Layout

```
+-------------------------------------------------------+
|  [🔍 Search clipboard (50 items)...]              [⚙] |  <- Header Search Bar
+-------------------------------------------------------+
|  (All)  (📌 Pinned: 2)  (📝 Text)  (🖼 Images) (🔗 Links)|  <- Filter Pill Tabs
+-------------------------------------------------------+
|  [📌]  "https://github.com/rust-lang/rust"            |
|        🔗 Link · 2 mins ago                [Copy] [✕] |  <- Pinned Card
+-------------------------------------------------------+
|  [📌]  "#3B82F6"  [  ] Blue Accent                    |
|        🎨 Color · 5 mins ago               [Copy] [✕] |  <- Smart Color Card
+-------------------------------------------------------+
|  [  ]  +--------------------------------------------+ |
|        | [Thumbnail: Screenshot_2026-10-17.png]      | |
|        | 1920x1080 PNG · 340 KB                     | |  <- Image Card
|        +--------------------------------------------+ |
|        🖼 Image · 12 mins ago              [Copy] [✕] |
+-------------------------------------------------------+
|  [  ]  "const ringBuffer = new Array(50);"            |
|        💻 Code · 18 mins ago               [Copy] [✕] |  <- Code Card
+-------------------------------------------------------+
|  ... (scrollable up to 50 items)                      |
+-------------------------------------------------------+
|  [🗑 Clear Unpinned]         [Esc to close] [Enter to paste] | <- Footer Status Bar
+-------------------------------------------------------+
```

---

## 4. Item Card Anatomy
Each item card contains:
1. **Pin Toggle Button** (Left):
   - Toggles pin state. Pinned cards stick to top or show in "Pinned" tab and are immune to the 50-item FIFO eviction.
2. **Content Preview Area**:
   - **Text**: Monospace or clean Sans-Serif font, syntax highlighted for code snippets, max 3 lines before truncation.
   - **Color**: Shows inline hex code plus a live colored circular preview swatch.
   - **Link**: Underlined URL with favicon/link icon.
   - **Image**: High-density rounded thumbnail with aspect-ratio preservation and size/dimension metadata.
3. **Metadata Badge & Timestamp**:
   - Time ago (e.g., `Just now`, `5m ago`, `Yesterday`).
   - Content type chip (`Text`, `Code`, `Image`, `URL`, `Color`).
4. **Action Buttons (Visible on hover/focus)**:
   - `Paste` button (copies to clipboard and sends keystroke).
   - `Delete` button (removes item and purges disk asset).

---

## 5. Keyboard Navigation & Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl+Shift+V` / `Cmd+Shift+V` | Open / Toggle Clipboard Manager |
| `Escape` | Dismiss / Close Popup |
| `Arrow Down` / `Arrow Up` | Navigate between cards |
| `Enter` | Select item, hide popup, paste into active application |
| `Ctrl+C` / `Cmd+C` | Copy selected item to clipboard without closing |
| `Delete` / `Backspace` | Delete currently highlighted item |
| `P` | Toggle Pin on highlighted item |
| `Tab` | Switch between Filter Tabs (All, Pinned, Text, Images) |
| `Type any text` | Immediately focuses and filters via Search Bar |
