const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { StorageEngine, MAX_CAPACITY } = require('../src/storage');

function runTests() {
  console.log('🧪 Starting StorageEngine Unit Tests...\n');
  const tempDir = path.join(os.tmpdir(), `clipboard-test-${Date.now()}`);

  try {
    const engine = new StorageEngine(tempDir);

    // 1. Initial State
    console.log('Test 1: Initial state is empty');
    assert.strictEqual(engine.getItems().length, 0);
    assert.strictEqual(MAX_CAPACITY, 50);

    // 2. Add Text & Smart Classification
    console.log('Test 2: Add text items and smart classification');
    const item1 = engine.addText('Hello World');
    assert.strictEqual(item1.type, 'text');
    assert.strictEqual(item1.subtype, 'plain');

    const itemColor = engine.addText('#3B82F6');
    assert.strictEqual(itemColor.subtype, 'color');
    assert.strictEqual(itemColor.meta.colorHex, '#3B82F6');

    const itemUrl = engine.addText('https://antigravity.google.com/docs');
    assert.strictEqual(itemUrl.subtype, 'url');

    const itemCode = engine.addText('function greet() { return "hello"; }');
    assert.strictEqual(itemCode.subtype, 'code');

    assert.strictEqual(engine.getItems().length, 4);

    // 3. Deduplication
    console.log('Test 3: Deduplication bumps item to top');
    const oldTimestamp = item1.updatedAt;
    const reAdded = engine.addText('Hello World');
    assert.strictEqual(reAdded.id, item1.id);
    assert.strictEqual(engine.getItems().length, 4);
    assert.strictEqual(engine.getItems()[0].id, item1.id); // Should be first now
    assert(reAdded.updatedAt >= oldTimestamp);

    // 4. Image Handling
    console.log('Test 4: Image handling and asset persistence');
    const fakeImageBuffer = Buffer.from('FAKE_PNG_HEADER_DATA_123456');
    const imageItem = engine.addImage(fakeImageBuffer, { width: 800, height: 600 });
    assert.strictEqual(imageItem.type, 'image');
    assert.strictEqual(imageItem.meta.width, 800);
    assert.strictEqual(imageItem.meta.height, 600);
    assert(fs.existsSync(imageItem.assetPath), 'Asset file should exist on disk');

    // 5. Pinning
    console.log('Test 5: Pinning toggle');
    engine.togglePin(imageItem.id);
    assert.strictEqual(engine.getItems().find(i => i.id === imageItem.id).pinned, true);

    // 6. 50-Item Capacity Limit and Eviction
    console.log('Test 6: Enforcing 50-item limit & pin preservation');
    for (let i = 0; i < 60; i++) {
      engine.addText(`Unique text snippet number ${i}`);
    }
    const allItems = engine.getItems();
    assert.strictEqual(allItems.length, 50, 'Total items must not exceed 50');
    // Ensure our pinned image item is still present!
    const pinnedFound = allItems.find(i => i.id === imageItem.id);
    assert(pinnedFound !== undefined, 'Pinned item must NOT be evicted by unpinned items');

    // 7. Search
    console.log('Test 7: Search and filtering');
    const searchResults = engine.search('snippet number 59');
    assert.strictEqual(searchResults.length, 1);
    assert.strictEqual(searchResults[0].content, 'Unique text snippet number 59');

    // 8. Delete & Clear Unpinned
    console.log('Test 8: Clear unpinned keeps only pinned items');
    engine.clearUnpinned();
    const remaining = engine.getItems();
    assert.strictEqual(remaining.length, 1);
    assert.strictEqual(remaining[0].id, imageItem.id);

    // 9. Asset cleanup on delete
    console.log('Test 9: Asset cleanup on delete');
    const assetPath = imageItem.assetPath;
    assert(fs.existsSync(assetPath));
    engine.deleteItem(imageItem.id);
    assert.strictEqual(engine.getItems().length, 0);
    assert(!fs.existsSync(assetPath), 'Orphan asset file should be removed from disk');

    // 10. Persistence Reload
    console.log('Test 10: Persistence across engine restarts');
    engine.addText('Persistent Item 1');
    engine.addText('Persistent Item 2');
    const engine2 = new StorageEngine(tempDir);
    assert.strictEqual(engine2.getItems().length, 2);
    assert.strictEqual(engine2.getItems()[0].content, 'Persistent Item 2');

    // 11. Path Traversal Protection
    console.log('Test 11: Path traversal protection on asset deletion');
    const sensitiveFile = path.join(tempDir, 'sensitive-outside.txt');
    fs.writeFileSync(sensitiveFile, 'do not delete', 'utf8');
    const maliciousItem = {
      type: 'image',
      assetPath: sensitiveFile
    };
    engine2._cleanupAssetIfOrphan(maliciousItem);
    assert.strictEqual(fs.existsSync(sensitiveFile), true, 'External file must be protected from path traversal deletion');

    // 12. Destroy all data
    console.log('Test 12: Complete data wipe on destroyAllData');
    engine2.destroyAllData();
    assert.strictEqual(fs.existsSync(tempDir), false, 'Storage directory should be completely removed');
    assert.strictEqual(engine2.getItems().length, 0);

    console.log('\n✅ All 12 StorageEngine tests passed successfully!');
  } finally {
    // Clean up temp directory
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (_) {}
  }
}

runTests();
