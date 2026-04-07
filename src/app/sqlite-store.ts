import fs from "fs/promises";
import path from "path";

import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from "sql.js";

import { DEFAULT_APP_SETTINGS, DEFAULT_SYNC_STATE } from "../shared/constants";
import { randomId } from "../shared/security";
import type {
  AppSettings,
  RepositorySnapshot,
  StoredVaultEntryRecord,
  SyncState,
  VaultMutation,
  VaultProfileRecord,
} from "../shared/types";

const PROFILE_KEY = "profile";
const SETTINGS_KEY = "settings";
const SYNC_KEY = "sync";

export class ElectronSqliteVaultStore {
  private sqlite: SqlJsStatic | null = null;
  private database: Database | null = null;

  constructor(private readonly databaseFilePath: string) {}

  async initialize() {
    if (this.database) {
      return;
    }

    this.sqlite = await initSqlJs({
      locateFile: () => require.resolve("sql.js/dist/sql-wasm.wasm"),
    });

    const fileExists = await fs
      .access(this.databaseFilePath)
      .then(() => true)
      .catch(() => false);

    if (fileExists) {
      const fileBuffer = await fs.readFile(this.databaseFilePath);
      this.database = new this.sqlite.Database(fileBuffer);
    } else {
      this.database = new this.sqlite.Database();
    }

    this.database.run(`
      create table if not exists meta (
        key text primary key,
        value text not null
      );

      create table if not exists entries (
        id text primary key,
        envelope text not null,
        created_at text not null,
        updated_at text not null,
        deleted_at text
      );

      create table if not exists mutations (
        id text primary key,
        kind text not null,
        record_id text not null,
        payload text not null,
        created_at text not null,
        updated_at text not null,
        synced_at text
      );
    `);

    await this.ensureDefaults();
    await this.persist();
  }

  async getProfile(): Promise<VaultProfileRecord | null> {
    return this.getMetaValue<VaultProfileRecord | null>(PROFILE_KEY, null);
  }

  async saveProfile(profile: VaultProfileRecord): Promise<void> {
    this.setMetaValue(PROFILE_KEY, profile);
    await this.persist();
  }

  async getAppSettings(): Promise<AppSettings> {
    return this.getMetaValue<AppSettings>(SETTINGS_KEY, DEFAULT_APP_SETTINGS);
  }

  async saveAppSettings(settings: AppSettings): Promise<void> {
    this.setMetaValue(SETTINGS_KEY, settings);
    await this.persist();
  }

  async getSyncState(): Promise<SyncState> {
    return this.getMetaValue<SyncState>(
      SYNC_KEY,
      DEFAULT_SYNC_STATE(await randomId("device"))
    );
  }

  async saveSyncState(syncState: SyncState): Promise<void> {
    this.setMetaValue(SYNC_KEY, syncState);
    await this.persist();
  }

