import { app, clipboard, BrowserWindow, ipcMain } from "electron";
import path from "path";

import { ElectronSqliteVaultStore } from "./sqlite-store";
import { createTray } from "./tray";

let mainWindow: BrowserWindow | null = null;
let tray: Electron.Tray | null = null;
let isQuitting = false;
let clipboardClearTimer: NodeJS.Timeout | null = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

const store = new ElectronSqliteVaultStore(path.join(app.getPath("userData"), "vault.sqlite"));

function getRendererUrl() {
  return process.env.VITE_DEV_SERVER_URL;
}

async function createWindow() {
  const settings = await store.getAppSettings();

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 980,
    minHeight: 720,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    titleBarStyle: "hidden",
    show: !settings.launchHidden,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = getRendererUrl();
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }

  mainWindow.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    void handleCloseRequest();
  });
}

async function handleCloseRequest() {
  const settings = await store.getAppSettings();
  if (settings.closeToTray && mainWindow) {
    mainWindow.hide();
    return;
  }

  isQuitting = true;
  mainWindow?.close();
}

function registerIpcHandlers() {
  ipcMain.handle("vault:get-profile", () => store.getProfile());
  ipcMain.handle("vault:save-profile", (_event, profile) => store.saveProfile(profile));
  ipcMain.handle("vault:get-settings", () => store.getAppSettings());
  ipcMain.handle("vault:save-settings", (_event, settings) => store.saveAppSettings(settings));
  ipcMain.handle("vault:get-sync-state", () => store.getSyncState());
  ipcMain.handle("vault:save-sync-state", (_event, syncState) => store.saveSyncState(syncState));
  ipcMain.handle("vault:list-entries", () => store.listEntries());
  ipcMain.handle("vault:get-entry", (_event, entryId: string) => store.getEntry(entryId));
  ipcMain.handle("vault:save-entry", (_event, entry) => store.saveEntry(entry));
  ipcMain.handle("vault:save-entries", (_event, entries) => store.saveEntries(entries));
  ipcMain.handle("vault:delete-entry", (_event, entryId: string, deletedAt: string) =>
    store.deleteEntry(entryId, deletedAt)
  );
  ipcMain.handle("vault:list-mutations", () => store.listMutations());
  ipcMain.handle("vault:queue-mutation", (_event, mutation) => store.queueMutation(mutation));
  ipcMain.handle("vault:mark-mutations-synced", (_event, ids: string[], syncedAt: string) =>
    store.markMutationsSynced(ids, syncedAt)
  );
  ipcMain.handle("vault:get-snapshot", () => store.getSnapshot());

  ipcMain.handle("clipboard:copy-secret", async (_event, value: string, clearAfterMs: number) => {
    clipboard.writeText(value);

    if (clipboardClearTimer) {
      clearTimeout(clipboardClearTimer);
      clipboardClearTimer = null;
    }

    if (clearAfterMs > 0) {
      clipboardClearTimer = setTimeout(() => {
        if (clipboard.readText() === value) {
          clipboard.clear();
        }
      }, clearAfterMs);
    }
  });

  ipcMain.handle("app:get-platform", () => process.platform);
  ipcMain.handle("app:get-desktop-settings", async () => {
    const settings = await store.getAppSettings();
    return {
      closeToTray: settings.closeToTray,
      launchHidden: settings.launchHidden,
    };
  });
  ipcMain.handle(
    "app:save-desktop-settings",
    async (_event, desktopSettings: { closeToTray: boolean; launchHidden: boolean }) => {
      const current = await store.getAppSettings();
      await store.saveAppSettings({
        ...current,
        ...desktopSettings,
      });
    }
  );
}

app.on("second-instance", () => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  await store.initialize();
  registerIpcHandlers();
  await createWindow();

  if (!mainWindow) {
    return;
  }

  tray = createTray({
    mainWindow,
    onLockRequested: () => mainWindow?.webContents.send("app:lock-requested"),
    onSyncRequested: () => mainWindow?.webContents.send("sync:requested"),
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  if (clipboardClearTimer) {
    clearTimeout(clipboardClearTimer);
  }
  tray?.destroy();
});
