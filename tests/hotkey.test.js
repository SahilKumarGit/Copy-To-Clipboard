const assert = require('assert');
const {
  normalizeAccelerator,
  toDisplayTokens,
  toDisplayString,
  HotkeyManager
} = require('../src/hotkey');

function runHotkeyTests() {
  console.log('🧪 Starting Comprehensive Hotkey Unit Tests...\n');

  // 1. Basic Normalization
  console.log('Test 1: Basic normalization and lowercase handling');
  assert.strictEqual(normalizeAccelerator('ctrl+shift+v'), 'Control+Shift+V');
  assert.strictEqual(normalizeAccelerator('cmd+shift+v'), 'Command+Shift+V');
  assert.strictEqual(normalizeAccelerator('alt+space'), 'Alt+Space');
  assert.strictEqual(normalizeAccelerator('super+v'), 'Super+V');

  // 2. Whitespace and Formatting Resiliency
  console.log('Test 2: Whitespace and delimiter resiliency');
  assert.strictEqual(normalizeAccelerator('  ctrl  +   alt  +   v  '), 'Control+Alt+V');
  assert.strictEqual(normalizeAccelerator('cmd + shift + c'), 'Command+Shift+C');
  assert.strictEqual(normalizeAccelerator('Control+Alt+Delete'), 'Control+Alt+Delete');

  // 3. Modifier Aliases
  console.log('Test 3: Modifier aliases');
  assert.strictEqual(normalizeAccelerator('control+v'), 'Control+V');
  assert.strictEqual(normalizeAccelerator('command+v'), 'Command+V');
  assert.strictEqual(normalizeAccelerator('cmdorctrl+v'), 'CommandOrControl+V');
  assert.strictEqual(normalizeAccelerator('commandorcontrol+v'), 'CommandOrControl+V');
  assert.strictEqual(normalizeAccelerator('option+v'), 'Alt+V');
  assert.strictEqual(normalizeAccelerator('opt+v'), 'Alt+V');
  assert.strictEqual(normalizeAccelerator('win+v'), 'Super+V');
  assert.strictEqual(normalizeAccelerator('windows+v'), 'Super+V');
  assert.strictEqual(normalizeAccelerator('meta+v'), 'Super+V');

  // 4. Function Keys
  console.log('Test 4: Function keys (F1 to F24)');
  assert.strictEqual(normalizeAccelerator('F1'), 'F1');
  assert.strictEqual(normalizeAccelerator('f9'), 'F9');
  assert.strictEqual(normalizeAccelerator('f12'), 'F12');
  assert.strictEqual(normalizeAccelerator('F24'), 'F24');
  assert.strictEqual(normalizeAccelerator('ctrl+f9'), 'Control+F9');
  assert.strictEqual(normalizeAccelerator('alt+shift+f11'), 'Alt+Shift+F11');

  // 5. Number and Digit Keys
  console.log('Test 5: Number and digit keys');
  assert.strictEqual(normalizeAccelerator('ctrl+1'), 'Control+1');
  assert.strictEqual(normalizeAccelerator('alt+0'), 'Alt+0');
  assert.strictEqual(normalizeAccelerator('cmd+shift+9'), 'Command+Shift+9');

  // 6. Special & Navigation Keys
  console.log('Test 6: Special and navigation keys');
  assert.strictEqual(normalizeAccelerator('ctrl+space'), 'Control+Space');
  assert.strictEqual(normalizeAccelerator('alt+enter'), 'Alt+Return');
  assert.strictEqual(normalizeAccelerator('ctrl+return'), 'Control+Return');
  assert.strictEqual(normalizeAccelerator('cmd+tab'), 'Command+Tab');
  assert.strictEqual(normalizeAccelerator('alt+esc'), 'Alt+Escape');
  assert.strictEqual(normalizeAccelerator('alt+escape'), 'Alt+Escape');
  assert.strictEqual(normalizeAccelerator('ctrl+backspace'), 'Control+Backspace');
  assert.strictEqual(normalizeAccelerator('ctrl+delete'), 'Control+Delete');
  assert.strictEqual(normalizeAccelerator('ctrl+del'), 'Control+Delete');
  assert.strictEqual(normalizeAccelerator('ctrl+insert'), 'Control+Insert');
  assert.strictEqual(normalizeAccelerator('ctrl+up'), 'Control+Up');
  assert.strictEqual(normalizeAccelerator('ctrl+down'), 'Control+Down');
  assert.strictEqual(normalizeAccelerator('ctrl+left'), 'Control+Left');
  assert.strictEqual(normalizeAccelerator('ctrl+right'), 'Control+Right');
  assert.strictEqual(normalizeAccelerator('ctrl+home'), 'Control+Home');
  assert.strictEqual(normalizeAccelerator('ctrl+end'), 'Control+End');
  assert.strictEqual(normalizeAccelerator('ctrl+pageup'), 'Control+PageUp');
  assert.strictEqual(normalizeAccelerator('ctrl+pagedown'), 'Control+PageDown');

  // 7. Punctuation and Symbol Keys
  console.log('Test 7: Punctuation and symbol keys');
  assert.strictEqual(normalizeAccelerator('ctrl+`'), 'Control+`');
  assert.strictEqual(normalizeAccelerator('cmd+.'), 'Command+.');
  assert.strictEqual(normalizeAccelerator('alt+/'), 'Alt+/');
  assert.strictEqual(normalizeAccelerator('ctrl+-'), 'Control+-');
  assert.strictEqual(normalizeAccelerator('ctrl+='), 'Control+=');
  assert.strictEqual(normalizeAccelerator('ctrl+['), 'Control+[');
  assert.strictEqual(normalizeAccelerator('ctrl+]'), 'Control+]');
  assert.strictEqual(normalizeAccelerator('ctrl+\\'), 'Control+\\');
  assert.strictEqual(normalizeAccelerator('ctrl+;'), 'Control+;');
  assert.strictEqual(normalizeAccelerator('ctrl+\''), 'Control+\'');
  assert.strictEqual(normalizeAccelerator('ctrl+,'), 'Control+,');

  // 8. Rejection of Invalid / Dangerous Hotkeys
  console.log('Test 8: Rejection of invalid or single-key hotkeys');
  assert.strictEqual(normalizeAccelerator(''), null, 'Empty string is invalid');
  assert.strictEqual(normalizeAccelerator('   '), null, 'Whitespace is invalid');
  assert.strictEqual(normalizeAccelerator(null), null, 'null is invalid');
  assert.strictEqual(normalizeAccelerator(undefined), null, 'undefined is invalid');
  assert.strictEqual(normalizeAccelerator(123), null, 'non-string is invalid');
  assert.strictEqual(normalizeAccelerator('v'), null, 'Single letter without modifier rejected');
  assert.strictEqual(normalizeAccelerator('V'), null, 'Single uppercase letter without modifier rejected');
  assert.strictEqual(normalizeAccelerator('1'), null, 'Single number without modifier rejected');
  assert.strictEqual(normalizeAccelerator('space'), null, 'Space alone without modifier rejected');
  assert.strictEqual(normalizeAccelerator('ctrl+'), null, 'Modifier without key rejected');
  assert.strictEqual(normalizeAccelerator('+v'), null, 'Leading plus without modifier rejected');

  // 9. Display Tokens and Strings (macOS vs Linux)
  console.log('Test 9: Display tokens and strings across platforms');
  assert.deepStrictEqual(toDisplayTokens('CommandOrControl+Shift+V', 'darwin'), ['Cmd', 'Shift', 'V']);
  assert.deepStrictEqual(toDisplayTokens('CommandOrControl+Shift+V', 'linux'), ['Ctrl', 'Shift', 'V']);
  assert.deepStrictEqual(toDisplayTokens('Command+Alt+V', 'darwin'), ['Cmd', 'Opt', 'V']);
  assert.deepStrictEqual(toDisplayTokens('Control+Alt+V', 'linux'), ['Ctrl', 'Alt', 'V']);
  assert.deepStrictEqual(toDisplayTokens('Super+V', 'darwin'), ['Cmd', 'V']);
  assert.deepStrictEqual(toDisplayTokens('Super+V', 'linux'), ['Super', 'V']);
  assert.deepStrictEqual(toDisplayTokens('Alt+Return', 'darwin'), ['Opt', 'Enter']);

  assert.strictEqual(toDisplayString('Command+Shift+V', 'darwin'), 'Cmd + Shift + V');
  assert.strictEqual(toDisplayString('Control+Shift+V', 'linux'), 'Ctrl + Shift + V');
  assert.strictEqual(toDisplayString('Alt+Space', 'darwin'), 'Opt + Space');
  assert.strictEqual(toDisplayString('Alt+Space', 'linux'), 'Alt + Space');

  // 10. HotkeyManager Class Methods & Lifecycle
  console.log('Test 10: HotkeyManager class methods and lifecycle');
  const defaultManager = new HotkeyManager();
  const expectedDefault = process.platform === 'darwin' ? 'Command+Shift+V' : 'Control+Shift+V';
  assert.strictEqual(defaultManager.getShortcut(), expectedDefault);

  const customManager = new HotkeyManager('ctrl+alt+v');
  assert.strictEqual(customManager.getShortcut(), 'Control+Alt+V');
  assert.deepStrictEqual(customManager.getShortcutsToRegister('Control+Alt+V'), ['Control+Alt+V']);

  // Check fallback when given invalid shortcut on construction
  const fallbackManager = new HotkeyManager('invalid_single_letter');
  assert.strictEqual(fallbackManager.getShortcut(), expectedDefault);

  // 11. HotkeyManager updateShortcut
  console.log('Test 11: HotkeyManager updateShortcut dynamic rebinding');
  const updateRes1 = customManager.updateShortcut('alt+space');
  assert.strictEqual(updateRes1.success, true);
  assert.strictEqual(updateRes1.shortcut, 'Alt+Space');
  assert.strictEqual(customManager.getShortcut(), 'Alt+Space');

  const updateResInvalid = customManager.updateShortcut('singleletterwithoutmodifier');
  assert.strictEqual(updateResInvalid.success, false);
  assert.strictEqual(customManager.getShortcut(), 'Alt+Space', 'Previous shortcut preserved on invalid input');

  // 12. macOS Fallback Registration
  console.log('Test 12: macOS convenience multi-registration for default shortcut');
  const macManager = new HotkeyManager('Command+Shift+V');
  const macTargets = macManager.getShortcutsToRegister('Command+Shift+V');
  if (process.platform === 'darwin') {
    assert(macTargets.includes('Command+Shift+V'));
    assert(macTargets.includes('Control+Shift+V'));
  }

  console.log('\n✅ All Hotkey Unit Tests Passed Successfully!');
}

runHotkeyTests();
