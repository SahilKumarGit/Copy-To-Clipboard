const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { StorageEngine } = require('../src/storage');
const { HotkeyManager, normalizeAccelerator } = require('../src/hotkey');

function parseShortcutFromArgv(argv) {
  if (!Array.isArray(argv)) return null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== 'string') continue;
    if (arg.startsWith('--shortcut=')) {
      return arg.slice(11).replace(/^["']|["']$/g, '');
    }
    if (arg.startsWith('--set-shortcut=')) {
      return arg.slice(15).replace(/^["']|["']$/g, '');
    }
    if ((arg === '--shortcut' || arg === '--set-shortcut') && argv[i + 1]) {
      return argv[i + 1].replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

function runCliConfigTests() {
  console.log('🧪 Starting CLI & Environment Variable Configuration Tests...\n');

  // 1. Argument parsing: --shortcut="val"
  console.log('Test 1: Argument parsing with = syntax');
  assert.strictEqual(
    parseShortcutFromArgv(['node', 'src/main.js', '--shortcut=Ctrl+Alt+V']),
    'Ctrl+Alt+V'
  );
  assert.strictEqual(
    parseShortcutFromArgv(['electron', '.', '--shortcut="Alt+Space"']),
    'Alt+Space'
  );

  // 2. Argument parsing: --shortcut <val>
  console.log('Test 2: Argument parsing with space separated arguments');
  assert.strictEqual(
    parseShortcutFromArgv(['node', 'src/main.js', '--shortcut', 'Super+V']),
    'Super+V'
  );
  assert.strictEqual(
    parseShortcutFromArgv(['node', 'src/main.js', '--set-shortcut', 'Ctrl+Shift+C']),
    'Ctrl+Shift+C'
  );

  // 3. Flag not present
  console.log('Test 3: Flag not present returns null');
  assert.strictEqual(
    parseShortcutFromArgv(['node', 'src/main.js', '--hidden', '--no-sandbox']),
    null
  );

  // 4. End-to-end simulated bootstrap logic
  console.log('Test 4: Bootstrapping priority (CLI > Env > Storage > Default)');
  const tempDir = path.join(os.tmpdir(), `clipboard-cli-test-${Date.now()}`);

  try {
    const storage = new StorageEngine(tempDir);
    const defaultSc = storage.getDefaultShortcut();

    // Case A: Nothing provided -> uses default
    let cli = parseShortcutFromArgv(['node', 'main.js']);
    let env = undefined;
    let initialSc = cli || env || storage.getShortcut();
    assert.strictEqual(initialSc, defaultSc);

    // Case B: Env variable provided
    env = 'Alt+Space';
    initialSc = cli || env || storage.getShortcut();
    assert.strictEqual(initialSc, 'Alt+Space');

    // Case C: CLI overrides env
    cli = parseShortcutFromArgv(['node', 'main.js', '--shortcut=Ctrl+Alt+V']);
    initialSc = cli || env || storage.getShortcut();
    assert.strictEqual(initialSc, 'Ctrl+Alt+V');

    // Case D: CLI saves to storage
    storage.setShortcut(normalizeAccelerator(initialSc));
    assert.strictEqual(storage.getShortcut(), 'Control+Alt+V');

    // Case E: HotkeyManager initialized with storage value
    const manager = new HotkeyManager(storage.getShortcut());
    assert.strictEqual(manager.getShortcut(), 'Control+Alt+V');

    console.log('\n✅ All CLI & Environment Configuration Tests Passed Successfully!');
  } finally {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (_) {}
  }
}

runCliConfigTests();
