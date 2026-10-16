const crypto = require('crypto');

/**
 * Base Abstract Sync Provider
 * Interface for Phase 4 multi-device synchronization (Firebase, WebRTC P2P, etc.)
 */
class SyncProvider {
  constructor(name = 'base') {
    this.name = name;
  }

  async initialize(config) {
    throw new Error('Not implemented');
  }

  async broadcastChange(event) {
    throw new Error('Not implemented');
  }

  onRemoteChange(callback) {
    throw new Error('Not implemented');
  }

  async shutdown() {}
}

/**
 * Local-Only Null Sync Provider (Default for Phase 1-3)
 */
class LocalSyncProvider extends SyncProvider {
  constructor() {
    super('local-only');
  }

  async initialize() {
    console.log('[SyncEngine] Running in Local-Only mode. Multi-device sync disabled.');
  }

  async broadcastChange(event) {
    // No-op locally
  }

  onRemoteChange() {
    // No-op
  }
}

/**
 * E2EE AES-256-GCM Encryption Helper
 * Ensures all sync payloads sent over the wire or to Firebase are encrypted with zero-knowledge
 */
class CryptoEngine {
  static deriveKey(passphrase, salt = 'clipboard-salt') {
    return crypto.scryptSync(passphrase, salt, 32);
  }

  static encrypt(plaintext, key) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      iv: iv.toString('hex'),
      ciphertext,
      tag: authTag
    };
  }

  static decrypt(payload, key) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
    let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

module.exports = { SyncProvider, LocalSyncProvider, CryptoEngine };
