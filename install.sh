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
# Reinstall even when the installed version is already the latest: `bash -s -- --force` or FORCE=1
FORCE="${FORCE:-0}"
if [ "$1" = "--force" ]; then
  FORCE=1
  shift
fi
REQUESTED_VERSION="${1:-${VERSION:-latest}}"

echo -e "${CYAN}${BOLD}"
echo "  ╔═══════════════════════════════════════════════════════╗"
echo "  ║          CLIPBOARD MANAGER - INSTANT INSTALLER        ║"
echo "  ╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

OS="$(uname -s)"
ARCH="$(uname -m)"

# Stop every running copy matching the pattern before files are replaced. Versions up to 1.0.7 ignore
# SIGTERM, and a process left running against a replaced bundle shows corrupted windows, so escalate.
stop_running_app() {
  local pattern="$1"
  pgrep -f "$pattern" >/dev/null 2>&1 || return 0
  echo -e "${CYAN}→ Stopping the running Clipboard Manager...${NC}"
  pkill -TERM -f "$pattern" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    pgrep -f "$pattern" >/dev/null 2>&1 || return 0
    sleep 0.3
  done
  pkill -KILL -f "$pattern" 2>/dev/null || true
  sleep 0.5
  if pgrep -f "$pattern" >/dev/null 2>&1; then
    echo -e "${RED}❌ Could not stop the running Clipboard Manager. Quit it from the menu bar and run the installer again.${NC}"
    exit 1
  fi
}

# LaunchServices can hand `open` to a copy that is still shutting down, so confirm it started
launch_mac_app() {
  for _ in 1 2; do
    open "/Applications/ClipboardManager.app" --args --hidden
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      pgrep -f "ClipboardManager.app/Contents/MacOS/ClipboardManager" >/dev/null 2>&1 && return 0
      sleep 0.5
    done
  done
  echo -e "${YELLOW}⚠️  Clipboard Manager did not start. Open it from /Applications.${NC}"
}

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

    stop_running_app "ClipboardManager.app/Contents/"
    rm -rf "/Applications/ClipboardManager.app"
    cp -R "$APP_OUT" "/Applications/ClipboardManager.app"
    xattr -cr "/Applications/ClipboardManager.app" 2>/dev/null || true

    # Clean up any legacy launch agent plist to prevent restart loops
    LAUNCH_AGENT_DIR="$HOME/Library/LaunchAgents"
    PLIST_PATH="$LAUNCH_AGENT_DIR/com.clipboardmanager.app.plist"
    launchctl bootout "gui/$(id -u)/com.clipboardmanager.app" 2>/dev/null || launchctl unload -w "$PLIST_PATH" 2>/dev/null || true
    rm -f "$PLIST_PATH" 2>/dev/null || true

    launch_mac_app
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
RELEASE_VERSION="${RELEASE_TAG#v}"
echo -e "${GREEN}✓ Found Release: ${BOLD}${RELEASE_TAG}${NC}"

# First release asset whose URL matches the given pattern
asset_url() {
  echo "$RELEASE_DATA" | grep -o "https://[^\"]*$1" | head -n 1
}

MAC_APP="/Applications/ClipboardManager.app"
LINUX_BIN_DIR="$HOME/.local/bin"
LINUX_APP_DIR="$HOME/.local/share/clipboard-manager"

DOWNLOAD_URL=""
if [ "$OS" = "Darwin" ]; then
  MAC_ARCH="arm64"
  [ "$ARCH" = "x86_64" ] && MAC_ARCH="x64"
  # .tar.xz is ~40% smaller than .zip; older releases only ship .zip
  DOWNLOAD_URL="$(asset_url "${MAC_ARCH}-mac\.tar\.xz")"
  [ -z "$DOWNLOAD_URL" ] && DOWNLOAD_URL="$(asset_url "${MAC_ARCH}-mac\.zip")"
  if [ -z "$DOWNLOAD_URL" ] && [ "$MAC_ARCH" = "x64" ]; then
    DOWNLOAD_URL="$(asset_url "[^4]-mac\.zip")"
  fi
  [ -z "$DOWNLOAD_URL" ] && DOWNLOAD_URL="$(asset_url "-mac\.zip")"

  INSTALLED_VERSION="$(defaults read "$MAC_APP/Contents/Info.plist" CFBundleShortVersionString 2>/dev/null || true)"
