const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // If you're loading local HTML/JS, you can enable nodeIntegration
      // or other features here. But be mindful of potential security issues.
      nodeIntegration: true
    }
  });

  // Load your HTML file
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Uncomment to open the DevTools automatically
  // mainWindow.webContents.openDevTools();
}

// Called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
