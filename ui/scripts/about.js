document.addEventListener('DOMContentLoaded', async () => {
  const versionEl = document.getElementById('app-version');
  const shortcutRecordBtn = document.getElementById('shortcut-record-btn');
  const shortcutKeysWrapper = document.getElementById('shortcut-keys-wrapper');
  const shortcutRecordingState = document.getElementById('shortcut-recording-state');
  const shortcutSubtext = document.getElementById('shortcut-subtext');
  const shortcutFeedback = document.getElementById('shortcut-feedback');
  const openPresetsBtn = document.getElementById('open-presets-btn');
  const resetShortcutBtn = document.getElementById('reset-shortcut-btn');

  const presetsModal = document.getElementById('presets-modal');
  const closePresetsModalBtn = document.getElementById('close-presets-modal-btn');
  const presetsChipGrid = document.getElementById('presets-chip-grid');
  const manualShortcutInput = document.getElementById('manual-shortcut-input');
  const applyManualBtn = document.getElementById('apply-manual-btn');
  const presetErrorBanner = document.getElementById('preset-error-banner');

  const autostartToggle = document.getElementById('autostart-toggle');
  const closeBtn = document.getElementById('close-about-btn');
  const uninstallBtn = document.getElementById('uninstall-btn');
  const confirmModal = document.getElementById('confirm-modal');
  const cancelUninstallBtn = document.getElementById('cancel-uninstall-btn');
  const confirmUninstallBtn = document.getElementById('confirm-uninstall-btn');
  const deleteHistoryCheck = document.getElementById('delete-history-check');

  let currentPlatform = 'darwin';
  let activeShortcut = 'Command+Shift+V';
  let defaultShortcut = 'Command+Shift+V';
  let isRecording = false;
  let feedbackTimer = null;

  // Render tokens as <kbd>Key</kbd> <span class="plus">+</span> ...
  function renderShortcutBadges(tokens) {
    if (!shortcutKeysWrapper) return;
    shortcutKeysWrapper.innerHTML = '';
    tokens.forEach((token, index) => {
      const kbd = document.createElement('kbd');
      kbd.textContent = token;
      shortcutKeysWrapper.appendChild(kbd);

      if (index < tokens.length - 1) {
        const plus = document.createElement('span');
        plus.className = 'plus';
        plus.textContent = '+';
        shortcutKeysWrapper.appendChild(plus);
      }
    });
  }

  function showFeedback(message, type = 'success', duration = 2800) {
    if (!shortcutFeedback) return;
    clearTimeout(feedbackTimer);
    shortcutFeedback.textContent = message;
    shortcutFeedback.className = `shortcut-feedback-banner ${type}`;
    shortcutFeedback.style.display = 'block';

    if (duration > 0) {
      feedbackTimer = setTimeout(() => {
        shortcutFeedback.style.display = 'none';
      }, duration);
    }
  }

  function showPresetError(message) {
    if (!presetErrorBanner) return;
    if (!message) {
      presetErrorBanner.style.display = 'none';
      presetErrorBanner.textContent = '';
      return;
    }
    presetErrorBanner.textContent = message;
    presetErrorBanner.style.display = 'block';
  }

  // Populate preset chips based on platform
  function populatePresets() {
    if (!presetsChipGrid) return;
    presetsChipGrid.innerHTML = '';

    const isMac = currentPlatform === 'darwin';
    const presets = isMac ? [
      { id: 'Command+Shift+V', label: 'Cmd + Shift + V (Default)' },
      { id: 'Command+Alt+V', label: 'Cmd + Opt + V' },
      { id: 'Alt+Space', label: 'Opt + Space' },
      { id: 'Super+V', label: 'Cmd + V (Super)' },
      { id: 'Command+Shift+C', label: 'Cmd + Shift + C' },
      { id: 'Control+Space', label: 'Ctrl + Space' }
    ] : [
      { id: 'Control+Shift+V', label: 'Ctrl + Shift + V (Default)' },
      { id: 'Control+Alt+V', label: 'Ctrl + Alt + V' },
      { id: 'Alt+Space', label: 'Alt + Space' },
      { id: 'Super+V', label: 'Super + V (Win + V)' },
      { id: 'Control+Shift+C', label: 'Ctrl + Shift + C' },
      { id: 'Control+Space', label: 'Ctrl + Space' }
    ];

    presets.forEach(p => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'preset-chip' + (p.id.toLowerCase() === activeShortcut.toLowerCase() ? ' active' : '');
      chip.textContent = p.label;
      chip.addEventListener('click', async () => {
        showPresetError('');
        await applyNewShortcut(p.id);
        if (presetsModal) presetsModal.style.display = 'none';
      });
      presetsChipGrid.appendChild(chip);
    });
  }

  async function applyNewShortcut(candidate) {
    if (!candidate || !candidate.trim()) return false;
    if (!window.aboutAPI || !window.aboutAPI.setShortcut) return false;

    try {
      const result = await window.aboutAPI.setShortcut(candidate.trim());
      if (result.success) {
        activeShortcut = result.shortcut;
        renderShortcutBadges(result.displayTokens);
        populatePresets();
        showFeedback(`Shortcut updated to ${result.displayString}`, 'success');
        showPresetError('');
        return true;
      } else {
        const err = result.error || 'Failed to register shortcut with system.';
        showFeedback(err, 'error', 4000);
        showPresetError(err);
        return false;
      }
    } catch (err) {
      console.error('Error setting shortcut:', err);
      showFeedback('Unexpected error setting shortcut.', 'error', 3500);
      return false;
    }
  }

  // Initial load
  if (window.aboutAPI && window.aboutAPI.getAppInfo) {
    try {
      const info = await window.aboutAPI.getAppInfo();
      if (info) {
        if (versionEl) versionEl.textContent = `v${info.version}`;
        if (autostartToggle) autostartToggle.checked = info.autoStart;
        currentPlatform = info.platform || 'darwin';
        activeShortcut = info.shortcut || (currentPlatform === 'darwin' ? 'Command+Shift+V' : 'Control+Shift+V');
        defaultShortcut = info.defaultShortcut || activeShortcut;

        if (info.displayTokens && info.displayTokens.length > 0) {
          renderShortcutBadges(info.displayTokens);
        } else {
          renderShortcutBadges(currentPlatform === 'darwin' ? ['Cmd', 'Shift', 'V'] : ['Ctrl', 'Shift', 'V']);
        }

        populatePresets();
      }
    } catch (err) {
      console.error('Failed to load app info:', err);
    }
  }

  // Real-time synchronization if shortcut changes from another window or CLI
  if (window.aboutAPI && window.aboutAPI.onShortcutUpdated) {
    window.aboutAPI.onShortcutUpdated((data) => {
      if (data && data.shortcut) {
        activeShortcut = data.shortcut;
        if (data.displayTokens) {
          renderShortcutBadges(data.displayTokens);
        }
        populatePresets();
      }
    });
  }

  // Interactive Shortcut Recording Mode
  function startRecording() {
    if (isRecording) return;
    isRecording = true;
    if (shortcutRecordBtn) shortcutRecordBtn.classList.add('recording');
    if (shortcutKeysWrapper) shortcutKeysWrapper.style.display = 'none';
    if (shortcutRecordingState) shortcutRecordingState.style.display = 'inline-flex';
    if (shortcutSubtext) shortcutSubtext.textContent = 'Press keys (Esc to cancel)';
    window.addEventListener('keydown', handleKeyRecord, { capture: true });
  }

  function stopRecording() {
    if (!isRecording) return;
    isRecording = false;
    if (shortcutRecordBtn) shortcutRecordBtn.classList.remove('recording');
    if (shortcutKeysWrapper) shortcutKeysWrapper.style.display = 'inline-flex';
    if (shortcutRecordingState) shortcutRecordingState.style.display = 'none';
    if (shortcutSubtext) shortcutSubtext.textContent = 'Click to rebind';
    window.removeEventListener('keydown', handleKeyRecord, { capture: true });
  }

  async function handleKeyRecord(e) {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      stopRecording();
      return;
    }

    // Ignore pure modifier presses alone while waiting for the key
    const isPureModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key);
    if (isPureModifier) {
      // Give visual cue that modifiers are being held down
      const pressedMods = [];
      if (e.metaKey) pressedMods.push(currentPlatform === 'darwin' ? 'Cmd' : 'Super');
      if (e.ctrlKey) pressedMods.push('Ctrl');
      if (e.altKey) pressedMods.push(currentPlatform === 'darwin' ? 'Opt' : 'Alt');
      if (e.shiftKey) pressedMods.push('Shift');
      const labelEl = shortcutRecordingState ? shortcutRecordingState.querySelector('.recording-label') : null;
      if (labelEl) {
        labelEl.textContent = pressedMods.length > 0 ? `${pressedMods.join(' + ')} + ...` : 'Press keys...';
      }
      return;
    }

    // Capture non-modifier key
    const hasModifier = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
    const isFunctionKey = /^F([1-9]|1[0-9]|2[0-4])$/i.test(e.key);

    if (!hasModifier && !isFunctionKey) {
      showFeedback('Please include a modifier key (Ctrl, Alt, Shift, or Cmd/Super)', 'error', 3000);
      stopRecording();
      return;
    }

    // Build accelerator string
    const parts = [];
    if (e.ctrlKey) parts.push('Control');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) {
      parts.push(currentPlatform === 'darwin' ? 'Command' : 'Super');
    }

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
    } else if (e.code === 'Backquote') {
      keyPart = '`';
    } else if (['-', '=', '[', ']', '\\', ';', '\'', ',', '.', '/'].includes(e.key)) {
      keyPart = e.key;
    } else {
      keyPart = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    }

    parts.push(keyPart);
    const candidateAccelerator = parts.join('+');

    stopRecording();
    await applyNewShortcut(candidateAccelerator);
  }

  // Toggle recording mode on click
  if (shortcutRecordBtn) {
    shortcutRecordBtn.addEventListener('click', () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    });
  }

  // Reset to default
  if (resetShortcutBtn) {
    resetShortcutBtn.addEventListener('click', async () => {
      stopRecording();
      if (window.aboutAPI && window.aboutAPI.resetShortcut) {
        try {
          const res = await window.aboutAPI.resetShortcut();
          if (res.success) {
            activeShortcut = res.shortcut;
            renderShortcutBadges(res.displayTokens);
            populatePresets();
            showFeedback(`Reset to default: ${res.displayString}`, 'success');
          }
        } catch (err) {
          console.error('Failed to reset shortcut:', err);
        }
      }
    });
  }

  // Open & Close Presets Modal
  if (openPresetsBtn) {
    openPresetsBtn.addEventListener('click', () => {
      stopRecording();
      showPresetError('');
      if (manualShortcutInput) {
        manualShortcutInput.value = '';
        manualShortcutInput.placeholder = `e.g. ${currentPlatform === 'darwin' ? 'Cmd+Opt+V' : 'Ctrl+Alt+V'}`;
      }
      if (presetsModal) {
        presetsModal.style.display = 'flex';
        populatePresets();
      }
    });
  }

  if (closePresetsModalBtn) {
    closePresetsModalBtn.addEventListener('click', () => {
      if (presetsModal) presetsModal.style.display = 'none';
    });
  }

  // Apply manual typed accelerator
  if (applyManualBtn && manualShortcutInput) {
    applyManualBtn.addEventListener('click', async () => {
      const val = manualShortcutInput.value.trim();
      if (!val) {
        showPresetError('Please enter a shortcut string.');
        return;
      }
      const ok = await applyNewShortcut(val);
      if (ok && presetsModal) {
        presetsModal.style.display = 'none';
      }
    });

    manualShortcutInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const val = manualShortcutInput.value.trim();
        if (!val) return;
        const ok = await applyNewShortcut(val);
        if (ok && presetsModal) {
          presetsModal.style.display = 'none';
        }
      }
    });
  }

  // Toggle autostart
  if (autostartToggle) {
    autostartToggle.addEventListener('change', async (e) => {
      if (window.aboutAPI) {
        await window.aboutAPI.setAutoStart(e.target.checked);
      }
    });
  }

  // Close about window
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (window.aboutAPI) {
        window.aboutAPI.closeWindow();
      } else {
        window.close();
      }
    });
  }

  // Open uninstall modal
  if (uninstallBtn) {
    uninstallBtn.addEventListener('click', () => {
      stopRecording();
      if (confirmModal) confirmModal.style.display = 'flex';
    });
  }

  // Cancel uninstall
  if (cancelUninstallBtn) {
    cancelUninstallBtn.addEventListener('click', () => {
      if (confirmModal) confirmModal.style.display = 'none';
    });
  }

  // Confirm uninstall
  if (confirmUninstallBtn) {
    confirmUninstallBtn.addEventListener('click', async () => {
      const deleteHistory = deleteHistoryCheck ? deleteHistoryCheck.checked : false;
      confirmUninstallBtn.textContent = 'Uninstalling...';
      confirmUninstallBtn.disabled = true;

      if (window.aboutAPI) {
        await window.aboutAPI.uninstallApp({ deleteHistory });
      }
    });
  }

  // Keyboard shortcut: Escape to close modals or window
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isRecording) {
        stopRecording();
      } else if (presetsModal && presetsModal.style.display === 'flex') {
        presetsModal.style.display = 'none';
      } else if (confirmModal && confirmModal.style.display === 'flex') {
        confirmModal.style.display = 'none';
      } else if (window.aboutAPI) {
        window.aboutAPI.closeWindow();
      }
    }
  });
});
