import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

import type {
  AuthState,
  RepositorySnapshot,
  StoredVaultEntryRecord,
  SyncFlushResult,
  VaultRepository,
} from "./types";

type RemoteEntryRow = {
  entry_id: string;
  envelope: StoredVaultEntryRecord["envelope"];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export class SupabaseSyncService {
  private client: SupabaseClient | null = null;

  constructor(private readonly repository: VaultRepository) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (url && anonKey) {
      this.client = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    }
  }

  isConfigured() {
    return this.client !== null;
  }

  async getAuthState(): Promise<AuthState> {
    if (!this.client) {
      return {
        isConfigured: false,
        isAuthenticated: false,
        email: null,
      };
    }

    const {
      data: { session },
    } = await this.client.auth.getSession();

    return {
      isConfigured: true,
      isAuthenticated: Boolean(session?.user),
      email: session?.user?.email ?? null,
    };
  }

  async signUp(email: string, password: string) {
    const client = this.requireClient();
    const { error } = await client.auth.signUp({ email, password });
    if (error) throw error;
  }

  async signIn(email: string, password: string) {
    const client = this.requireClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signOut() {
    const client = this.requireClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  async syncNow(): Promise<SyncFlushResult> {
    const client = this.requireClient();
    const session = await this.requireSession();
    const snapshot = await this.repository.getSnapshot();
    const pendingMutations = await this.repository.listMutations();

    if (snapshot.profile) {
      await this.pushProfile(client, session, snapshot);
    }

    let uploaded = 0;
    let deleted = 0;

    for (const mutation of pendingMutations) {
      if (mutation.kind === "upsert") {
        const record = JSON.parse(mutation.payload) as StoredVaultEntryRecord;
        await this.pushEntry(client, session, record, snapshot.sync.deviceId);
        uploaded += 1;
      }

      if (mutation.kind === "delete") {
        const payload = JSON.parse(mutation.payload) as { id: string; deletedAt: string };
        await this.pushDelete(client, session, payload.id, payload.deletedAt, snapshot.sync.deviceId);
        deleted += 1;
      }

      if ((mutation.kind === "profile" || mutation.kind === "settings") && snapshot.profile) {
        await this.pushProfile(client, session, snapshot);
      }
    }

    const [remoteEntries, remoteDeletes] = await Promise.all([
      this.pullEntries(client, session),
      this.pullDeletes(client, session),
    ]);

    const remoteRecords = this.reconcileRecords(snapshot.entries, remoteEntries, remoteDeletes);
    await this.repository.saveEntries(remoteRecords);

    const syncedAt = new Date().toISOString();
    await this.repository.markMutationsSynced(
      pendingMutations.map((mutation) => mutation.id),
      syncedAt
    );

    await this.repository.saveSyncState({
      ...snapshot.sync,
      enabled: true,
      lastSyncedAt: syncedAt,
      lastError: null,
    });

    return {
      uploaded,
      downloaded: remoteRecords.length,
      deleted,
      lastSyncedAt: syncedAt,
    };
  }

  private async pushProfile(
    client: SupabaseClient,
    session: Session,
    snapshot: RepositorySnapshot
  ) {
    if (!snapshot.profile) return;

    const { error } = await client.from("vault_profiles").upsert(
      {
        user_id: session.user.id,
        wrapped_vault_key: snapshot.profile.wrappedVaultKey,
        kdf: snapshot.profile.kdf,
        settings: snapshot.settings,
        device_id: snapshot.sync.deviceId,
        updated_at: snapshot.profile.updatedAt,
      },
      { onConflict: "user_id" }
    );

    if (error) throw error;
  }

  private async pushEntry(
    client: SupabaseClient,
    session: Session,
    record: StoredVaultEntryRecord,
    deviceId: string
  ) {
    const { error } = await client.from("vault_entries").upsert(
      {
        user_id: session.user.id,
        entry_id: record.id,
        envelope: record.envelope,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
        deleted_at: record.deletedAt,
        device_id: deviceId,
      },
      { onConflict: "user_id,entry_id" }
    );

    if (error) throw error;
  }

  private async pushDelete(
    client: SupabaseClient,
    session: Session,
    entryId: string,
    deletedAt: string,
    deviceId: string
  ) {
    const { error } = await client.from("vault_deletes").upsert(
      {
        user_id: session.user.id,
        entry_id: entryId,
        deleted_at: deletedAt,
        device_id: deviceId,
      },
      { onConflict: "user_id,entry_id" }
    );

    if (error) throw error;
  }

  private async pullEntries(client: SupabaseClient, session: Session) {
    const { data, error } = await client
      .from("vault_entries")
      .select("entry_id, envelope, created_at, updated_at, deleted_at")
      .eq("user_id", session.user.id);

    if (error) throw error;
    return (data ?? []) as RemoteEntryRow[];
  }

  private async pullDeletes(client: SupabaseClient, session: Session) {
    const { data, error } = await client
      .from("vault_deletes")
      .select("entry_id, deleted_at")
      .eq("user_id", session.user.id);

    if (error) throw error;
    return (data ?? []) as Array<{ entry_id: string; deleted_at: string }>;
  }

  private reconcileRecords(
    localEntries: StoredVaultEntryRecord[],
    entries: RemoteEntryRow[],
    deletes: Array<{ entry_id: string; deleted_at: string }>
  ): StoredVaultEntryRecord[] {
    const entryMap = new Map(
      localEntries.map((entry) => [entry.id, { ...entry } satisfies StoredVaultEntryRecord])
    );

    entries.forEach((entry) => {
      const normalized = {
        id: entry.entry_id,
        envelope: entry.envelope,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
        deletedAt: entry.deleted_at,
      } satisfies StoredVaultEntryRecord;
      const current = entryMap.get(entry.entry_id);

      if (!current || normalized.updatedAt > current.updatedAt) {
        entryMap.set(normalized.id, normalized);
      }
    });

    deletes.forEach((deleteRow) => {
      const current = entryMap.get(deleteRow.entry_id);
      if (!current) return;

      if (!current.deletedAt || deleteRow.deleted_at > current.deletedAt) {
        current.deletedAt = deleteRow.deleted_at;
        current.updatedAt = deleteRow.deleted_at;
      }
    });

    return [...entryMap.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private requireClient() {
    if (!this.client) {
      throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
    }

    return this.client;
  }

  private async requireSession() {
    const client = this.requireClient();
    const {
      data: { session },
    } = await client.auth.getSession();

    if (!session) {
      throw new Error("Sign in before syncing your vault.");
    }

    return session;
  }
}
