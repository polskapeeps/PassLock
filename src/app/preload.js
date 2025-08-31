const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('passwordStore', {
  add: (entry) => ipcRenderer.invoke('password-add', entry),
  getAll: () => ipcRenderer.invoke('password-get-all'),
  remove: (id) => ipcRenderer.invoke('password-remove', id)
});
