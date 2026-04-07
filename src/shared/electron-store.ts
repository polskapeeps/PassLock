import type { ElectronVaultBridge, VaultRepository } from "./types";

declare global {
  interface Window {
    passlock?: ElectronVaultBridge;
  }
}

export class ElectronVaultRepository implements VaultRepository {
  private readonly vault;

  constructor() {
    if (!window.passlock?.vault) {
      throw new Error("Electron vault bridge is unavailable.");
    }

    this.vault = window.passlock.vault;
  }

  getProfile() {
    return this.vault.getProfile();
  }

  saveProfile(profile: Parameters<ElectronVaultBridge["vault"]["saveProfile"]>[0]) {
    return this.vault.saveProfile(profile);
  }

  getAppSettings() {
    return this.vault.getAppSettings();
  }

  saveAppSettings(settings: Parameters<ElectronVaultBridge["vault"]["saveAppSettings"]>[0]) {
    return this.vault.saveAppSettings(settings);
  }

  getSyncState() {
    return this.vault.getSyncState();
  }

  saveSyncState(syncState: Parameters<ElectronVaultBridge["vault"]["saveSyncState"]>[0]) {
    return this.vault.saveSyncState(syncState);
  }

  listEntries() {
    return this.vault.listEntries();
  }

  getEntry(entryId: string) {
    return this.vault.getEntry(entryId);
  }

  saveEntry(entry: Parameters<ElectronVaultBridge["vault"]["saveEntry"]>[0]) {
    return this.vault.saveEntry(entry);
  }

  saveEntries(entries: Parameters<ElectronVaultBridge["vault"]["saveEntries"]>[0]) {
    return this.vault.saveEntries(entries);
  }

  deleteEntry(entryId: string, deletedAt: string) {
    return this.vault.deleteEntry(entryId, deletedAt);
  }

  listMutations() {
    return this.vault.listMutations();
  }

  queueMutation(mutation: Parameters<ElectronVaultBridge["vault"]["queueMutation"]>[0]) {
    return this.vault.queueMutation(mutation);
  }

  markMutationsSynced(ids: string[], syncedAt: string) {
    return this.vault.markMutationsSynced(ids, syncedAt);
  }

  getSnapshot() {
    return this.vault.getSnapshot();
  }
}
