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
  onClipboardChanged: (callback) => {
    ipcRenderer.on('clipboard-item-added', (_event, item) => callback(item));
  }
});
