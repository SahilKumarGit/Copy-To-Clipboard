# 🚀 How to Install Clipboard Manager

This document provides complete, step-by-step instructions for installing, configuring permissions, setting up automatic launch on reboot, and uninstalling **Clipboard Manager** on macOS and Linux.

---

## ⚡ Quick Start: One-Line Installer & Launcher

To install and launch Clipboard Manager in a single command, open your Terminal and run:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/sahilkumarsahoo/Copy-To-Clipboard/main/install.sh)
```

Or if you have already cloned the repository locally:

```bash
bash install.sh
```

### What the installer handles automatically:
1. Detects your OS (macOS Apple Silicon / Intel or Ubuntu Linux).
2. Verifies Node.js & npm prerequisites.
3. Compiles the high-performance native Cocoa paste injector (`bin/paste-helper-mac`).
4. Packages a standalone application bundle (`ClipboardManager.app`).
5. Installs the bundle into `/Applications/ClipboardManager.app`.
6. Strips macOS quarantine flags (`xattr -cr`).
7. Configures automatic startup upon system reboot.
8. Launches the application daemon immediately.

---

## 🛠️ Manual Installation (Step-by-Step)

If you prefer building and deploying manually, follow these steps:

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher ([Download Node.js](https://nodejs.org))
- **npm**: v9.0.0 or higher
- **Xcode Command Line Tools** (macOS): `xcode-select --install`

### 2. Clone the Repository
```bash
git clone https://github.com/sahilkumarsahoo/Copy-To-Clipboard.git
cd Copy-To-Clipboard
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Compile the Native macOS Paste Helper
On macOS, paste keystrokes are injected via a compiled C/Objective-C binary utilizing CoreGraphics `CGEventPostToPid`:
```bash
mkdir -p bin
clang -framework ApplicationServices -framework Cocoa native/paste-helper-mac.m -o bin/paste-helper-mac
chmod +x bin/paste-helper-mac
```

### 5. Package the Standalone Application
```bash
npx electron-builder --mac dir
```
*(On Linux, use `npx electron-builder --linux dir`)*

### 6. Install to `/Applications`
```bash
killall ClipboardManager 2>/dev/null || true
rm -rf /Applications/ClipboardManager.app
cp -R "dist/mac-arm64/ClipboardManager.app" /Applications/ClipboardManager.app
xattr -cr /Applications/ClipboardManager.app
```
*(Note: If using an Intel Mac, use `dist/mac/ClipboardManager.app`)*

### 7. Launch the Application
```bash
open /Applications/ClipboardManager.app
```

---

## 🔐 Granting macOS Accessibility Permissions

> [!IMPORTANT]
> macOS Sonoma, Sequoia, and Ventura require Accessibility authorization for applications that inject synthetic keystrokes (auto-pasting into other applications).

When Clipboard Manager runs for the first time, macOS will automatically prompt you to grant Accessibility access:

1. Open **System Settings**.
2. Navigate to **Privacy & Security** → **Accessibility**.
3. Locate **ClipboardManager** in the list.
4. Toggle the switch to **ON** (blue).
5. If prompted, authenticate with your Mac password or Touch ID.

```
System Settings
 └── Privacy & Security
      └── Accessibility
           └── [✓] ClipboardManager  <-- ENABLE THIS
```

> [!TIP]
> You can also check your permission status anytime by clicking the Menu Bar tray icon and selecting **"Check Accessibility Permission"**.

---

## 🔄 Automatic Startup on System Restart

Clipboard Manager is designed to function as an invisible, zero-maintenance background daemon:

- **Built-in Startup**: During initial launch, the app automatically registers with **macOS Login Items**.
- **Verification**:
  - Open **System Settings** → **General** → **Login Items**.
  - Confirm **ClipboardManager** is listed under **"Open at Login"**.
- **Reboot Test**:
  - Restart your Mac.
  - The app will start silently in the background without opening any distracting windows.
  - Press `Cmd + Shift + V` at any time to verify that your clipboard HUD appears instantly.
- **Toggling Autostart**:
  - Open the **About** window (by clicking ClipboardManager in Applications or via the Menu Bar).
  - Toggle the **"Launch at Startup"** switch ON or OFF.

---

## 🗑️ How to Uninstall

Clipboard Manager includes both a **one-click GUI uninstaller** and a manual removal command.

### Method 1: Built-in GUI Uninstaller (Recommended)
1. Open the **About** window:
   - Click **ClipboardManager** in your `/Applications` list, **OR**
   - Click the Menu Bar icon and select **"About Clipboard Manager..."**.
2. Click **"Uninstall Clipboard Manager"** at the bottom.
3. A confirmation modal will appear:
   > *"Would you like to uninstall this application? This will remove the app bundle and unregister startup launch."*
4. Optionally check *"Also delete saved clipboard history"* if you want a complete wipe.
5. Click **"Yes, Uninstall"**. The app unregisters from login items, safely removes `/Applications/ClipboardManager.app`, and exits.

### Method 2: Manual Removal via Terminal
```bash
# 1. Stop the running process
killall ClipboardManager 2>/dev/null || true

# 2. Remove the application bundle
rm -rf /Applications/ClipboardManager.app

# 3. (Optional) Wipe clipboard history database and assets
rm -rf "$HOME/Library/Application Support/clipboard-history"
```
