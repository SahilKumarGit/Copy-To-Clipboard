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

# Build macOS DMG and .app
if command -v electron-builder &> /dev/null; then
  echo "Packaging for macOS..."
  npx electron-builder --mac dmg dir
else
  echo "Packaging via npx electron-builder..."
  npx --yes electron-builder --mac dmg dir || echo "Please run: npm install -g electron-builder"
fi

echo "Build complete. Artifacts saved in dist/ directory."
