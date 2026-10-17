#!/usr/bin/env bash
# ==============================================================================
# Clipboard Manager - Instant Prebuilt Binary Installer & Launcher
# Installs official pre-built releases directly without downloading source or building
# Supports: macOS (Apple Silicon & Intel) & Ubuntu / Debian Linux
# ==============================================================================

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

GITHUB_REPO="SahilKumarGit/Copy-To-Clipboard"
REQUESTED_VERSION="${1:-${VERSION:-latest}}"

echo -e "${CYAN}${BOLD}"
echo "  ╔═══════════════════════════════════════════════════════╗"
echo "  ║          CLIPBOARD MANAGER - INSTANT INSTALLER        ║"
echo "  ╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

OS="$(uname -s)"
ARCH="$(uname -m)"

# ------------------------------------------------------------------------------
# 1. Fallback: Build from Source
# ------------------------------------------------------------------------------
build_from_source() {
  echo -e "${YELLOW}ℹ Building from source locally...${NC}"
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

  if [ ! -f "$SCRIPT_DIR/package.json" ]; then
    TARGET_DIR="$HOME/.clipboard-manager-app"
    echo -e "${YELLOW}ℹ Cloning repository into $TARGET_DIR...${NC}"
    rm -rf "$TARGET_DIR"
    git clone --depth 1 "https://github.com/${GITHUB_REPO}.git" "$TARGET_DIR"
    cd "$TARGET_DIR"
  else
    cd "$SCRIPT_DIR"
  fi

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo -e "${RED}❌ Node.js and npm are required to build from source.${NC}"
    exit 1
  fi

  npm install --prefer-offline --no-audit --loglevel=error
  mkdir -p bin
  if [ "$OS" = "Darwin" ]; then
    clang -Wall -Wextra -Werror -Wno-deprecated-declarations -framework ApplicationServices -framework Cocoa -framework Carbon native/paste-helper-mac.m -o bin/paste-helper-mac
    chmod +x bin/paste-helper-mac
    npx electron-builder --mac dir --publish never >/dev/null 2>&1
    
    APP_OUT="dist/mac-arm64/ClipboardManager.app"
    [ "$ARCH" = "x86_64" ] && APP_OUT="dist/mac/ClipboardManager.app"
    [ ! -d "$APP_OUT" ] && APP_OUT="$(find dist -name 'ClipboardManager.app' -type d | head -n 1)"

    killall ClipboardManager 2>/dev/null || true
    rm -rf "/Applications/ClipboardManager.app"
    cp -R "$APP_OUT" "/Applications/ClipboardManager.app"
    xattr -cr "/Applications/ClipboardManager.app" 2>/dev/null || true

    LAUNCH_AGENT_DIR="$HOME/Library/LaunchAgents"
    PLIST_PATH="$LAUNCH_AGENT_DIR/com.clipboardmanager.app.plist"
    mkdir -p "$LAUNCH_AGENT_DIR"
    cat <<'EOF' > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.clipboardmanager.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/ClipboardManager.app/Contents/MacOS/ClipboardManager</string>
        <string>--hidden</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>2</integer>
    <key>ProcessType</key>
    <string>Interactive</string>
</dict>
</plist>
EOF
    launchctl load -w "$PLIST_PATH" 2>/dev/null || true

    open "/Applications/ClipboardManager.app"
  fi
  echo -e "${GREEN}✓ Successfully built and installed from source!${NC}"
  exit 0
}

# If user explicitly requested building from source
if [ "$1" = "--build" ] || [ "$1" = "--source" ]; then
  build_from_source
fi

# ------------------------------------------------------------------------------
# 2. Fetch Release from GitHub API
# ------------------------------------------------------------------------------
echo -e "${CYAN}→ Locating release for ${BOLD}${OS} (${ARCH})${NC}..."

if [ "$REQUESTED_VERSION" = "latest" ]; then
  API_URL="https://api.github.com/repos/${GITHUB_REPO}/releases/latest"
