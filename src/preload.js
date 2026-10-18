const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clipboardAPI', {
  getItems: (filter) => ipcRenderer.invoke('get-items', filter),
  search: (query) => ipcRenderer.invoke('search-items', query),
  pasteItem: (id) => ipcRenderer.invoke('paste-item', id),
  togglePin: (id) => ipcRenderer.invoke('toggle-pin', id),
  deleteItem: (id) => ipcRenderer.invoke('delete-item', id),
  clearUnpinned: () => ipcRenderer.invoke('clear-unpinned'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  checkPermissions: () => ipcRenderer.invoke('check-permissions'),
  requestPermissions: () => ipcRenderer.invoke('request-permissions'),
  openGuide: () => ipcRenderer.invoke('open-accessibility-guide'),
  onClipboardChanged: (callback) => {
    ipcRenderer.on('clipboard-item-added', (_event, item) => callback(item));
  },
  onWindowShown: (callback) => {
    ipcRenderer.on('window-shown', () => callback());
  },
  hudReady: () => ipcRenderer.send('hud-ready')
});

contextBridge.exposeInMainWorld('aboutAPI', {
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  setAutoStart: (enabled) => ipcRenderer.invoke('set-auto-start', enabled),
  closeWindow: () => ipcRenderer.invoke('close-about'),
  uninstallApp: (options) => ipcRenderer.invoke('uninstall-app', options)
});
