import { app, Menu, Tray } from "electron";
import path from "path";

export function createTray({
  mainWindow,
  onLockRequested,
  onSyncRequested,
}: {
  mainWindow: Electron.BrowserWindow;
  onLockRequested: () => void;
  onSyncRequested: () => void;
}) {
  const iconPath = path.join(app.getAppPath(), "passlock-icon.png");
  const fallbackIconPath = path.join(app.getAppPath(), "build", "icon.ico");
  const tray = new Tray(process.platform === "win32" ? fallbackIconPath : iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open PassLock",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: "Lock Vault",
      click: onLockRequested,
    },
    {
      label: "Sync Now",
      click: onSyncRequested,
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => app.quit(),
    },
  ]);

  tray.setToolTip("PassLock");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return tray;
}