else
  # Strip leading v if needed for lookup or match tag
  TAG="$REQUESTED_VERSION"
  [[ "$TAG" != v* ]] && TAG="v$TAG"
  API_URL="https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${TAG}"
fi

RELEASE_DATA="$(curl -fsSL -H "Accept: application/vnd.github.v3+json" "$API_URL" 2>/dev/null || true)"

if [ -z "$RELEASE_DATA" ] || echo "$RELEASE_DATA" | grep -q '"message": "Not Found"'; then
  echo -e "${YELLOW}⚠️  No pre-built GitHub release found for version: ${REQUESTED_VERSION}.${NC}"
  # Check if package.json is present locally
  if [ -f "package.json" ]; then
    echo -e "${CYAN}→ Falling back to local build...${NC}"
    build_from_source
  else
    echo -e "${RED}❌ Could not find prebuilt release and no local source available.${NC}"
    echo -e "   Please visit: https://github.com/${GITHUB_REPO}/releases"
    exit 1
  fi
fi

# Extract Tag and Download URL
RELEASE_TAG="$(echo "$RELEASE_DATA" | grep -m 1 '"tag_name":' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')"
echo -e "${GREEN}✓ Found Release: ${BOLD}${RELEASE_TAG}${NC}"

DOWNLOAD_URL=""
if [ "$OS" = "Darwin" ]; then
  if [ "$ARCH" = "arm64" ]; then
    # Apple Silicon pattern
    DOWNLOAD_URL="$(echo "$RELEASE_DATA" | grep -o 'https://[^"]*arm64-mac\.zip' | head -n 1)"
  else
    # Intel x86_64 pattern
    DOWNLOAD_URL="$(echo "$RELEASE_DATA" | grep -o 'https://[^"]*[^4]-mac\.zip' | head -n 1)"
  fi
  # Fallback to any mac zip
  if [ -z "$DOWNLOAD_URL" ]; then
    DOWNLOAD_URL="$(echo "$RELEASE_DATA" | grep -o 'https://[^"]*-mac\.zip' | head -n 1)"
  fi
elif [ "$OS" = "Linux" ]; then
  DOWNLOAD_URL="$(echo "$RELEASE_DATA" | grep -o 'https://[^"]*\.AppImage' | head -n 1)"
  if [ -z "$DOWNLOAD_URL" ]; then
    DOWNLOAD_URL="$(echo "$RELEASE_DATA" | grep -o 'https://[^"]*\.tar\.gz' | head -n 1)"
  fi
fi

if [ -z "$DOWNLOAD_URL" ]; then
  echo -e "${YELLOW}⚠️  Prebuilt binary for ${OS} (${ARCH}) is not available in ${RELEASE_TAG}.${NC}"
  build_from_source
fi

# ------------------------------------------------------------------------------
# 3. Download and Install Prebuilt Binary
# ------------------------------------------------------------------------------
TMP_DIR="$(mktemp -d /tmp/clipboard-install.XXXXXX)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

FILE_NAME="$(basename "$DOWNLOAD_URL")"
echo -e "${CYAN}→ Downloading ${BOLD}${FILE_NAME}${NC}..."
curl -# -fL "$DOWNLOAD_URL" -o "$TMP_DIR/$FILE_NAME"

