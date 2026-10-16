# Multi-Device Synchronization Roadmap

## 1. Overview & Scope
While Phase 1-3 focus on the local desktop experience for Ubuntu Linux and macOS, the system is architected from Day 1 with an decoupled synchronization interface (`SyncProvider`). This allows extending clipboard history to mobile devices (Android / iOS) and secondary workstations in Phase 4 / Sprint 2.

---

## 2. Security & Zero-Knowledge Architecture
Clipboard data often contains sensitive text (API keys, temporary codes, personal emails). Therefore, any synchronization to a remote server or cloud (such as Firebase) **must be End-to-End Encrypted (E2EE)**.

```
[Local Clipboard] 
       │
       ▼
[AES-256-GCM Encryption] ◄── [User Master Key / Derived via PBKDF2 / Argon2id]
       │
       ▼ (Encrypted Payload: ciphertext, nonce, tag)
[Firebase Firestore / Realtime DB / WebRTC Relay]
       │
       ▼
[Target Workstation / Mobile App]
       │
       ▼
[AES-256-GCM Decryption] ◄── [Same Master Passphrase / QR Pair]
       │
       ▼
[Target Local Ring Buffer (Latest 50)]
```

---

## 3. Abstract Sync Engine Interface

The desktop backend defines a pluggable provider interface in `src-tauri/src/sync_adapter.rs`:

```rust
pub enum SyncEvent {
    ItemAdded(ClipboardItem),
    ItemUpdated(ClipboardItem),
    ItemDeleted(String),
    BulkSync(Vec<ClipboardItem>),
}

pub trait SyncProvider: Send + Sync {
    /// Initialize connection with auth credentials or token
    fn initialize(&mut self, config: &SyncConfig) -> Result<()>;

    /// Broadcast local change to remote devices
    fn broadcast_change(&self, event: &SyncEvent) -> Result<()>;

    /// Register callback for incoming remote changes
    fn on_remote_change(&self, callback: Box<dyn Fn(SyncEvent) + Send + Sync>);

    /// Disconnect and flush pending sync items
    fn shutdown(&mut self) -> Result<()>;
}
```

---

## 4. Multi-Device Backend Options (Future Sprint Evaluation)

| Provider Option | Pros | Cons | Recommended For |
| :--- | :--- | :--- | :--- |
| **Option A: Firebase Cloud Firestore + FCM** | Instant push notifications, cross-platform SDKs (Android, iOS, Web, Rust/REST), handles offline queueing. | Cloud dependency, Google account setup required. | Default cloud sync recommendation. |
| **Option B: WebRTC Direct P2P (Local LAN)** | Zero external servers, 100% private, zero cost, blazing fast on same Wi-Fi. | Devices must be on same network or require STUN/TURN relays. | Privacy-first local-network sync. |
| **Option C: Self-Hosted WebSocket Relay** | Open-source, self-hosted Docker container, zero vendor lock-in. | User must maintain an endpoint. | Power users / homelab setups. |

---

## 5. Mobile Synchronization (Android / iOS Scope)
- **Android Companion App**:
  - Background service with accessibility / input method integration to quickly paste synced items.
  - Quick Settings Tile: Tap tile to open floating clipboard drawer.
- **iOS Companion App**:
  - iOS clipboard limits background listening; app uses Share Sheet extension and Keyboard Extension (`Custom Keyboard`) to access the synced 50 items.
