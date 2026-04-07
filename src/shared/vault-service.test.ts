import { describe, expect, it } from "vitest";

import { DEFAULT_APP_SETTINGS, DEFAULT_SYNC_STATE } from "./constants";
import type {
  AppSettings,
  RepositorySnapshot,
  StoredVaultEntryRecord,
  SyncState,
  VaultMutation,
  VaultProfileRecord,
  VaultRepository,
} from "./types";
import { VaultService } from "./vault-service";

class MemoryVaultRepository implements VaultRepository {
  private profile: VaultProfileRecord | null = null;
  private settings: AppSettings = { ...DEFAULT_APP_SETTINGS };
  private syncState: SyncState = DEFAULT_SYNC_STATE("device_test");
  private entries = new Map<string, StoredVaultEntryRecord>();
  private mutations = new Map<string, VaultMutation>();

  async getProfile() {
    return this.profile;
  }

  async saveProfile(profile: VaultProfileRecord) {
    this.profile = profile;
  }

  async getAppSettings() {
    return this.settings;
  }

  async saveAppSettings(settings: AppSettings) {
    this.settings = settings;
  }

  async getSyncState() {
    return this.syncState;
  }

  async saveSyncState(syncState: SyncState) {
    this.syncState = syncState;
  }

  async listEntries() {
    return [...this.entries.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async getEntry(entryId: string) {
    return this.entries.get(entryId) ?? null;
  }

  async saveEntry(entry: StoredVaultEntryRecord) {
    this.entries.set(entry.id, entry);
  }

  async saveEntries(entries: StoredVaultEntryRecord[]) {
    entries.forEach((entry) => {
      this.entries.set(entry.id, entry);
    });
  }

  async deleteEntry(entryId: string, deletedAt: string) {
    const existing = this.entries.get(entryId);
    if (!existing) return;

    this.entries.set(entryId, {
      ...existing,
      deletedAt,
      updatedAt: deletedAt,
    });
  }

  async listMutations() {
    return [...this.mutations.values()].filter((mutation) => mutation.syncedAt === null);
  }

  async queueMutation(mutation: VaultMutation) {
    this.mutations.set(mutation.id, mutation);
  }

  async markMutationsSynced(ids: string[], syncedAt: string) {
    ids.forEach((id) => {
      const existing = this.mutations.get(id);
      if (!existing) return;
      this.mutations.set(id, { ...existing, syncedAt });
    });
  }

  async getSnapshot(): Promise<RepositorySnapshot> {
    return {
      profile: this.profile,
      settings: this.settings,
      sync: this.syncState,
      entries: await this.listEntries(),
    };
  }
}

describe("VaultService", () => {
  it("creates, unlocks, saves, lists, and deletes encrypted entries", async () => {
    const repository = new MemoryVaultRepository();
    const service = new VaultService(repository);

    const session = await service.setupMasterPassword(
      "this is a very strong master password",
      "this is a very strong master password"
    );
    expect(session.hasVault).toBe(true);
    expect(session.isUnlocked).toBe(true);

    const savedEntry = await service.saveEntry({
      title: "GitHub",
      username: "builder",
      password: "StrongPassword!234",
      url: "https://github.com",
      notes: "Primary account",
      tags: ["work", "code"],
    });

    let entries = await service.listEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.title).toBe("GitHub");

    await service.deleteEntry(savedEntry.id);
    entries = await service.listEntries();
    expect(entries).toHaveLength(0);

    service.lock();
    expect(service.isUnlocked()).toBe(false);

    await service.unlock("this is a very strong master password");
    expect(service.isUnlocked()).toBe(true);
  });

  it("exports and imports an encrypted vault snapshot", async () => {
    const sourceRepository = new MemoryVaultRepository();
    const sourceService = new VaultService(sourceRepository);

    await sourceService.setupMasterPassword(
      "another very strong master password",
      "another very strong master password"
    );
    await sourceService.saveEntry({
      title: "Email",
      username: "user@example.com",
      password: "AnotherStrongPassword!234",
      url: "https://mail.example.com",
      notes: "Imported later",
      tags: ["personal"],
    });

    const exported = await sourceService.exportVault();

    const targetRepository = new MemoryVaultRepository();
    const targetService = new VaultService(targetRepository);
    await targetService.importVault(exported);
    await targetService.unlock("another very strong master password");

    const importedEntries = await targetService.listEntries();
    expect(importedEntries).toHaveLength(1);
    expect(importedEntries[0]?.username).toBe("user@example.com");
  });
});
