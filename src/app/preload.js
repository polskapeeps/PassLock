const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('passlockAPI', {
  listVaultEntries: () => ipcRenderer.invoke('vault:list'),
  saveVaultEntry: (entry) => ipcRenderer.invoke('vault:save', entry),
  deleteVaultEntry: (id) => ipcRenderer.invoke('vault:delete', id),
});
