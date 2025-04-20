const { app, BrowserWindow } = require('electron')
const path = require('path')
const createTray = require('./tray.js');

let mainWindow = null;

// Function to create the main application window
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 400,
    height: 680,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      //preload: path.join(__dirname, 'preload.js')
    }
  })

  // Load source
  mainWindow.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow();
  createTray(mainWindow);
  const tray = createTray(mainWindow);

  // On macOS, recreate window when dock icon is clicked
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// stay put
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin' && mainWindow) {
    mainWindow.hide();
  }
})