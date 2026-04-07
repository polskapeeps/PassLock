# PassLock Completion Plan

## Summary
- Use current `main` as the product base because it already has the modern frameless shell.
- Preserve `origin/Electron-DesktopApp` as the source of the retro frameless look, but keep it as an optional future theme rather than the default base.
- Rebuild the app around a shared TypeScript + Vite codebase with a local-first encrypted vault, Electron desktop shell, and Supabase-backed sync for desktop + PWA.

## Key Changes
- Restructure into shared modules for `src/shared`, `src/renderer`, and `src/app`, so generator logic, crypto, vault models, sync orchestration, and settings are reused by Electron and the PWA.
- Add shared types `GeneratorOptions`, `VaultEntry`, `VaultCipherEnvelope`, `VaultMutation`, `VaultSession`, `SyncState`, and `AppSettings`.
- Add Electron preload APIs for `window.passlock.vault.*`, `window.passlock.sync.*`, `window.passlock.clipboard.copySecret`, and `window.passlock.app.*`; keep all filesystem, DB, and secret-handling work out of the renderer.
- Replace the current generator internals with a tested crypto utility using Web Crypto/libsodium, rejection sampling instead of modulo selection, secure defaults of 20 characters, a 12-128 range, uppercase/lowercase/numbers/symbols toggles, ambiguous-character avoidance, custom excludes, and “require every selected set.”
- Implement the vault locally first. Derive a key-encryption key from the master password with Argon2id, generate a random vault key, store only the wrapped vault key plus KDF parameters locally, and encrypt every vault field client-side with XChaCha20-Poly1305.
- Use SQLite for Electron local storage and IndexedDB for the PWA, both storing the same encrypted envelope format.
- Build full vault flows: first-run master-password setup, unlock/lock, list/search, add/edit/delete entries, copy with optional clipboard auto-clear, and encrypted import/export. Do not store plaintext vault data or master-password hashes in `localStorage`.
- Add desktop behavior for close-to-tray, reopen from tray, tray actions for open/lock/sync/quit, optional launch-hidden mode, and background sync that can move ciphertext while the vault is locked.
- Fix packaging assets so Windows/macOS/Linux tray and build targets use real checked-in icons and background assets.
- Add Supabase Auth with email/password as the initial cloud login flow. Create `vault_profiles` for wrapped vault-key metadata, `vault_entries` for encrypted records, and `vault_deletes` tombstones for deletes.
- Use local-first sync with queued mutations, per-device IDs, `updatedAt` timestamps, and last-write-wins conflict resolution.
- Turn the shared renderer into a real PWA with a manifest, service worker shell caching, install support, and mobile-responsive vault screens. Cache only the app shell and static assets; keep vault data encrypted in IndexedDB.

## Test Plan
- Add unit tests for generator policy, rejection sampling, Argon2id key derivation, encryption/decryption round trips, master-password verification, and sync merge/tombstone behavior.
- Add Electron integration tests for first-run setup, vault CRUD, tray close/reopen, lock/unlock, clipboard clear, and offline-to-online sync recovery.
- Add web/PWA tests for manifest/service-worker registration, IndexedDB persistence, lock-on-refresh behavior, and cross-device sync between desktop and browser.
- Validate acceptance scenarios: generate offline, save to vault, lock, reopen from tray, unlock, sign in on desktop and PWA, view the same entry on both, edit on one device and receive the update on the other, then delete and confirm the tombstone syncs everywhere.

## Assumptions
- Supabase is the cloud backend; the Firebase branch remains reference-only.
- A master password is required each session; OS secure storage may keep auth/session tokens but does not replace vault encryption.
- `main` stays the default visual direction; the retro frameless branch is preserved as an optional theme later.
- Implementation starts from current `main`, borrowing preload/tray structure from `codex/review-and-update-app-design-and-features` and styling reference from `origin/Electron-DesktopApp`.