if [ "$OS" = "Darwin" ]; then
  echo -e "${CYAN}→ Extracting application bundle...${NC}"
  unzip -q "$TMP_DIR/$FILE_NAME" -d "$TMP_DIR/extracted"

  EXTRACTED_APP="$(find "$TMP_DIR/extracted" -name "ClipboardManager.app" -type d | head -n 1)"
  if [ -z "$EXTRACTED_APP" ] || [ ! -d "$EXTRACTED_APP" ]; then
    echo -e "${RED}❌ Failed to extract ClipboardManager.app from downloaded release.${NC}"
    exit 1
  fi

  echo -e "${CYAN}→ Installing to /Applications/ClipboardManager.app...${NC}"
  killall ClipboardManager 2>/dev/null || true
  sleep 0.5
  rm -rf "/Applications/ClipboardManager.app"
  cp -R "$EXTRACTED_APP" "/Applications/ClipboardManager.app"

  # Strip macOS Gatekeeper quarantine flag
  xattr -cr "/Applications/ClipboardManager.app" 2>/dev/null || true

  # Setup LaunchAgent for background persistence
  LAUNCH_AGENT_DIR="$HOME/Library/LaunchAgents"
  PLIST_PATH="$LAUNCH_AGENT_DIR/com.clipboardmanager.app.plist"
  mkdir -p "$LAUNCH_AGENT_DIR"
  cat <<'EOF' > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.clipboardmanager.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/ClipboardManager.app/Contents/MacOS/ClipboardManager</string>
        <string>--hidden</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>2</integer>
    <key>ProcessType</key>
    <string>Interactive</string>
</dict>
</plist>
EOF
  launchctl load -w "$PLIST_PATH" 2>/dev/null || true

  echo -e "${GREEN}✓ Successfully installed to /Applications/ClipboardManager.app${NC}"

  # Launch application
  echo -e "${CYAN}→ Launching Clipboard Manager daemon...${NC}"
  open "/Applications/ClipboardManager.app"

  echo ""
  echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}${BOLD}🎉 Installation Complete! Clipboard Manager is active.${NC}"
  echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${BOLD}Installed Version:${NC}  ${GREEN}${RELEASE_TAG}${NC}"
  echo -e "  ${BOLD}Global Shortcut:${NC}    ${CYAN}Cmd + Shift + V${NC}"
  echo -e "  ${BOLD}Auto-Start on Boot:${NC} ${GREEN}Enabled automatically${NC}"
  echo -e "  ${BOLD}App Details/About:${NC}  Click app in Applications or Menu Bar icon"
  echo ""
  echo -e "${YELLOW}${BOLD}⚠️  IMPORTANT: macOS Accessibility Permission${NC}"
  echo -e "  For automatic paste injection into active apps, macOS requires"
  echo -e "  Accessibility permissions. If prompted by macOS, please allow"
  echo -e "  ${BOLD}ClipboardManager${NC} in ${BOLD}System Settings → Privacy & Security → Accessibility${NC}."
  echo ""

elif [ "$OS" = "Linux" ]; then
  INSTALL_DIR="$HOME/.local/bin"
  mkdir -p "$INSTALL_DIR"

  if [[ "$FILE_NAME" == *.AppImage ]]; then
    chmod +x "$TMP_DIR/$FILE_NAME"
    mv "$TMP_DIR/$FILE_NAME" "$INSTALL_DIR/clipboard-manager"
  elif [[ "$FILE_NAME" == *.tar.gz ]]; then
    tar -xzf "$TMP_DIR/$FILE_NAME" -C "$TMP_DIR"
    BIN="$(find "$TMP_DIR" -type f -name "clipboard-manager" | head -n 1)"
    chmod +x "$BIN"
    mv "$BIN" "$INSTALL_DIR/clipboard-manager"
  fi

  # Setup autostart
  AUTOSTART_DIR="$HOME/.config/autostart"
  mkdir -p "$AUTOSTART_DIR"
  cat <<EOF > "$AUTOSTART_DIR/clipboard-manager.desktop"
[Desktop Entry]
Type=Application
Name=Clipboard Manager
Exec=$INSTALL_DIR/clipboard-manager --hidden
Terminal=false
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF

  nohup "$INSTALL_DIR/clipboard-manager" >/dev/null 2>&1 &
  echo -e "${GREEN}✓ Successfully installed Clipboard Manager ${RELEASE_TAG}!${NC}"
  echo -e "  ${BOLD}Global Shortcut:${NC} ${CYAN}Ctrl + Shift + V${NC}"
fi
