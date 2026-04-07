import { DEFAULT_APP_SETTINGS } from "./constants";
import { calculatePasswordStrength, generatePassword } from "./generator";
import {
  decryptJson,
  deriveMasterKey,
  encryptJson,
  generateVaultKey,
  randomId,
  unwrapVaultKey,
  wrapVaultKey,
} from "./security";
import type {
  AppSettings,
  GeneratorOptions,
  PasswordStrength,
  StoredVaultEntryRecord,
  VaultEntry,
  VaultEntryDraft,
  VaultMutation,
  VaultProfileRecord,
  VaultRepository,
  VaultSession,
} from "./types";

export class VaultService {
  private vaultKey: Uint8Array | null = null;

  constructor(private readonly repository: VaultRepository) {}

  async getSession(): Promise<VaultSession> {
    const [profile, settings, sync] = await Promise.all([
      this.repository.getProfile(),
      this.repository.getAppSettings(),
      this.repository.getSyncState(),
    ]);

    return {
      hasVault: Boolean(profile),
      isUnlocked: this.vaultKey !== null,
      profile,
      settings,
      sync,
    };
  }

  async getSettings(): Promise<AppSettings> {
    return this.repository.getAppSettings();
  }

  async saveSettings(partial: Partial<AppSettings>) {
    const current = await this.repository.getAppSettings();
    const next = {
      ...current,
      ...partial,
    };

    await this.repository.saveAppSettings(next);
    await this.repository.queueMutation(await this.createMutation("settings", "settings", JSON.stringify(next)));
    return next;
  }

  async setupMasterPassword(password: string, confirmPassword: string): Promise<VaultSession> {
    if (!password || password.length < 12) {
      throw new Error("Master password must be at least 12 characters.");
    }

    if (password !== confirmPassword) {
      throw new Error("Master password confirmation does not match.");
    }

    const existing = await this.repository.getProfile();
    if (existing) {
      throw new Error("A vault already exists in this app.");
    }

    const { key: masterKey, config } = await deriveMasterKey(password);
    const vaultKey = await generateVaultKey();
    const wrappedVaultKey = await wrapVaultKey(vaultKey, masterKey);
    const now = new Date().toISOString();

    const profile: VaultProfileRecord = {
      id: "local",
      wrappedVaultKey,
      kdf: config,
      createdAt: now,
      updatedAt: now,
    };

    this.vaultKey = vaultKey;
    await this.repository.saveProfile(profile);
    await this.repository.saveAppSettings(DEFAULT_APP_SETTINGS);
    await this.repository.queueMutation(await this.createMutation("profile", "local", JSON.stringify(profile)));

    return this.getSession();
  }

  async unlock(password: string): Promise<VaultSession> {
    const profile = await this.repository.getProfile();
    if (!profile) {
      throw new Error("No local vault exists yet.");
    }

    const { key } = await deriveMasterKey(password, profile.kdf);
    this.vaultKey = await unwrapVaultKey(profile.wrappedVaultKey, key);
    return this.getSession();
  }

  lock() {
    this.vaultKey = null;
  }

  isUnlocked() {
    return this.vaultKey !== null;
  }

  generatePassword(options: Partial<GeneratorOptions> = {}) {
    const password = generatePassword(options);
    return {
      password,
      strength: calculatePasswordStrength(password),
    };
  }

  evaluatePassword(password: string): PasswordStrength {
    return calculatePasswordStrength(password);
  }

