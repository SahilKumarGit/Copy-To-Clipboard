# Non-SQL Storage Specification

## 1. Directory Structure

Storage is strictly file-based and decoupled from any SQL engine. On disk, data is kept in the user's standard application data directory:

- **Ubuntu Linux**: `~/.config/clipboard-history/`
- **macOS**: `~/Library/Application Support/clipboard-history/`

```
clipboard-history/
├── history.json           # Atomic JSON file containing latest <= 50 entries
├── history.json.tmp       # Atomic write staging file
└── assets/                # Cache folder for clipboard image bitmaps
    ├── a9f3b8c2...png     # SHA-256 hashed PNG file
    └── 7e10df3a...png
```

---

## 2. Metadata JSON Schema (`history.json`)

The file stores an array of up to 50 items ordered chronologically descending (newest first):

```json
{
  "version": 1,
  "last_updated": 1776366000000,
  "max_capacity": 50,
  "items": [
    {
      "id": "clip_01hxyz123456",
      "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "type": "text",
      "subtype": "code",
      "content": "function pasteItem(id) { ... }",
      "asset_path": null,
      "preview": "function pasteItem(id) { ... }",
      "pinned": false,
      "created_at": 1776365900000,
      "updated_at": 1776365900000,
      "meta": {
        "char_count": 31,
        "line_count": 1,
        "syntax_lang": "javascript"
      }
    },
    {
      "id": "clip_01hxyz987654",
      "hash": "a9f3b8c2d1e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0",
      "type": "image",
      "subtype": "png",
      "content": null,
      "asset_path": "assets/a9f3b8c2d1e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0.png",
      "preview": "Image (1920x1080 · 245 KB)",
      "pinned": true,
      "created_at": 1776365800000,
      "updated_at": 1776365800000,
      "meta": {
        "width": 1920,
        "height": 1080,
        "bytes": 250880,
        "format": "png"
      }
    }
  ]
}
```

---

## 3. Storage Invariants & Operations

### 3.1 Ring Buffer & Eviction Algorithm
1. Incoming clip with hash $H$.
2. Check if $H$ exists in current items:
   - **Match found**: Move matched item to index 0, update `updated_at = now()`, commit to disk.
   - **No match**: Prepend new item to index 0.
3. If `items.len() > 50`:
   - Iterate from the tail (oldest items) to find the oldest item where `pinned == false`.
   - If that item has `type == "image"`, call `fs::remove_file(asset_path)`.
   - Remove item from array.
   - If all 50 items are pinned, the 51st unpinned item is rejected or oldest pinned item prompts user (configurable, defaults to retaining pinned and dropping oldest unpinned).

### 3.2 Crash Resilience & Atomic Writes
- Never write directly to `history.json` to prevent corruption if power is cut mid-write.
- Always write to `history.json.tmp`, flush to disk (`fsync`), then atomically replace `history.json` via `fs::rename()`.

### 3.3 Image Asset Management
- When an image is intercepted from the system clipboard, it is encoded as a compressed PNG.
- The SHA-256 hash of the raw RGBA pixels or PNG bytes is computed.
- The file is saved to `assets/<hash>.png`.
- Thumbnails for the UI are generated on the fly or cached with height `64px` for ultra-fast UI rendering.
