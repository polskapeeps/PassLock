import type { AppSettings, GeneratorOptions, SyncState } from "./types";

export const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  avoidAmbiguous: true,
  excludeCharacters: "",
  requireEverySelectedType: true,
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  clipboardClearMs: 15000,
  closeToTray: true,
  launchHidden: false,
  themeMode: "modern",
};

export const DEFAULT_SYNC_STATE = (deviceId: string): SyncState => ({
  deviceId,
  provider: "supabase",
  enabled: false,
  lastSyncedAt: null,
  lastError: null,
});

export const DEFAULT_ARGON2_OPS_LIMIT = 4;
export const DEFAULT_ARGON2_MEM_LIMIT_BYTES = 134217728;
