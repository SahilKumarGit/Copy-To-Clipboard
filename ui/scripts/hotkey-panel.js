/**
 * Inline Hotkey Panel Controller for the main HUD popup.
 * Allows changing the global shortcut without opening the Preferences window.
 */
(function () {
  'use strict';

  // ── DOM elements ──
  const panel = document.getElementById('hotkey-panel');
  const panelCloseBtn = document.getElementById('hotkey-panel-close');
  const openPrefsBtn = document.getElementById('hud-open-prefs-btn');
  const recordBtn = document.getElementById('hud-shortcut-record-btn');
  const keysEl = document.getElementById('hud-shortcut-keys');
  const recordingEl = document.getElementById('hud-shortcut-recording');
  const resetBtn = document.getElementById('hud-reset-shortcut-btn');
  const presetsGrid = document.getElementById('hud-presets-grid');
  const manualInput = document.getElementById('hud-manual-input');
  const applyManualBtn = document.getElementById('hud-apply-manual-btn');
  const feedbackEl = document.getElementById('hud-shortcut-feedback');
  const footerHotkeyBtn = document.getElementById('footer-hotkey-btn');
  const footerHotkeyKbd = document.getElementById('footer-hotkey-kbd');

  let currentPlatform = 'linux';
  let activeShortcut = 'Control+Shift+V';
  let isRecording = false;
  let feedbackTimer = null;

  // ── UI Renderers ──

  function updateFooterBadge(displayStr) {
    if (footerHotkeyKbd) {
      footerHotkeyKbd.textContent = displayStr || (currentPlatform === 'darwin' ? 'Cmd+Shift+V' : 'Ctrl+Shift+V');
    }
  }

  function renderKeys(tokens) {
    if (!keysEl) return;
    keysEl.innerHTML = '';
    tokens.forEach(function (token, i) {
      const kbd = document.createElement('kbd');
      kbd.textContent = token;
      keysEl.appendChild(kbd);
      if (i < tokens.length - 1) {
        const plus = document.createElement('span');
        plus.className = 'hk-plus';
        plus.textContent = '+';
        keysEl.appendChild(plus);
      }
    });
  }

  function showFeedback(msg, type, duration) {
    if (!feedbackEl) return;
    clearTimeout(feedbackTimer);
    feedbackEl.textContent = msg;
    feedbackEl.className = 'hotkey-panel-feedback ' + (type || 'success');
    feedbackEl.style.display = 'block';
    if (duration !== 0) {
      feedbackTimer = setTimeout(function () {
        feedbackEl.style.display = 'none';
      }, duration || 2600);
    }
  }

  function populatePresets() {
    if (!presetsGrid) return;
    presetsGrid.innerHTML = '';

    const isMac = currentPlatform === 'darwin';
    const presets = isMac ? [
      { id: 'Command+Shift+V', label: 'Cmd+Shift+V (Default)' },
      { id: 'Command+Alt+V', label: 'Cmd+Opt+V' },
      { id: 'Alt+Space', label: 'Opt+Space' },
      { id: 'Command+Shift+C', label: 'Cmd+Shift+C' },
      { id: 'Control+Space', label: 'Ctrl+Space' },
      { id: 'Super+V', label: 'Cmd+V (Super)' }
    ] : [
      { id: 'Control+Shift+V', label: 'Ctrl+Shift+V (Default)' },
      { id: 'Control+Alt+V', label: 'Ctrl+Alt+V' },
      { id: 'Alt+Space', label: 'Alt+Space' },
      { id: 'Super+V', label: 'Super+V (Win+V)' },
      { id: 'Control+Shift+C', label: 'Ctrl+Shift+C' },
      { id: 'Control+Space', label: 'Ctrl+Space' }
    ];

    presets.forEach(function (p) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'hk-preset-chip' + (p.id.toLowerCase() === activeShortcut.toLowerCase() ? ' active' : '');
      chip.textContent = p.label;
      chip.addEventListener('click', function () {
        applyShortcut(p.id);
      });
      presetsGrid.appendChild(chip);
    });
  }

  // ── Apply Shortcut ──

  async function applyShortcut(candidate) {
    if (!candidate || !candidate.trim()) return false;
    const api = (window.clipboardAPI && window.clipboardAPI.setShortcut)
      ? window.clipboardAPI
      : (window.aboutAPI && window.aboutAPI.setShortcut ? window.aboutAPI : null);

    if (!api) return false;

    try {
      const result = await api.setShortcut(candidate.trim());
      if (result && result.success) {
        activeShortcut = result.shortcut;
        renderKeys(result.displayTokens);
        populatePresets();
        updateFooterBadge(result.displayString);
        showFeedback('Saved: ' + result.displayString, 'success');
        return true;
      } else {
        const errMsg = (result && result.error) ? result.error : 'Failed to register shortcut.';
        showFeedback(errMsg, 'error', 4000);
        return false;
      }
    } catch (err) {
      console.error('[HotkeyPanel] Error setting shortcut:', err);
      showFeedback('Unexpected error setting shortcut.', 'error', 3000);
      return false;
    }
  }

  // ── Open / Close / Toggle ──

  function openPanel() {
    if (!panel) return;
    panel.style.display = 'block';
    loadCurrentShortcut();
  }

  function closePanel() {
    stopRecording();
    if (panel) panel.style.display = 'none';
    if (feedbackEl) feedbackEl.style.display = 'none';
  }

  function togglePanel() {
    if (panel && panel.style.display !== 'none') {
      closePanel();
    } else {
      openPanel();
    }
  }

  // ── Load Current Shortcut ──

  async function loadCurrentShortcut() {
    const api = (window.clipboardAPI && window.clipboardAPI.getAppInfo)
      ? window.clipboardAPI
      : (window.aboutAPI && window.aboutAPI.getAppInfo ? window.aboutAPI : null);

    if (!api) return;

    try {
      const info = await api.getAppInfo();
      if (info) {
        currentPlatform = info.platform || 'linux';
        activeShortcut = info.shortcut || (currentPlatform === 'darwin' ? 'Command+Shift+V' : 'Control+Shift+V');
        if (info.displayTokens && info.displayTokens.length > 0) {
          renderKeys(info.displayTokens);
        }
        updateFooterBadge(info.displayString || activeShortcut);
        populatePresets();
        if (manualInput) {
          manualInput.placeholder = currentPlatform === 'darwin' ? 'e.g. Cmd+Opt+V' : 'e.g. Ctrl+Alt+V';
        }
      }
    } catch (_) { /* ignore */ }
  }

  // ── Interactive Key Recording ──

  function startRecording() {
    if (isRecording) return;
    isRecording = true;
    if (recordBtn) recordBtn.classList.add('recording');
    if (keysEl) keysEl.style.display = 'none';
    if (recordingEl) recordingEl.style.display = 'inline-flex';
    window.addEventListener('keydown', onKeyRecord, { capture: true });
  }

  function stopRecording() {
    if (!isRecording) return;
    isRecording = false;
    if (recordBtn) recordBtn.classList.remove('recording');
    if (keysEl) keysEl.style.display = 'inline-flex';
    if (recordingEl) recordingEl.style.display = 'none';
    window.removeEventListener('keydown', onKeyRecord, { capture: true });
  }

  async function onKeyRecord(e) {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      stopRecording();
      return;
    }

    const isPureModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key);
    if (isPureModifier) {
      const mods = [];
      if (e.metaKey) mods.push(currentPlatform === 'darwin' ? 'Cmd' : 'Super');
      if (e.ctrlKey) mods.push('Ctrl');
      if (e.altKey) mods.push(currentPlatform === 'darwin' ? 'Opt' : 'Alt');
      if (e.shiftKey) mods.push('Shift');
      const label = recordingEl ? recordingEl.querySelector('.hk-rec-label') : null;
      if (label) {
        label.textContent = mods.length > 0 ? mods.join(' + ') + ' + ...' : 'Press keys...';
      }
      return;
    }

    const hasModifier = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
    const isFunctionKey = /^F([1-9]|1[0-9]|2[0-4])$/i.test(e.key);

    if (!hasModifier && !isFunctionKey) {
      showFeedback('Must include a modifier (Ctrl, Alt, Shift, or Cmd/Super)', 'error', 3000);
      stopRecording();
      return;
    }

    const parts = [];
    if (e.ctrlKey) parts.push('Control');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push(currentPlatform === 'darwin' ? 'Command' : 'Super');

    let keyPart = null;
    if (e.code && e.code.startsWith('Key')) {
      keyPart = e.code.replace('Key', '').toUpperCase();
    } else if (e.code && e.code.startsWith('Digit')) {
      keyPart = e.code.replace('Digit', '');
    } else if (isFunctionKey) {
      keyPart = e.key.toUpperCase();
    } else if (e.code === 'Space' || e.key === ' ') {
      keyPart = 'Space';
    } else if (e.code === 'Tab') {
      keyPart = 'Tab';
    } else if (e.code === 'Enter') {
      keyPart = 'Return';
    } else if (e.code === 'Backspace') {
      keyPart = 'Backspace';
    } else if (e.code === 'Delete') {
      keyPart = 'Delete';
    } else {
      keyPart = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    }

    parts.push(keyPart);
    stopRecording();
    await applyShortcut(parts.join('+'));
  }

  // ── Event Bindings ──

  if (panelCloseBtn) {
    panelCloseBtn.addEventListener('click', closePanel);
  }

  if (openPrefsBtn) {
    openPrefsBtn.addEventListener('click', function () {
      if (window.clipboardAPI && window.clipboardAPI.openAbout) {
        window.clipboardAPI.openAbout();
      }
    });
  }

  if (footerHotkeyBtn) {
    footerHotkeyBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePanel();
    });
  }

  if (recordBtn) {
    recordBtn.addEventListener('click', function () {
      if (isRecording) stopRecording(); else startRecording();
    });
  }

  // Reset to default
  if (resetBtn) {
    resetBtn.addEventListener('click', async function () {
      stopRecording();
      const api = (window.clipboardAPI && window.clipboardAPI.resetShortcut)
        ? window.clipboardAPI
        : (window.aboutAPI && window.aboutAPI.resetShortcut ? window.aboutAPI : null);

      if (!api) return;

      try {
        const res = await api.resetShortcut();
        if (res && res.success) {
          activeShortcut = res.shortcut;
          renderKeys(res.displayTokens);
          populatePresets();
          updateFooterBadge(res.displayString);
          showFeedback('Reset to default: ' + res.displayString, 'success');
        }
      } catch (err) {
        console.error('[HotkeyPanel] Failed to reset shortcut:', err);
      }
    });
  }

  // Manual input
  if (applyManualBtn && manualInput) {
    applyManualBtn.addEventListener('click', async function () {
      const val = manualInput.value.trim();
      if (!val) {
        showFeedback('Enter a shortcut (e.g. Ctrl+Alt+V)', 'error', 2500);
        return;
      }
      const ok = await applyShortcut(val);
      if (ok) manualInput.value = '';
    });

    manualInput.addEventListener('keydown', async function (e) {
      if (e.key === 'Enter') {
        const val = manualInput.value.trim();
        if (!val) return;
        const ok = await applyShortcut(val);
        if (ok) manualInput.value = '';
      }
    });
  }

  // Sync updates from other windows (e.g. Tray menu or Preferences dialog)
  if (window.clipboardAPI && window.clipboardAPI.onShortcutUpdated) {
    window.clipboardAPI.onShortcutUpdated(function (data) {
      if (data && data.shortcut) {
        activeShortcut = data.shortcut;
        if (data.displayTokens) renderKeys(data.displayTokens);
        updateFooterBadge(data.displayString || data.shortcut);
        populatePresets();
      }
    });
  }

  // Reload shortcut whenever HUD window is displayed
  if (window.clipboardAPI && window.clipboardAPI.onWindowShown) {
    window.clipboardAPI.onWindowShown(function () {
      loadCurrentShortcut();
    });
  }

  // Initial load
  loadCurrentShortcut();

  // Expose global interface
  window.HotkeyPanel = {
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    loadCurrentShortcut: loadCurrentShortcut
  };
})();