elif [ "$OS" = "Linux" ]; then
  LINUX_ARCH="x64"
  [ "$ARCH" = "aarch64" ] && LINUX_ARCH="arm64"
  DOWNLOAD_URL="$(asset_url "${LINUX_ARCH}-linux\.tar\.xz")"
  # Older releases only ship an AppImage
  [ -z "$DOWNLOAD_URL" ] && DOWNLOAD_URL="$(asset_url "\.AppImage")"

  INSTALLED_VERSION="$(cat "$LINUX_APP_DIR/VERSION" 2>/dev/null || true)"
fi

if [ -z "$DOWNLOAD_URL" ]; then
  echo -e "${YELLOW}⚠️  Prebuilt binary for ${OS} (${ARCH}) is not available in ${RELEASE_TAG}.${NC}"
  build_from_source
fi

# ------------------------------------------------------------------------------
# 3. Skip the download when this version is already installed
# ------------------------------------------------------------------------------
if [ "$FORCE" != "1" ] && [ -n "$INSTALLED_VERSION" ] && [ "${INSTALLED_VERSION#v}" = "$RELEASE_VERSION" ]; then
  echo -e "${GREEN}✓ Clipboard Manager ${RELEASE_TAG} is already installed and up to date.${NC}"
  if [ "$OS" = "Darwin" ]; then
    pgrep -f "$MAC_APP/Contents/MacOS/ClipboardManager" >/dev/null || launch_mac_app
  else
    pgrep -f "$LINUX_APP_DIR/clipboard-manager" >/dev/null || nohup "$LINUX_BIN_DIR/clipboard-manager" --hidden >/dev/null 2>&1 &
  fi
  echo -e "  To reinstall anyway: ${CYAN}curl -fsSL https://raw.githubusercontent.com/${GITHUB_REPO}/main/install.sh | bash -s -- --force${NC}"
  exit 0
fi

