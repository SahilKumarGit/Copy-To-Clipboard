#!/usr/bin/env bash
# Build and packaging script for macOS (.dmg / .app)
set -e

echo "============================================="
echo " Building Clipboard Manager for macOS        "
echo "============================================="

# Ensure npm dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Run non-SQL storage test suite before building
echo "Running test suite..."
node tests/storage.test.js

# Compile native macOS paste injector
echo "Compiling native paste helper..."
mkdir -p bin
clang -Wall -Wextra -Werror -framework ApplicationServices -framework Cocoa native/paste-helper-mac.m -o bin/paste-helper-mac
chmod +x bin/paste-helper-mac

# Build macOS DMG, ZIP, and .app
echo "Packaging for macOS..."
npx electron-builder --mac

echo "Build complete. Artifacts saved in dist/ directory."
