#!/usr/bin/env bash
# Build and packaging script for Ubuntu Linux (Debian / AppImage)
set -e

echo "============================================="
echo " Building Clipboard Manager for Ubuntu Linux "
echo "============================================="

# Ensure npm dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Run non-SQL storage test suite before building
echo "Running test suite..."
node tests/storage.test.js

# Build Linux tar.xz / deb using electron-builder if installed
if command -v electron-builder &> /dev/null; then
  echo "Packaging for Linux..."
  npx electron-builder --linux tar.xz deb
else
  echo "electron-builder not found globally. Running via npx..."
  npx --yes electron-builder --linux tar.xz deb || echo "Please run: npm install -g electron-builder"
fi

echo "Build complete. Artifacts saved in dist/ directory."
