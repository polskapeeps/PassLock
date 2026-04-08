import { describe, expect, it, vi } from "vitest";

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
import { SupabaseSyncService } from "./sync-service";

class SyncRepositoryStub implements VaultRepository {
  profile: VaultProfileRecord | null = {
    id: "local",
    wrappedVaultKey: {
      version: 1,
      algorithm: "xchacha20poly1305-ietf",
      nonce: "nonce",
      cipherText: "cipher",
      context: "passlock:vault-key",
    },
    kdf: {
      algorithm: "argon2id13",
      salt: "salt",
      opsLimit: 4,
      memLimitBytes: 1024,
    },
    createdAt: "2026-04-07T00:00:00.000Z",
    updatedAt: "2026-04-07T00:00:00.000Z",
  };
  settings: AppSettings = { ...DEFAULT_APP_SETTINGS };
  syncState: SyncState = DEFAULT_SYNC_STATE("device_sync");
  entries = new Map<string, StoredVaultEntryRecord>();
  mutations: VaultMutation[] = [];

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
    return [...this.entries.values()];
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
    this.entries.set(entryId, { ...existing, deletedAt, updatedAt: deletedAt });
  }

  async listMutations() {
    return this.mutations;
  }

  async queueMutation(mutation: VaultMutation) {
    this.mutations.push(mutation);
  }

  async markMutationsSynced(ids: string[], syncedAt: string) {
    this.mutations = this.mutations.map((mutation) =>
      ids.includes(mutation.id) ? { ...mutation, syncedAt } : mutation
    );
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

describe("SupabaseSyncService", () => {
  it("reconciles remote tombstones against local entries", () => {
    const repository = new SyncRepositoryStub();
    const service = new SupabaseSyncService(repository) as unknown as {
      reconcileRecords: (
        localEntries: StoredVaultEntryRecord[],
        remoteEntries: Array<{
          entry_id: string;
          envelope: StoredVaultEntryRecord["envelope"];
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        }>,
        deletes: Array<{ entry_id: string; deleted_at: string }>
      ) => StoredVaultEntryRecord[];
    };

    const localEntry: StoredVaultEntryRecord = {
      id: "entry_1",
      envelope: {
        version: 1,
        algorithm: "xchacha20poly1305-ietf",
        nonce: "nonce",
        cipherText: "cipher",
        context: "passlock:entry:entry_1",
      },
      createdAt: "2026-04-07T00:00:00.000Z",
      updatedAt: "2026-04-07T01:00:00.000Z",
      deletedAt: null,
    };

    const reconciled = service.reconcileRecords(
      [localEntry],
      [],
      [{ entry_id: "entry_1", deleted_at: "2026-04-07T02:00:00.000Z" }]
    );

    expect(reconciled[0]?.deletedAt).toBe("2026-04-07T02:00:00.000Z");
    expect(reconciled[0]?.updatedAt).toBe("2026-04-07T02:00:00.000Z");
  });

  it("pushes profile updates when settings mutations are pending", async () => {
    const repository = new SyncRepositoryStub();
    repository.mutations = [
      {
        id: "mutation_1",
        kind: "settings",
        recordId: "settings",
        payload: JSON.stringify({ clipboardClearMs: 5000 }),
        createdAt: "2026-04-07T00:00:00.000Z",
        updatedAt: "2026-04-07T00:00:00.000Z",
        syncedAt: null,
      },
    ];

    const service = new SupabaseSyncService(repository) as unknown as {
      client: object | null;
      pushProfile: (client: object, session: { user: { id: string } }, snapshot: RepositorySnapshot) => Promise<void>;
      pullEntries: () => Promise<unknown[]>;
      pullDeletes: () => Promise<unknown[]>;
      requireClient: () => object;
      requireSession: () => Promise<{ user: { id: string } }>;
      syncNow: () => Promise<{ uploaded: number; downloaded: number; deleted: number; lastSyncedAt: string | null }>;
    };

    const pushProfile = vi.fn(async () => {});
    service.client = {};
    service.pushProfile = pushProfile;
    service.pullEntries = vi.fn(async () => []);
    service.pullDeletes = vi.fn(async () => []);
    service.requireClient = vi.fn(() => ({}));
    service.requireSession = vi.fn(async () => ({ user: { id: "user_1" } }));

    const result = await service.syncNow();

    expect(pushProfile).toHaveBeenCalledTimes(1);
    expect(result.uploaded).toBe(0);
    expect(repository.mutations[0]?.syncedAt).not.toBeNull();
  });

  it("compacts multiple unsynced writes for the same entry before upload", async () => {
    const repository = new SyncRepositoryStub();
    repository.mutations = [
      {
        id: "mutation_1",
        kind: "upsert",
        recordId: "entry_1",
        payload: JSON.stringify({
          id: "entry_1",
          envelope: {
            version: 1,
            algorithm: "xchacha20poly1305-ietf",
            nonce: "nonce_old",
            cipherText: "cipher_old",
            context: "passlock:entry:entry_1",
          },
          createdAt: "2026-04-07T00:00:00.000Z",
          updatedAt: "2026-04-07T00:00:00.000Z",
          deletedAt: null,
        }),
        createdAt: "2026-04-07T00:00:00.000Z",
        updatedAt: "2026-04-07T00:00:00.000Z",
        syncedAt: null,
      },
      {
        id: "mutation_2",
        kind: "upsert",
        recordId: "entry_1",
        payload: JSON.stringify({
          id: "entry_1",
          envelope: {
            version: 1,
            algorithm: "xchacha20poly1305-ietf",
            nonce: "nonce_new",
            cipherText: "cipher_new",
            context: "passlock:entry:entry_1",
          },
          createdAt: "2026-04-07T00:00:00.000Z",
          updatedAt: "2026-04-07T01:00:00.000Z",
          deletedAt: null,
        }),
        createdAt: "2026-04-07T01:00:00.000Z",
        updatedAt: "2026-04-07T01:00:00.000Z",
        syncedAt: null,
      },
    ];

    const service = new SupabaseSyncService(repository) as unknown as {
      client: object | null;
      pushProfile: (client: object, session: { user: { id: string } }, snapshot: RepositorySnapshot) => Promise<void>;
      pushEntry: (client: object, session: { user: { id: string } }, record: StoredVaultEntryRecord, deviceId: string) => Promise<void>;
      pullEntries: () => Promise<unknown[]>;
      pullDeletes: () => Promise<unknown[]>;
      requireClient: () => object;
      requireSession: () => Promise<{ user: { id: string } }>;
      syncNow: () => Promise<{ uploaded: number; downloaded: number; deleted: number; lastSyncedAt: string | null }>;
    };

    const pushEntry = vi.fn(async () => {});
    service.client = {};
    service.pushProfile = vi.fn(async () => {});
    service.pushEntry = pushEntry;
    service.pullEntries = vi.fn(async () => []);
    service.pullDeletes = vi.fn(async () => []);
    service.requireClient = vi.fn(() => ({}));
    service.requireSession = vi.fn(async () => ({ user: { id: "user_1" } }));

    const result = await service.syncNow();

    expect(pushEntry).toHaveBeenCalledTimes(1);
    expect(pushEntry.mock.calls[0]?.[2]).toMatchObject({
      id: "entry_1",
      updatedAt: "2026-04-07T01:00:00.000Z",
    });
    expect(result.uploaded).toBe(1);
    expect(repository.mutations.every((mutation) => mutation.syncedAt !== null)).toBe(true);
  });
});
