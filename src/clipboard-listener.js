const { clipboard } = require('electron');
const { spawn, spawnSync } = require('child_process');

/**
 * Background Clipboard Monitor for Ubuntu & macOS
 * Polls system clipboard at configurable intervals, checks for text or image changes,
 * filters duplicate events, and notifies the storage engine and renderer window.
 * Supports Linux Wayland background capture via wl-paste and primary selection.
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
    this.waylandWatcher = null;
  }

  onNewItem(callback) {
    this.onNewItemCallback = callback;
  }

  start() {
    if (this.timer) return;

    // Initialize with current system clipboard to avoid duplicate event on launch
    try {
      this.lastText = this._readText();
      const initialImg = clipboard.readImage();
      if (!initialImg.isEmpty()) {
        this.lastImageHash = this.storage.computeHash(initialImg.toPNG());
      }
    } catch (_) {}

    this.timer = setInterval(() => this._tick(), this.pollInterval);

    // On Linux Wayland, background unfocused apps cannot read clipboard via Electron's API.
    // wl-paste --watch provides instant, background notification on every copy event.
    if (process.platform === 'linux' && process.env.WAYLAND_DISPLAY) {
      this._startWaylandWatcher();
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.waylandWatcher) {
      try { this.waylandWatcher.kill(); } catch (_) {}
      this.waylandWatcher = null;
    }
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  checkNow() {
    this._tick();
  }

  _startWaylandWatcher() {
    if (this.waylandWatcher) return;
    try {
      this.waylandWatcher = spawn('wl-paste', ['--watch', 'echo', '1'], {
        stdio: ['ignore', 'pipe', 'ignore']
      });
      this.waylandWatcher.stdout.on('data', () => {
        this._tick();
      });
      this.waylandWatcher.on('error', () => {
        this.waylandWatcher = null;
      });
      this.waylandWatcher.on('exit', () => {
        this.waylandWatcher = null;
      });
    } catch (_) {}
  }

  _readText() {
    let text = '';
    try {
      text = clipboard.readText();
    } catch (_) {}

    if (process.platform === 'linux') {
      // 1. If clipboard buffer is empty, check Linux primary selection buffer
      if (!text || !text.trim()) {
        try {
          const sel = clipboard.readText('selection');
          if (sel && sel.trim()) text = sel;
        } catch (_) {}
      }

      // 2. On Wayland, Electron's clipboard.readText() returns empty when unfocused.
      // Fallback to wl-paste if available
      if ((!text || !text.trim()) && process.env.WAYLAND_DISPLAY) {
        try {
          const out = spawnSync('wl-paste', ['--no-newline'], { timeout: 300, encoding: 'utf8' });
          if (out.status === 0 && out.stdout && out.stdout.trim()) {
            text = out.stdout;
          }
        } catch (_) {}
      }

      // 3. Fallback for X11 if xclip is available
      if ((!text || !text.trim()) && !process.env.WAYLAND_DISPLAY) {
        try {
          const out = spawnSync('xclip', ['-selection', 'clipboard', '-o'], { timeout: 300, encoding: 'utf8' });
          if (out.status === 0 && out.stdout && out.stdout.trim()) {
            text = out.stdout;
          }
        } catch (_) {}
      }
    }

    return text || '';
  }

  _tick() {
    if (this.isPaused) return;

    try {
      // 1. Check for Image in clipboard first
      try {
        const image = clipboard.readImage();
        if (!image.isEmpty()) {
          const pngBuffer = image.toPNG();
          if (pngBuffer && pngBuffer.length > 0) {
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
        }
      } catch (_) {}

      // 2. Check for Text
      const text = this._readText();
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
    clipboard.writeText(text, 'clipboard');
    if (process.platform === 'linux') {
      try {
        clipboard.writeText(text, 'selection');
      } catch (_) {}
    }
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
