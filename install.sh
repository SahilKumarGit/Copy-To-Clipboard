#!/usr/bin/env bash
# ==============================================================================
# Clipboard Manager - One-Line Installer & Launcher
# Supports: macOS (Apple Silicon / Intel) & Ubuntu / Debian Linux
# ==============================================================================

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
echo "  ╔═══════════════════════════════════════════════════════╗"
echo "  ║          CLIPBOARD MANAGER - INSTALLER & SETUP         ║"
echo "  ╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

OS="$(uname -s)"
ARCH="$(uname -m)"

# 1. Detect Working Directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
if [ ! -f "$SCRIPT_DIR/package.json" ]; then
  # If executed via curl | bash into arbitrary directory, clone into a standard directory
  TARGET_DIR="$HOME/.clipboard-manager-app"
  echo -e "${YELLOW}ℹ Installing into $TARGET_DIR...${NC}"
  if [ -d "$TARGET_DIR" ]; then
    cd "$TARGET_DIR"
    git pull --quiet || true
  else
    git clone --quiet https://github.com/sahilkumarsahoo/Copy-To-Clipboard.git "$TARGET_DIR" || {
      echo -e "${RED}❌ Failed to clone repository. Please check your internet connection.${NC}"
      exit 1
    }
    cd "$TARGET_DIR"
  fi
  SCRIPT_DIR="$TARGET_DIR"
else
  cd "$SCRIPT_DIR"
fi

# 2. Check Node.js and npm
echo -e "${CYAN}→ Checking prerequisites...${NC}"
if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}❌ Node.js is not installed. Please install Node.js v18+ from https://nodejs.org or via brew/apt.${NC}"
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo -e "${RED}❌ npm is not installed. Please install npm.${NC}"
  exit 1
fi

NODE_VER="$(node -v)"
echo -e "${GREEN}✓ Node.js detected: $NODE_VER${NC}"

# 3. Install NPM Dependencies
if [ ! -d "node_modules" ]; then
  echo -e "${CYAN}→ Installing dependencies...${NC}"
  npm install --prefer-offline --no-audit --loglevel=error
else
  echo -e "${GREEN}✓ Dependencies already installed.${NC}"
fi

# 4. Build Native Paste Helper (macOS only)
if [ "$OS" = "Darwin" ]; then
  echo -e "${CYAN}→ Checking native macOS injector binary...${NC}"
  mkdir -p bin
  if [ ! -f "bin/paste-helper-mac" ] || [ "native/paste-helper-mac.m" -nt "bin/paste-helper-mac" ]; then
    echo -e "${CYAN}→ Compiling native paste injector with Clang...${NC}"
    clang -framework ApplicationServices -framework Cocoa native/paste-helper-mac.m -o bin/paste-helper-mac
    chmod +x bin/paste-helper-mac
    echo -e "${GREEN}✓ Native paste helper compiled successfully.${NC}"
  else
    echo -e "${GREEN}✓ Native paste helper is up to date.${NC}"
  fi
fi