  async listEntries(): Promise<StoredVaultEntryRecord[]> {
    const rows = this.queryAll(
      "select id, envelope, created_at, updated_at, deleted_at from entries order by updated_at desc"
    );

    return rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      envelope: JSON.parse(String(row.envelope)) as StoredVaultEntryRecord["envelope"],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      deletedAt: row.deleted_at ? String(row.deleted_at) : null,
    }));
  }

  async getEntry(entryId: string): Promise<StoredVaultEntryRecord | null> {
    const row = this.queryOne(
      "select id, envelope, created_at, updated_at, deleted_at from entries where id = ?",
      [entryId]
    );

    if (!row) {
      return null;
    }

    return {
      id: String(row.id),
      envelope: JSON.parse(String(row.envelope)) as StoredVaultEntryRecord["envelope"],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      deletedAt: row.deleted_at ? String(row.deleted_at) : null,
    };
  }

  async saveEntry(entry: StoredVaultEntryRecord): Promise<void> {
    this.getDatabase().run(
      `
        insert into entries (id, envelope, created_at, updated_at, deleted_at)
        values (?, ?, ?, ?, ?)
        on conflict(id) do update set
          envelope = excluded.envelope,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at
      `,
      [
        entry.id,
        JSON.stringify(entry.envelope),
        entry.createdAt,
        entry.updatedAt,
        entry.deletedAt,
      ]
    );

    await this.persist();
  }

  async saveEntries(entries: StoredVaultEntryRecord[]): Promise<void> {
    for (const entry of entries) {
      this.getDatabase().run(
        `
          insert into entries (id, envelope, created_at, updated_at, deleted_at)
          values (?, ?, ?, ?, ?)
          on conflict(id) do update set
            envelope = excluded.envelope,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at
        `,
        [
          entry.id,
          JSON.stringify(entry.envelope),
          entry.createdAt,
          entry.updatedAt,
          entry.deletedAt,
        ]
      );
    }

    await this.persist();
  }

  async deleteEntry(entryId: string, deletedAt: string): Promise<void> {
    const existing = await this.getEntry(entryId);
    if (!existing) {
      return;
    }

    await this.saveEntry({
      ...existing,
      updatedAt: deletedAt,
      deletedAt,
    });
  }

  async listMutations(): Promise<VaultMutation[]> {
    const rows = this.queryAll(
      `
        select id, kind, record_id, payload, created_at, updated_at, synced_at
        from mutations
        where synced_at is null
        order by created_at asc
      `
    );

    return rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      kind: String(row.kind) as VaultMutation["kind"],
      recordId: String(row.record_id),
      payload: String(row.payload),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      syncedAt: row.synced_at ? String(row.synced_at) : null,
    }));
  }

  async queueMutation(mutation: VaultMutation): Promise<void> {
    this.getDatabase().run(
      `
        insert into mutations (id, kind, record_id, payload, created_at, updated_at, synced_at)
        values (?, ?, ?, ?, ?, ?, ?)
        on conflict(id) do update set
          kind = excluded.kind,
          record_id = excluded.record_id,
          payload = excluded.payload,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          synced_at = excluded.synced_at
      `,
      [
        mutation.id,
        mutation.kind,
        mutation.recordId,
        mutation.payload,
        mutation.createdAt,
        mutation.updatedAt,
        mutation.syncedAt,
      ]
    );

    await this.persist();
  }

  async markMutationsSynced(ids: string[], syncedAt: string): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    for (const id of ids) {
      this.getDatabase().run("update mutations set synced_at = ? where id = ?", [syncedAt, id]);
    }

    await this.persist();
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

  private async ensureDefaults() {
    const profile = await this.getProfile();
    if (profile === null) {
      this.setMetaValue(PROFILE_KEY, null);
    }

    const settings = this.queryOne("select value from meta where key = ?", [SETTINGS_KEY]);
    if (!settings) {
      this.setMetaValue(SETTINGS_KEY, DEFAULT_APP_SETTINGS);
    }

    const sync = this.queryOne("select value from meta where key = ?", [SYNC_KEY]);
    if (!sync) {
      this.setMetaValue(SYNC_KEY, DEFAULT_SYNC_STATE(await randomId("device")));
    }
  }

  private getDatabase() {
    if (!this.database) {
      throw new Error("SQLite store has not been initialized.");
    }

    return this.database;
  }

  private queryOne(query: string, parameters: SqlValue[] = []): Record<string, unknown> | null {
    const results = this.getDatabase().exec(query, parameters);
    const [firstResult] = results;
    if (!firstResult || firstResult.values.length === 0) {
      return null;
    }

    return this.rowFromResult(firstResult.columns, firstResult.values[0]);
  }

  private queryAll(query: string, parameters: SqlValue[] = []): Array<Record<string, unknown>> {
    const results = this.getDatabase().exec(query, parameters);
    const [firstResult] = results;
    if (!firstResult) {
      return [];
    }

    return firstResult.values.map((row: unknown[]) => this.rowFromResult(firstResult.columns, row));
  }

  private rowFromResult(columns: string[], values: unknown[]): Record<string, unknown> {
    return columns.reduce<Record<string, unknown>>((row, column, index) => {
      row[column] = values[index];
      return row;
    }, {});
  }

  private getMetaValue<T>(key: string, fallback: T): T {
    const row = this.queryOne("select value from meta where key = ?", [key]);
    if (!row) {
      return fallback;
    }

    return JSON.parse(String(row.value)) as T;
  }

  private setMetaValue(key: string, value: unknown) {
    this.getDatabase().run(
      `
        insert into meta (key, value)
        values (?, ?)
        on conflict(key) do update set value = excluded.value
      `,
      [key, JSON.stringify(value)]
    );
  }

  private async persist() {
    await fs.mkdir(path.dirname(this.databaseFilePath), { recursive: true });
    const data = this.getDatabase().export();
    await fs.writeFile(this.databaseFilePath, Buffer.from(data));
  }
}
