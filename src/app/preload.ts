import { contextBridge, ipcRenderer } from "electron";

import type { AppSettings, ElectronVaultBridge, SyncState, VaultMutation, VaultProfileRecord } from "../shared/types";

const api: ElectronVaultBridge = {
  vault: {
    getProfile: () => ipcRenderer.invoke("vault:get-profile"),
    saveProfile: (profile: VaultProfileRecord) => ipcRenderer.invoke("vault:save-profile", profile),
    getAppSettings: () => ipcRenderer.invoke("vault:get-settings"),
    saveAppSettings: (settings: AppSettings) => ipcRenderer.invoke("vault:save-settings", settings),
    getSyncState: () => ipcRenderer.invoke("vault:get-sync-state"),
    saveSyncState: (syncState: SyncState) => ipcRenderer.invoke("vault:save-sync-state", syncState),
    listEntries: () => ipcRenderer.invoke("vault:list-entries"),
    getEntry: (entryId: string) => ipcRenderer.invoke("vault:get-entry", entryId),
    saveEntry: (entry) => ipcRenderer.invoke("vault:save-entry", entry),
    saveEntries: (entries) => ipcRenderer.invoke("vault:save-entries", entries),
    deleteEntry: (entryId: string, deletedAt: string) =>
      ipcRenderer.invoke("vault:delete-entry", entryId, deletedAt),
    listMutations: () => ipcRenderer.invoke("vault:list-mutations"),
    queueMutation: (mutation: VaultMutation) => ipcRenderer.invoke("vault:queue-mutation", mutation),
    markMutationsSynced: (ids: string[], syncedAt: string) =>
      ipcRenderer.invoke("vault:mark-mutations-synced", ids, syncedAt),
    getSnapshot: () => ipcRenderer.invoke("vault:get-snapshot"),
  },
  clipboard: {
    copySecret: (value: string, clearAfterMs: number) =>
      ipcRenderer.invoke("clipboard:copy-secret", value, clearAfterMs),
  },
  app: {
    isElectron: () => true,
    platform: () => ipcRenderer.invoke("app:get-platform"),
    getDesktopSettings: () => ipcRenderer.invoke("app:get-desktop-settings"),
    saveDesktopSettings: (settings) => ipcRenderer.invoke("app:save-desktop-settings", settings),
    onLockRequested: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on("app:lock-requested", listener);
      return () => ipcRenderer.removeListener("app:lock-requested", listener);
    },
  },
  sync: {
    onSyncRequested: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on("sync:requested", listener);
      return () => ipcRenderer.removeListener("sync:requested", listener);
    },
  },
};

contextBridge.exposeInMainWorld("passlock", api);
