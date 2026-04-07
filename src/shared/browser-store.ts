import { openDB } from "idb";

import { DEFAULT_APP_SETTINGS, DEFAULT_SYNC_STATE } from "./constants";
import { randomId } from "./security";
import type {
  AppSettings,
  RepositorySnapshot,
  StoredVaultEntryRecord,
  SyncState,
  VaultMutation,
  VaultProfileRecord,
  VaultRepository,
} from "./types";

const DATABASE_NAME = "passlock-vault";
const DATABASE_VERSION = 1;
const PROFILE_KEY = "profile";
const SETTINGS_KEY = "settings";
const SYNC_KEY = "sync";

type StoreNames = "meta" | "entries" | "mutations";

async function getDatabase() {
  return openDB(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains("meta")) {
        database.createObjectStore("meta");
      }

      if (!database.objectStoreNames.contains("entries")) {
        database.createObjectStore("entries", { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains("mutations")) {
        database.createObjectStore("mutations", { keyPath: "id" });
      }
    },
  });
}

async function getMetaValue<T>(key: string, fallback: () => Promise<T> | T): Promise<T> {
  const database = await getDatabase();
  const existing = await database.get("meta", key);
  if (existing) {
    return existing as T;
  }

  const value = await fallback();
  await database.put("meta", value, key);
  return value;
}

async function putMany<T extends { id: string }>(storeName: StoreNames, values: T[]) {
  const database = await getDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  for (const value of values) {
    await transaction.store.put(value);
  }
  await transaction.done;
}

export class BrowserVaultRepository implements VaultRepository {
  async getProfile(): Promise<VaultProfileRecord | null> {
    const database = await getDatabase();
    return (await database.get("meta", PROFILE_KEY)) ?? null;
  }

  async saveProfile(profile: VaultProfileRecord): Promise<void> {
    const database = await getDatabase();
    await database.put("meta", profile, PROFILE_KEY);
  }

  async getAppSettings(): Promise<AppSettings> {
    return getMetaValue(SETTINGS_KEY, () => DEFAULT_APP_SETTINGS);
  }

  async saveAppSettings(settings: AppSettings): Promise<void> {
    const database = await getDatabase();
    await database.put("meta", settings, SETTINGS_KEY);
  }

  async getSyncState(): Promise<SyncState> {
    return getMetaValue(SYNC_KEY, async () => DEFAULT_SYNC_STATE(await randomId("device")));
  }

  async saveSyncState(syncState: SyncState): Promise<void> {
    const database = await getDatabase();
    await database.put("meta", syncState, SYNC_KEY);
  }

  async listEntries(): Promise<StoredVaultEntryRecord[]> {
    const database = await getDatabase();
    const entries = await database.getAll("entries");
    return entries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async getEntry(entryId: string): Promise<StoredVaultEntryRecord | null> {
    const database = await getDatabase();
    return (await database.get("entries", entryId)) ?? null;
  }

  async saveEntry(entry: StoredVaultEntryRecord): Promise<void> {
    const database = await getDatabase();
    await database.put("entries", entry);
  }

  async saveEntries(entries: StoredVaultEntryRecord[]): Promise<void> {
    await putMany("entries", entries);
  }

  async deleteEntry(entryId: string, deletedAt: string): Promise<void> {
    const existing = await this.getEntry(entryId);
    if (!existing) {
      return;
    }

    await this.saveEntry({
      ...existing,
      deletedAt,
      updatedAt: deletedAt,
    });
  }

  async listMutations(): Promise<VaultMutation[]> {
    const database = await getDatabase();
    const mutations = await database.getAll("mutations");
    return mutations
      .filter((mutation) => mutation.syncedAt === null)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async queueMutation(mutation: VaultMutation): Promise<void> {
    const database = await getDatabase();
    await database.put("mutations", mutation);
  }

  async markMutationsSynced(ids: string[], syncedAt: string): Promise<void> {
    const database = await getDatabase();
    const transaction = database.transaction("mutations", "readwrite");

    for (const id of ids) {
      const existing = await transaction.store.get(id);
      if (!existing) {
        continue;
      }

      await transaction.store.put({
        ...existing,
        syncedAt,
      });
    }

    await transaction.done;
  }

  async getSnapshot(): Promise<RepositorySnapshot> {
    const [profile, settings, sync, entries] = await Promise.all([
      this.getProfile(),
      this.getAppSettings(),
      this.getSyncState(),
      this.listEntries(),
    ]);

    return {
      profile,
      settings,
      sync,
      entries,
    };
  }
}