# 5. Build and Deploy
if [ "$OS" = "Darwin" ]; then
  echo -e "${CYAN}→ Building macOS Application Bundle (.app)...${NC}"
  npx electron-builder --mac dir --publish never >/dev/null 2>&1

  # Locate output .app
  APP_OUT_DIR="dist/mac-arm64"
  if [ "$ARCH" = "x86_64" ] && [ -d "dist/mac" ]; then
    APP_OUT_DIR="dist/mac"
  fi

  BUILT_APP="$APP_OUT_DIR/ClipboardManager.app"
  if [ ! -d "$BUILT_APP" ]; then
    BUILT_APP="$(find dist -name 'ClipboardManager.app' -type d -maxdepth 2 | head -n 1)"
  fi

  if [ -z "$BUILT_APP" ] || [ ! -d "$BUILT_APP" ]; then
    echo -e "${RED}❌ Failed to locate built ClipboardManager.app bundle.${NC}"
    exit 1
  fi

  echo -e "${CYAN}→ Installing to /Applications/ClipboardManager.app...${NC}"
  killall ClipboardManager 2>/dev/null || true
  sleep 0.5
  rm -rf "/Applications/ClipboardManager.app"
  cp -R "$BUILT_APP" "/Applications/ClipboardManager.app"
  
  # Remove macOS Gatekeeper quarantine flag
  xattr -cr "/Applications/ClipboardManager.app" 2>/dev/null || true

  echo -e "${GREEN}✓ Successfully installed to /Applications/ClipboardManager.app${NC}"

  # Launch application
  echo -e "${CYAN}→ Launching Clipboard Manager daemon...${NC}"
  open "/Applications/ClipboardManager.app"

  echo ""
  echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}${BOLD}🎉 Installation Complete! Clipboard Manager is now active.${NC}"
  echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${BOLD}Global Shortcut:${NC}    ${CYAN}Cmd + Shift + V${NC}"
  echo -e "  ${BOLD}Auto-Start on Boot:${NC} ${GREEN}Enabled automatically${NC}"
  echo -e "  ${BOLD}App Details/About:${NC}  Click app in Applications or click Menu Bar icon"
  echo ""
  echo -e "${YELLOW}${BOLD}⚠️  IMPORTANT: macOS Accessibility Permission${NC}"
  echo -e "  For automatic paste injection into active apps, macOS requires"
  echo -e "  Accessibility permissions. If prompted by macOS, please allow"
  echo -e "  ${BOLD}ClipboardManager${NC} in ${BOLD}System Settings → Privacy & Security → Accessibility${NC}."
  echo ""

elif [ "$OS" = "Linux" ]; then
  echo -e "${CYAN}→ Building Linux Application Package...${NC}"
  npx electron-builder --linux dir --publish never >/dev/null 2>&1

  LINUX_OUT_DIR="dist/linux-unpacked"
  if [ ! -d "$LINUX_OUT_DIR" ]; then
    echo -e "${RED}❌ Failed to locate Linux build directory.${NC}"
    exit 1
  fi

  INSTALL_PREFIX="$HOME/.local/share/clipboard-manager"
  mkdir -p "$INSTALL_PREFIX"
  cp -R "$LINUX_OUT_DIR/"* "$INSTALL_PREFIX/"

  mkdir -p "$HOME/.local/bin"
  ln -sf "$INSTALL_PREFIX/clipboard-manager" "$HOME/.local/bin/clipboard-manager"

  # Create Desktop Launcher
  DESKTOP_DIR="$HOME/.local/share/applications"
  mkdir -p "$DESKTOP_DIR"
  cat <<EOF > "$DESKTOP_DIR/clipboard-manager.desktop"
[Desktop Entry]
Type=Application
Name=Clipboard Manager
Exec=$INSTALL_PREFIX/clipboard-manager %U
Icon=$INSTALL_PREFIX/resources/icon.png
Terminal=false
Categories=Utility;
EOF

  # Setup Autostart on boot
  AUTOSTART_DIR="$HOME/.config/autostart"
  mkdir -p "$AUTOSTART_DIR"
  cat <<EOF > "$AUTOSTART_DIR/clipboard-manager.desktop"
[Desktop Entry]
Type=Application
Name=Clipboard Manager
Exec=$INSTALL_PREFIX/clipboard-manager --hidden
Terminal=false
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF

  echo -e "${GREEN}✓ Successfully installed to $INSTALL_PREFIX${NC}"
  nohup "$INSTALL_PREFIX/clipboard-manager" >/dev/null 2>&1 &

  echo ""
  echo -e "${GREEN}${BOLD}🎉 Installation Complete! Clipboard Manager is running.${NC}"
  echo -e "  ${BOLD}Global Shortcut:${NC} ${CYAN}Ctrl + Shift + V${NC}"
  echo ""
else
  echo -e "${RED}❌ Unsupported Operating System: $OS${NC}"
  exit 1
fi
