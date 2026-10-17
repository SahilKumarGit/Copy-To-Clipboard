# 🛡️ macOS Accessibility Permission Guide

This guide provides step-by-step instructions for granting **Accessibility Permissions** to **Clipboard Manager** on macOS (Sequoia, Sonoma, Ventura, and earlier).

---

## ❓ Why Is Accessibility Permission Required?

macOS requires explicit authorization for applications that inject synthetic keystrokes into other apps. 

When you click an item in Clipboard Manager, the app automatically:
1. Copies the selected snippet or image to the system clipboard.
2. Hides the popup and restores focus to your active application (e.g., VS Code, Chrome, Terminal, Slack).
3. Synthesizes a native **`Cmd + V`** keystroke so the content is pasted instantly without manual pasting.

Without Accessibility permissions, macOS blocks the synthetic paste event, requiring you to manually press `Cmd + V`.

---

## 🧭 Step-by-Step Instructions

```
Apple Menu ()
 └── System Settings
      └── Privacy & Security
           └── Accessibility
                └── [✓] ClipboardManager  <-- Turn ON
```

### Step 1: Open Accessibility Settings
- Click the **Grant** button inside Clipboard Manager, **OR**
- Click the Apple logo () in the top-left corner of your menu bar → **System Settings...**

---

### Step 2: Navigate to Accessibility
1. In the sidebar on the left, scroll down and click **Privacy & Security**.
2. In the right panel, scroll down to the **Privacy** section and click **Accessibility**.

---

### Step 3: Enable ClipboardManager
1. Look for **ClipboardManager** in the list of applications.
2. Click the toggle switch next to **ClipboardManager** so that it turns **ON (Blue)**.
3. If prompted by macOS, enter your Mac password or use Touch ID to confirm the change.

```
┌────────────────────────────────────────────────────────────────┐
│  < Privacy & Security    Accessibility                         │
├────────────────────────────────────────────────────────────────┤
│  Allow the applications below to control your computer.        │
│                                                                │
│  [icon]  ClipboardManager                           [  ON  ]   │
│  [icon]  Terminal                                   [ OFF  ]   │
│                                                                │
│  [ + ] [ - ]                                                   │
└────────────────────────────────────────────────────────────────┘
```

---

## 🔍 What if ClipboardManager is NOT in the list?

If macOS did not automatically register ClipboardManager in the Accessibility list:

1. Click the **`+`** (Plus) button at the bottom of the Accessibility list.
2. Authenticate with your Mac password or Touch ID if prompted.
3. In the file picker dialog:
   - Go to your **Applications** folder (`/Applications`).
   - Select **ClipboardManager** (or `ClipboardManager.app`).
   - Click **Open**.
4. Ensure the toggle switch next to **ClipboardManager** is set to **ON (Blue)**.

---

## 🔧 Troubleshooting

### 1. Replaced or updated app, but auto-paste stopped working?
When an app is updated or reinstalled, macOS may keep the previous signature in its privacy database (`TCC.db`), preventing the new version from being trusted.

**Fix:**
1. Open **System Settings → Privacy & Security → Accessibility**.
2. Select **ClipboardManager** from the list.
3. Click the **`-`** (Minus) button at the bottom to remove it.
4. Click the **`+`** (Plus) button and add `/Applications/ClipboardManager.app` back.
5. Toggle the switch to **ON**.

Or run this command in Terminal to reset the permission:
```bash
tccutil reset Accessibility com.clipboard.manager
```
Then restart the app and grant permission when prompted.

---

### 2. Still seeing the yellow warning banner?
- The banner checks permissions in real-time. As soon as you toggle the switch to ON in System Settings, switch back to Clipboard Manager (press `Cmd + Shift + V`), and the warning banner will automatically disappear.

---

## 🚀 Quick Terminal Verification
You can verify if Accessibility is currently granted by running:
```bash
/Applications/ClipboardManager.app/Contents/Resources/app.asar.unpacked/bin/paste-helper-mac --check-ax
```
- Outputs `1`: Permission is **granted and active**.
- Outputs `0`: Permission is **not granted**.
