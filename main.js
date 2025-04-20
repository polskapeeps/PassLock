// main.js
const { app, BrowserWindow } = require('electron');
const path  = require('path');
const createTray = require('./tray.js');

let mainWindow;
let tray;
let isQuitting = false;

/* ---------- single‑instance guard ---------- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();                        // another copy is already running
  return;
}
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});
/* ------------------------------------------- */

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 680,
    show: true,                      // open right away
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile('index.html');

  // Close button ➜ hide to tray
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  tray = createTray(mainWindow);
});

app.on('before-quit', () => (isQuitting = true));
