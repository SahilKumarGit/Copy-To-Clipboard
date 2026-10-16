document.addEventListener('DOMContentLoaded', async () => {
  const versionEl = document.getElementById('app-version');
  const shortcutEl = document.getElementById('shortcut-label');
  const autostartToggle = document.getElementById('autostart-toggle');
  const closeBtn = document.getElementById('close-about-btn');
  const uninstallBtn = document.getElementById('uninstall-btn');
  const confirmModal = document.getElementById('confirm-modal');
  const cancelUninstallBtn = document.getElementById('cancel-uninstall-btn');
  const confirmUninstallBtn = document.getElementById('confirm-uninstall-btn');
  const deleteHistoryCheck = document.getElementById('delete-history-check');

  // Load app info
  if (window.aboutAPI) {
    try {
      const info = await window.aboutAPI.getAppInfo();
      if (info) {
        if (versionEl) versionEl.textContent = `v${info.version}`;
        if (autostartToggle) autostartToggle.checked = info.autoStart;
        if (shortcutEl) {
          const key = info.platform === 'darwin' ? 'Cmd' : 'Ctrl';
          shortcutEl.innerHTML = `<kbd>${key}</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd>`;
        }
      }
    } catch (err) {
      console.error('Failed to load app info:', err);
    }
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
      if (confirmModal) {
        confirmModal.style.display = 'flex';
      }
    });
  }

  // Cancel uninstall
  if (cancelUninstallBtn) {
    cancelUninstallBtn.addEventListener('click', () => {
      if (confirmModal) {
        confirmModal.style.display = 'none';
      }
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

  // Keyboard shortcut: Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (confirmModal && confirmModal.style.display === 'flex') {
        confirmModal.style.display = 'none';
      } else if (window.aboutAPI) {
        window.aboutAPI.closeWindow();
      }
    }
  });
});
