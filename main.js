// main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const createTray = require('./tray.js');

let mainWindow;          // <-- keep a single global reference
let tray;                //   (needed in more than one place)
let isQuitting = false;  //   (used when user chooses “Quit”)

function createWindow () {
  // DO NOT use “const” here – assign to the global
  mainWindow = new BrowserWindow({
    width: 400,
    height: 680,
    show: false,                 // start hidden – we’ll show from the tray
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('index.html');

  // ⬇︎ Close button ➜ hide instead of quit
  mainWindow.on('close', (e) => {
    if (!isQuitting) {           // block normal close unless we’re really quitting
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  tray = createTray(mainWindow); // only **one** call ‑ pass the live window
});

app.on('before-quit', () => (isQuitting = true));