# ------------------------------------------------------------------------------
# 4. Download and Install Prebuilt Binary
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
  mkdir -p "$TMP_DIR/extracted"
  if [[ "$FILE_NAME" == *.tar.xz ]]; then
    tar -xJf "$TMP_DIR/$FILE_NAME" -C "$TMP_DIR/extracted"
  else
    unzip -q "$TMP_DIR/$FILE_NAME" -d "$TMP_DIR/extracted"
  fi

  EXTRACTED_APP="$(find "$TMP_DIR/extracted" -name "ClipboardManager.app" -type d -prune | head -n 1)"
  if [ -z "$EXTRACTED_APP" ] || [ ! -d "$EXTRACTED_APP" ]; then
    echo -e "${RED}❌ Failed to extract ClipboardManager.app from downloaded release.${NC}"
    exit 1
  fi

  echo -e "${CYAN}→ Installing to ${MAC_APP}...${NC}"
  stop_running_app "ClipboardManager.app/Contents/"
  rm -rf "$MAC_APP"
  # Same volume as /tmp, so a move is instant compared to copying ~220 MB
  mv "$EXTRACTED_APP" "$MAC_APP" 2>/dev/null || cp -R "$EXTRACTED_APP" "$MAC_APP"

  # Strip macOS Gatekeeper quarantine flag
  xattr -cr "$MAC_APP" 2>/dev/null || true

  # Clean up any legacy launch agent plist to prevent restart loops
  LAUNCH_AGENT_DIR="$HOME/Library/LaunchAgents"
  PLIST_PATH="$LAUNCH_AGENT_DIR/com.clipboardmanager.app.plist"
  launchctl bootout "gui/$(id -u)/com.clipboardmanager.app" 2>/dev/null || launchctl unload -w "$PLIST_PATH" 2>/dev/null || true
  rm -f "$PLIST_PATH" 2>/dev/null || true

  echo -e "${GREEN}✓ Successfully installed to ${MAC_APP}${NC}"

  # Launch application in background daemon mode
  echo -e "${CYAN}→ Launching Clipboard Manager daemon...${NC}"
  launch_mac_app

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
  mkdir -p "$LINUX_BIN_DIR"

  # Stop the running copy first: the app is single-instance, so a new launch would just exit
  stop_running_app "$LINUX_APP_DIR/clipboard-manager"
  stop_running_app "$LINUX_BIN_DIR/clipboard-manager"
  stop_running_app "/copy-to-clipboard( |$)"

  EXTRA_FLAGS=""
  if [[ "$FILE_NAME" == *.tar.xz ]]; then
    echo -e "${CYAN}→ Extracting application...${NC}"
    tar -xJf "$TMP_DIR/$FILE_NAME" -C "$TMP_DIR"
    EXTRACTED_BIN="$(find "$TMP_DIR" -type f -name clipboard-manager -perm -u+x | head -n 1)"
    if [ -z "$EXTRACTED_BIN" ]; then
      echo -e "${RED}❌ Failed to find the clipboard-manager executable in the downloaded release.${NC}"
      exit 1
    fi
    rm -rf "$LINUX_APP_DIR"
    mkdir -p "$(dirname "$LINUX_APP_DIR")"
    mv "$(dirname "$EXTRACTED_BIN")" "$LINUX_APP_DIR"
    echo "$RELEASE_VERSION" > "$LINUX_APP_DIR/VERSION"
    APP_EXEC="$LINUX_APP_DIR/clipboard-manager"

    # Ubuntu 23.10+ blocks the unprivileged user namespaces Chromium's sandbox needs. Use the
    # setuid sandbox helper instead (one sudo prompt), or fall back to running without the sandbox.
    USERNS_RESTRICTED=0
    [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" = "1" ] && USERNS_RESTRICTED=1
    [ "$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null)" = "0" ] && USERNS_RESTRICTED=1
    if [ "$USERNS_RESTRICTED" = "1" ] && [ -f "$LINUX_APP_DIR/chrome-sandbox" ]; then
      echo -e "${CYAN}→ Configuring the Chromium sandbox helper (requires sudo)...${NC}"
      if ! { sudo chown root:root "$LINUX_APP_DIR/chrome-sandbox" && sudo chmod 4755 "$LINUX_APP_DIR/chrome-sandbox"; } </dev/tty; then
        echo -e "${YELLOW}⚠️  Could not configure the sandbox helper; running without the Chromium sandbox.${NC}"
        EXTRA_FLAGS=" --no-sandbox"
      fi
    fi
  else
    # Legacy AppImage release
    chmod +x "$TMP_DIR/$FILE_NAME"
    rm -rf "$LINUX_APP_DIR"
    mkdir -p "$LINUX_APP_DIR"
    mv "$TMP_DIR/$FILE_NAME" "$LINUX_APP_DIR/clipboard-manager.AppImage"
    echo "$RELEASE_VERSION" > "$LINUX_APP_DIR/VERSION"
    APP_EXEC="$LINUX_APP_DIR/clipboard-manager.AppImage"
  fi

  # Auto-paste sends Ctrl+V through xdotool, which Ubuntu doesn't ship. Without it the selected item
  # only lands on the clipboard and nothing gets pasted.
  if ! command -v xdotool >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
      echo -e "${CYAN}→ Installing xdotool for auto-paste (requires sudo)...${NC}"
      if ! { sudo apt-get install -y xdotool >/dev/null; } </dev/tty; then
        echo -e "${YELLOW}⚠️  Could not install xdotool. Auto-paste needs it: sudo apt install xdotool${NC}"
      fi
    else
      echo -e "${YELLOW}⚠️  Auto-paste needs xdotool. Install it with your package manager.${NC}"
    fi
  fi
  if [ "${XDG_SESSION_TYPE:-}" = "wayland" ]; then
    echo -e "${YELLOW}ℹ Wayland session: auto-paste works in X11/XWayland apps. For native Wayland apps,${NC}"
    echo -e "${YELLOW}  log in with \"Ubuntu on Xorg\" or paste manually with Ctrl+V after picking an item.${NC}"
  fi

  # Stable launcher: the app writes this path (not its own binary) into its autostart entry
  rm -f "$LINUX_BIN_DIR/clipboard-manager"
  cat <<EOF > "$LINUX_BIN_DIR/clipboard-manager"
#!/usr/bin/env bash
export CLIPBOARD_MANAGER_LAUNCHER="$LINUX_BIN_DIR/clipboard-manager"
exec "$APP_EXEC"$EXTRA_FLAGS "\$@"
EOF
  chmod +x "$LINUX_BIN_DIR/clipboard-manager"

  # Setup autostart
  AUTOSTART_DIR="$HOME/.config/autostart"
  mkdir -p "$AUTOSTART_DIR"
  cat <<EOF > "$AUTOSTART_DIR/clipboard-manager.desktop"
[Desktop Entry]
Type=Application
Name=Clipboard Manager
Exec="$LINUX_BIN_DIR/clipboard-manager" --hidden
Terminal=false
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF

  nohup "$LINUX_BIN_DIR/clipboard-manager" >/dev/null 2>&1 &
  echo -e "${GREEN}✓ Successfully installed Clipboard Manager ${RELEASE_TAG}!${NC}"
  echo -e "  ${BOLD}Global Shortcut:${NC} ${CYAN}Ctrl + Shift + V${NC}"
fi