  async listEntries(search = ""): Promise<VaultEntry[]> {
    const records = await this.repository.listEntries();
    const entries = await this.decryptEntries(records);
    const query = search.trim().toLowerCase();

    if (!query) {
      return entries;
    }

    return entries.filter((entry) =>
      [entry.title, entry.username, entry.url, entry.notes, entry.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }

  async saveEntry(draft: VaultEntryDraft): Promise<VaultEntry> {
    const vaultKey = this.assertUnlocked();
    const now = new Date().toISOString();
    const id = draft.id ?? (await randomId("entry"));
    const existing = draft.id ? await this.repository.getEntry(draft.id) : null;
    const existingEntry = existing ? await this.decryptEntry(existing) : null;

    const entry: VaultEntry = {
      id,
      title: draft.title.trim(),
      username: draft.username.trim(),
      password: draft.password,
      url: draft.url.trim(),
      notes: draft.notes.trim(),
      tags: draft.tags.filter(Boolean).map((tag) => tag.trim()).filter(Boolean),
      createdAt: existingEntry?.createdAt ?? now,
      updatedAt: now,
    };

    if (!entry.title) {
      throw new Error("Title is required.");
    }

    if (!entry.password) {
      throw new Error("Password is required.");
    }

    const encryptedRecord: StoredVaultEntryRecord = {
      id,
      envelope: await encryptJson(entry, vaultKey, `passlock:entry:${id}`),
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      deletedAt: null,
    };

    await this.repository.saveEntry(encryptedRecord);
    await this.repository.queueMutation(await this.createMutation("upsert", id, JSON.stringify(encryptedRecord)));

    return entry;
  }

  async deleteEntry(entryId: string): Promise<void> {
    const existing = await this.repository.getEntry(entryId);
    if (!existing) {
      return;
    }

    const deletedAt = new Date().toISOString();
    await this.repository.deleteEntry(entryId, deletedAt);
    await this.repository.queueMutation(
      await this.createMutation(
        "delete",
        entryId,
        JSON.stringify({
          id: entryId,
          deletedAt,
        })
      )
    );
  }

  async exportVault(): Promise<string> {
    const snapshot = await this.repository.getSnapshot();
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        format: "passlock.v1.encrypted",
        snapshot,
      },
      null,
      2
    );
  }

  async importVault(serialized: string): Promise<void> {
    const parsed = JSON.parse(serialized) as {
      snapshot?: {
        profile: VaultProfileRecord | null;
        settings: AppSettings;
        sync: VaultSession["sync"];
        entries: StoredVaultEntryRecord[];
      };
    };

    if (!parsed.snapshot) {
      throw new Error("The selected file is not a PassLock encrypted export.");
    }

    const existingProfile = await this.repository.getProfile();
    if (!existingProfile && parsed.snapshot.profile) {
      await this.repository.saveProfile(parsed.snapshot.profile);
    }

    await this.repository.saveAppSettings(parsed.snapshot.settings);
    await this.repository.saveSyncState(parsed.snapshot.sync);

    const mergedEntries = await this.mergeEntries(parsed.snapshot.entries);
    await this.repository.saveEntries(mergedEntries);
  }

  async mergeRemoteEntries(remoteEntries: StoredVaultEntryRecord[]) {
    const mergedEntries = await this.mergeEntries(remoteEntries);
    await this.repository.saveEntries(mergedEntries);
  }

  private async mergeEntries(remoteEntries: StoredVaultEntryRecord[]) {
    const localEntries = await this.repository.listEntries();
    const localMap = new Map(localEntries.map((entry) => [entry.id, entry]));

    for (const remoteEntry of remoteEntries) {
      const localEntry = localMap.get(remoteEntry.id);
      if (!localEntry || remoteEntry.updatedAt > localEntry.updatedAt) {
        localMap.set(remoteEntry.id, remoteEntry);
      }
    }

    return [...localMap.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private assertUnlocked() {
    if (!this.vaultKey) {
      throw new Error("Unlock your vault to access encrypted entries.");
    }

    return this.vaultKey;
  }

  private async decryptEntries(records: StoredVaultEntryRecord[]) {
    const entries = await Promise.all(
      records.filter((record) => !record.deletedAt).map((record) => this.decryptEntry(record))
    );
    return entries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private async decryptEntry(record: StoredVaultEntryRecord) {
    return decryptJson<VaultEntry>(record.envelope, this.assertUnlocked(), `passlock:entry:${record.id}`);
  }

  private async createMutation(
    kind: VaultMutation["kind"],
    recordId: string,
    payload: string
  ): Promise<VaultMutation> {
    const timestamp = new Date().toISOString();
    return {
      id: await randomId("mutation"),
      kind,
      recordId,
      payload,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncedAt: null,
    };
  }
}
