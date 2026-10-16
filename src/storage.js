const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const MAX_CAPACITY = 50;

/**
 * Pure Non-SQL Storage Engine
 * Manages an atomic JSON index (history.json) and flat-file image cache (assets/)
 * with a strict 50-item FIFO ring buffer and pin-preservation.
 */
class StorageEngine {
  constructor(customStorageDir = null) {
    if (customStorageDir) {
      this.storageDir = customStorageDir;
    } else {
      const home = os.homedir();
      if (process.platform === 'darwin') {
        this.storageDir = path.join(home, 'Library', 'Application Support', 'clipboard-history');
      } else {
        this.storageDir = path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'clipboard-history');
      }
    }

    this.assetsDir = path.join(this.storageDir, 'assets');
    this.metadataFile = path.join(this.storageDir, 'history.json');
    this.items = [];

    this._ensureDirectories();
    this.load();
  }

  _ensureDirectories() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
    if (!fs.existsSync(this.assetsDir)) {
      fs.mkdirSync(this.assetsDir, { recursive: true });
    }
  }

  load() {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const raw = fs.readFileSync(this.metadataFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.items)) {
          this.items = parsed.items.slice(0, MAX_CAPACITY);
        }
      }
    } catch (err) {
      console.error('[StorageEngine] Error loading history.json:', err.message);
      this.items = [];
    }
  }

  save() {
    try {
      const payload = {
        version: 1,
        lastUpdated: Date.now(),
        maxCapacity: MAX_CAPACITY,
        items: this.items
      };

      const tmpFile = `${this.metadataFile}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf8');
      fs.renameSync(tmpFile, this.metadataFile);
    } catch (err) {
      console.error('[StorageEngine] Error saving history.json:', err.message);
    }
  }

  computeHash(data) {
    const hash = crypto.createHash('sha256');
    if (Buffer.isBuffer(data)) {
      hash.update(data);
    } else {
      hash.update(String(data));
    }
    return hash.digest('hex');
  }

  classifyText(text) {
    const trimmed = text.trim();

    // Hex Color detection: #FFF, #FFFFFF, rgb(...)
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
      return { subtype: 'color', extra: { colorHex: trimmed } };
    }
    if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)$/.test(trimmed)) {
      return { subtype: 'color', extra: { colorHex: trimmed } };
    }

    // URL detection
    if (/^(https?|ftp|file):\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed)) {
      return { subtype: 'url', extra: { url: trimmed } };
    }

    // Code snippet heuristic: curly braces, semicolons, common keywords
    if (
      (trimmed.includes('{') && trimmed.includes('}')) ||
      (trimmed.includes('function') || trimmed.includes('const ') || trimmed.includes('let ') || trimmed.includes('import ') || trimmed.includes('class ')) ||
      (trimmed.includes('SELECT ') || trimmed.includes('docker ') || trimmed.includes('kubectl ') || trimmed.includes('git '))
    ) {
      return { subtype: 'code', extra: { lineCount: trimmed.split('\n').length } };
    }

    return { subtype: 'plain', extra: {} };
  }

  /**
   * Add text clipboard item
   */
  addText(text) {
    if (!text || typeof text !== 'string') return null;
    const cleanText = text.trim();
    if (!cleanText) return null;

    const hash = this.computeHash(cleanText);
    const existingIndex = this.items.findIndex(item => item.hash === hash);

    if (existingIndex !== -1) {
      // Deduplicate: move existing item to top and update timestamp
      const [item] = this.items.splice(existingIndex, 1);
      item.updatedAt = Date.now();
      this.items.unshift(item);
      this.save();
      return item;
    }

    const { subtype, extra } = this.classifyText(cleanText);
    const preview = cleanText.length > 200 ? cleanText.substring(0, 197) + '...' : cleanText;

    const newItem = {
      id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      hash,
      type: 'text',
      subtype,
      content: cleanText,
      assetPath: null,
      preview,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      meta: {
        charCount: cleanText.length,
        ...extra
      }
    };

    this.items.unshift(newItem);
    this._enforceLimit();
    this.save();
    return newItem;
  }

  /**
   * Add image clipboard item
   * @param {Buffer} buffer - Raw PNG buffer
   * @param {Object} dimensions - { width, height }
   */
  addImage(buffer, dimensions = {}) {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) return null;

    const hash = this.computeHash(buffer);
    const existingIndex = this.items.findIndex(item => item.hash === hash);

    if (existingIndex !== -1) {
      // Deduplicate: move to top
      const [item] = this.items.splice(existingIndex, 1);
      item.updatedAt = Date.now();
      this.items.unshift(item);
      this.save();
      return item;
    }

    const fileName = `${hash}.png`;
    const assetFilePath = path.join(this.assetsDir, fileName);

    // Save image asset to disk
    try {
      fs.writeFileSync(assetFilePath, buffer);
    } catch (err) {
      console.error('[StorageEngine] Failed to write image asset:', err);
      return null;
    }

    const preview = `Image (${dimensions.width || '?'}x${dimensions.height || '?'}, ${(buffer.length / 1024).toFixed(1)} KB)`;

    const newItem = {
      id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      hash,
      type: 'image',
      subtype: 'png',
      content: null,
      assetPath: assetFilePath,
      preview,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      meta: {
        width: dimensions.width || 0,
        height: dimensions.height || 0,
        bytes: buffer.length,
        format: 'png'
      }
    };

    this.items.unshift(newItem);
    this._enforceLimit();
    this.save();
    return newItem;
  }

  /**
   * Enforce FIFO limit of 50 items while preserving pinned items
   */
  _enforceLimit() {
    while (this.items.length > MAX_CAPACITY) {
      // Find oldest unpinned item starting from the end
      let evictIndex = -1;
      for (let i = this.items.length - 1; i >= 0; i--) {
        if (!this.items[i].pinned) {
          evictIndex = i;
          break;
        }
      }

      // If all items are pinned, evict the oldest pinned item
      if (evictIndex === -1) {
        evictIndex = this.items.length - 1;
      }

      const [evicted] = this.items.splice(evictIndex, 1);
      this._cleanupAssetIfOrphan(evicted);
    }
  }

  /**
   * Remove asset from disk if no other entry references it
   */
  _cleanupAssetIfOrphan(item) {
    if (item && item.type === 'image' && item.assetPath) {
      const isReferenced = this.items.some(i => i.assetPath === item.assetPath);
      if (!isReferenced && fs.existsSync(item.assetPath)) {
        try {
          fs.unlinkSync(item.assetPath);
        } catch (err) {
          console.error('[StorageEngine] Error deleting asset:', err.message);
        }
      }
    }
  }

  togglePin(id) {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.pinned = !item.pinned;
      item.updatedAt = Date.now();
      this.save();
      return item;
    }
    return null;
  }

  deleteItem(id) {
    const index = this.items.findIndex(i => i.id === id);
    if (index !== -1) {
      const [deleted] = this.items.splice(index, 1);
      this._cleanupAssetIfOrphan(deleted);
      this.save();
      return true;
    }
    return false;
  }

  clearUnpinned() {
    const unpinnedItems = this.items.filter(i => !i.pinned);
    unpinnedItems.forEach(item => this._cleanupAssetIfOrphan(item));
    this.items = this.items.filter(i => i.pinned);
    this.save();
    return this.items;
  }

  getItems(filter = 'all') {
    switch (filter) {
      case 'pinned':
        return this.items.filter(i => i.pinned);
      case 'text':
        return this.items.filter(i => i.type === 'text');
      case 'image':
        return this.items.filter(i => i.type === 'image');
      case 'url':
        return this.items.filter(i => i.subtype === 'url');
      default:
        return [...this.items];
    }
  }

  search(query) {
    if (!query || !query.trim()) return this.getItems();
    const q = query.trim().toLowerCase();
    return this.items.filter(item => {
      if (item.type === 'text') {
        return (
          (item.content && item.content.toLowerCase().includes(q)) ||
          (item.subtype && item.subtype.toLowerCase().includes(q))
        );
      } else if (item.type === 'image') {
        return (
          item.preview.toLowerCase().includes(q) ||
          item.subtype.toLowerCase().includes(q)
        );
      }
      return false;
    });
  }
}

module.exports = { StorageEngine, MAX_CAPACITY };
