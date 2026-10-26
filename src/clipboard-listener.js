const { clipboard } = require('electron');

/**
 * Background Clipboard Monitor for Ubuntu & macOS
 * Polls system clipboard at configurable intervals, checks for text or image changes,
 * filters duplicate events, and notifies the storage engine and renderer window.
 */
class ClipboardListener {
  constructor(storageEngine, options = {}) {
    this.storage = storageEngine;
    this.pollInterval = options.pollInterval || 400; // ms
    this.timer = null;
    this.lastText = '';
    this.lastImageHash = '';
    this.isPaused = false;
    this.onNewItemCallback = null;
  }

  onNewItem(callback) {
    this.onNewItemCallback = callback;
  }

  start() {
    if (this.timer) return;

    // Initialize with current system clipboard to avoid duplicate event on launch
    try {
      this.lastText = clipboard.readText();
      const initialImg = clipboard.readImage();
      if (!initialImg.isEmpty()) {
        this.lastImageHash = this.storage.computeHash(initialImg.toPNG());
      }
    } catch (_) {}

    this.timer = setInterval(() => this._tick(), this.pollInterval);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  _tick() {
    if (this.isPaused) return;

    try {
      // 1. Check for Image in clipboard first
      const image = clipboard.readImage();
      if (!image.isEmpty()) {
        const pngBuffer = image.toPNG();
        const hash = this.storage.computeHash(pngBuffer);

        if (hash !== this.lastImageHash) {
          this.lastImageHash = hash;
          const size = image.getSize();
          const item = this.storage.addImage(pngBuffer, size);
          if (item && this.onNewItemCallback) {
            this.onNewItemCallback(item);
          }
          return; // Priority given to image
        }
      }

      // 2. Check for Text
      const text = clipboard.readText();
      if (text && text.trim() && text !== this.lastText) {
        this.lastText = text;
        const item = this.storage.addText(text);
        if (item && this.onNewItemCallback) {
          this.onNewItemCallback(item);
        }
      }
    } catch (err) {
      // Silently catch OS clipboard lock/busy errors
    }
  }

  /**
   * Set text directly and update internal lastText to prevent self-trigger loop
   */
  writeTextSilently(text) {
    this.lastText = text;
    clipboard.writeText(text);
  }

  /**
   * Set image directly and update internal hash to prevent self-trigger loop
   */
  writeImageSilently(nativeImg) {
    this.lastImageHash = this.storage.computeHash(nativeImg.toPNG());
    clipboard.writeImage(nativeImg);
  }
}

module.exports = { ClipboardListener };
