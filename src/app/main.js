// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const createTray = require('./tray.js');
const passwordStore = require('./passwordStore.js');

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
    width: 380,
    height: 600,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    useContentSize: true, 
    show: true,                      
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    roundedCorners:true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Close button ➜ hide to tray
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

app.whenReady().then(() => {
  passwordStore.initStore();
  createWindow();
  tray = createTray(mainWindow);
});

ipcMain.handle('password-add', (event, entry) => {
  return passwordStore.addPassword(entry);
});

ipcMain.handle('password-get-all', () => {
  return passwordStore.getPasswords();
});

ipcMain.handle('password-remove', (event, id) => {
  return passwordStore.removePassword(id);
});

app.on('before-quit', () => (isQuitting = true));
