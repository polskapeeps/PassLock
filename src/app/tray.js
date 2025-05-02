// tray.js
const { Tray, Menu, app } = require("electron");
const path = require("path");

function createTray(mainWindow) {
  // Use whatever icon(s) you packaged
  const icon = path.join(
    app.getAppPath(),
    "assets",
    "icons",
    process.platform === "win32" ? "favicon.ico" : "icon.png"
  );

  const tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open PassLock",
      click: () => mainWindow.show(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => app.quit(), // sets isQuitting in main.js
    },
  ]);

  tray.setToolTip("PassLock");
  tray.setContextMenu(contextMenu);

  // Left‑click = toggle show/hide
  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow.show();
    }
  });

  return tray;
}

module.exports = createTray;
