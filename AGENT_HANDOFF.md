# PassLock Agent Handoff

This file is the quick-start context for any new agent or future session working on PassLock.

## What This App Is

PassLock is a local-first password manager with:

- secure password generation
- encrypted local vault storage
- Electron desktop support with tray behavior
- optional Supabase sync for encrypted records
- a web/PWA path that shares the same core vault logic

The current branch is the modern base, not the retro one.

## Historical Style Note

- `main` is the modern PassLock direction.
- `origin/Electron-DesktopApp` is the clearest source of the older retro frameless look the user remembers.
- The retro branch is reference material, not the current implementation target unless the user explicitly wants to revive that visual direction.

## Core Architecture

- `src/shared/`
  Shared logic for generator, crypto, vault orchestration, sync orchestration, types, and storage contracts.
- `src/renderer/`
  The browser/Electron renderer app UI.
- `src/app/`
  Electron main/preload/desktop storage code.

Important files:

- `src/shared/types.ts`
  Main shared app types such as `GeneratorOptions`, `VaultEntry`, `VaultMutation`, `VaultSession`, `SyncState`, and `AppSettings`.
- `src/shared/generator.ts`
  Password generation and strength logic.
- `src/shared/security.ts`
  Encryption and key-derivation helpers.
- `src/shared/vault-service.ts`
  Master-password setup/unlock, vault CRUD, import/export, generator integration.
- `src/shared/sync-service.ts`
  Supabase auth and local-first sync behavior.
- `src/shared/browser-store.ts`
  IndexedDB-backed browser/PWA repository.
- `src/shared/electron-store.ts`
  Renderer-facing Electron repository bridge.
- `src/app/sqlite-store.ts`
  Desktop storage implementation.
- `src/app/main.ts`
  Electron window creation and desktop lifecycle behavior.
- `src/app/preload.ts`
  Safe bridge exposed to the renderer via `window.passlock`.
- `src/app/tray.ts`
  Tray interactions and desktop actions.
- `src/renderer/passlock-app.ts`
  Main UI rendering and interaction logic.
- `src/renderer/styles.css`
  Current visual/layout system.
- `supabase/schema.sql`
  Required Supabase schema.

## Current Product Behavior

The app currently supports:

- first-run master password setup
- vault unlock/lock
- secure password generation with configurable options
- local encrypted entry save/edit/delete
- per-entry copy actions
- encrypted import/export
- Supabase sign in / sign up / sync
- Electron tray-related behavior and desktop settings
- browser/PWA use through the shared renderer

Local-first behavior:

- vault saves happen locally first
- sync uploads encrypted blobs, not plaintext vault fields
- Supabase dashboard rows will not show readable passwords or entry contents

## Current UI State

The user wants internals stable first, with GUI iteration second.

Recent UI direction already implemented:

- removed the oversized selected-entry detail block below the vault list
- clicking a vault item now loads it directly into the editor
- copy actions live where they are immediately useful
- the old large hero header was replaced in the unlocked state with a compact top toolbar
- sync/auth and desktop settings were moved up top to reduce wasted space
- main working area is now focused on generator, vault list, and entry editor

The user likes the tighter layout, but expects more GUI refinement later.

## Important User Preferences

- prioritize internals, reliability, and usability before polishing visuals
- keep the vault flow efficient and low-friction
- avoid wasted space
- make common actions one click away
- modern layout is okay for now, but the user is not attached to the current frameless desktop look
- they may want to bounce GUI ideas with another agent before more design changes

## Known Design/UX Notes

- The user does not currently love the frameless modern desktop window. That can be revisited later.
- The top area should stay compact and functional rather than marketing-heavy.
- The user prefers Proton Pass style efficiency: list beside editor, fewer extra blocks, less vertical waste.

## Supabase Setup

Required environment variables:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
```

Important:

- use the project URL, not the dashboard URL
- use the publishable/anon key, not the secret key
- run `supabase/schema.sql` in the project SQL editor
- enable email auth in Supabase

## Run Commands

Install:

```powershell
npm install
```

Useful scripts:

```powershell
npm run dev
npm run dev:renderer
npm run build
npm run start
npm test
```

Meaning:

- `npm run dev` runs full Electron development mode
- `npm run dev:renderer` runs browser-only Vite
- `npm run build` builds renderer + Electron TS output
- `npm run start` builds and launches Electron
- `npm test` runs the Vitest suite

## Important Environment / Build Notes

- Build currently succeeds.
- Tests currently succeed.
- Vite build prints a noisy yellow `libsodium-sumo` warning with a huge minified snippet. This is expected and not a build failure.
- Some machines may have `ELECTRON_RUN_AS_NODE=1` set globally. This repo already works around that in `scripts/launch-electron.cjs`.

## Desktop Notes

- Electron launches through `scripts/launch-electron.cjs` rather than assuming a clean system Electron environment.
- Transparent frameless rendering was previously causing blank/invisible windows on Windows and was already adjusted.

## Recent Functional Fixes

- fixed URL/app field to accept shorthand like `google.com`, `router.local`, or app names
- selecting a vault item now loads it for in-place editing
- added clearer per-field copy actions
- compacted duplicate local mutations before sync so upload counts are more accurate
- moved sync/settings into a tighter top control area

## Constraints For Future GUI Work

If another agent works on the GUI, try to preserve these behaviors unless the user asks otherwise:

- click an entry to focus and edit it immediately
- keep per-field copy actions available
- keep sync and desktop controls easy to reach
- avoid large decorative sections that reduce working area
- do not regress local-first behavior or encrypted storage flows

## Suggested Starting Points For A New GUI Session

1. Review `src/renderer/passlock-app.ts` and `src/renderer/styles.css` first.
2. Preserve the current working information architecture unless the user explicitly wants a bigger re-layout.
3. Treat `origin/Electron-DesktopApp` as style inspiration only if the user asks for retro revival.
4. Keep testing with `npm run build` after layout changes.

## Note For Future Me

When the user comes back, assume they may want:

- proportion tuning of the top toolbar
- rethinking the frameless desktop window on modern theme
- a dedicated visual design pass after they finish thinking through layout ideas

Do not jump into a full redesign immediately. Start by asking what they want to change about spacing, hierarchy, and density first, because they are still actively forming the GUI direction.
