export type PasswordCharacterPolicy = {
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
};

export type GeneratorOptions = PasswordCharacterPolicy & {
  length: number;
  avoidAmbiguous: boolean;
  excludeCharacters: string;
  requireEverySelectedType: boolean;
};

export type PasswordStrength = {
  score: number;
  label: "Very Weak" | "Weak" | "Fair" | "Strong" | "Very Strong";
  entropyBits: number;
  feedback: string;
};

export type AppSettings = {
  clipboardClearMs: number;
  closeToTray: boolean;
  launchHidden: boolean;
  themeMode: "modern";
};

export type VaultCipherEnvelope = {
  version: 1;
  algorithm: "xchacha20poly1305-ietf";
  nonce: string;
  cipherText: string;
  context: string;
};

export type VaultKdfConfig = {
  algorithm: "argon2id13";
  salt: string;
  opsLimit: number;
  memLimitBytes: number;
};

export type VaultProfileRecord = {
  id: "local";
  wrappedVaultKey: VaultCipherEnvelope;
  kdf: VaultKdfConfig;
  createdAt: string;
  updatedAt: string;
};

export type VaultEntry = {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type VaultEntryDraft = {
  id?: string;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  tags: string[];
};

export type StoredVaultEntryRecord = {
  id: string;
  envelope: VaultCipherEnvelope;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type VaultMutation = {
  id: string;
  kind: "profile" | "upsert" | "delete" | "settings";
  recordId: string;
  payload: string;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
};

export type SyncState = {
  deviceId: string;
  provider: "supabase";
  enabled: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export type VaultSession = {
  hasVault: boolean;
  isUnlocked: boolean;
  profile: VaultProfileRecord | null;
  settings: AppSettings;
  sync: SyncState;
};

export type RepositorySnapshot = {
  profile: VaultProfileRecord | null;
  settings: AppSettings;
  sync: SyncState;
  entries: StoredVaultEntryRecord[];
};

export type AuthState = {
  isConfigured: boolean;
  isAuthenticated: boolean;
  email: string | null;
};

export type SyncFlushResult = {
  uploaded: number;
  downloaded: number;
  deleted: number;
  lastSyncedAt: string | null;
};

export interface VaultRepository {
  getProfile(): Promise<VaultProfileRecord | null>;
  saveProfile(profile: VaultProfileRecord): Promise<void>;
  getAppSettings(): Promise<AppSettings>;
  saveAppSettings(settings: AppSettings): Promise<void>;
  getSyncState(): Promise<SyncState>;
  saveSyncState(syncState: SyncState): Promise<void>;
  listEntries(): Promise<StoredVaultEntryRecord[]>;
  getEntry(entryId: string): Promise<StoredVaultEntryRecord | null>;
  saveEntry(entry: StoredVaultEntryRecord): Promise<void>;
  saveEntries(entries: StoredVaultEntryRecord[]): Promise<void>;
  deleteEntry(entryId: string, deletedAt: string): Promise<void>;
  listMutations(): Promise<VaultMutation[]>;
  queueMutation(mutation: VaultMutation): Promise<void>;
  markMutationsSynced(ids: string[], syncedAt: string): Promise<void>;
  getSnapshot(): Promise<RepositorySnapshot>;
}

export interface ElectronVaultBridge {
  vault: {
    getProfile(): Promise<VaultProfileRecord | null>;
    saveProfile(profile: VaultProfileRecord): Promise<void>;
    getAppSettings(): Promise<AppSettings>;
    saveAppSettings(settings: AppSettings): Promise<void>;
    getSyncState(): Promise<SyncState>;
    saveSyncState(syncState: SyncState): Promise<void>;
    listEntries(): Promise<StoredVaultEntryRecord[]>;
    getEntry(entryId: string): Promise<StoredVaultEntryRecord | null>;
    saveEntry(entry: StoredVaultEntryRecord): Promise<void>;
    saveEntries(entries: StoredVaultEntryRecord[]): Promise<void>;
    deleteEntry(entryId: string, deletedAt: string): Promise<void>;
    listMutations(): Promise<VaultMutation[]>;
    queueMutation(mutation: VaultMutation): Promise<void>;
    markMutationsSynced(ids: string[], syncedAt: string): Promise<void>;
    getSnapshot(): Promise<RepositorySnapshot>;
  };
  clipboard: {
    copySecret(value: string, clearAfterMs: number): Promise<void>;
  };
  app: {
    isElectron(): boolean;
    platform(): Promise<string>;
    getDesktopSettings(): Promise<Pick<AppSettings, "closeToTray" | "launchHidden">>;
    saveDesktopSettings(
      settings: Pick<AppSettings, "closeToTray" | "launchHidden">
    ): Promise<void>;
    onLockRequested(callback: () => void): () => void;
  };
  sync: {
    onSyncRequested(callback: () => void): () => void;
  };
}
