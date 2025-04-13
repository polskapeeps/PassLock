const { app, BrowserWindow } = require('electron')
const path = require('path')

// Function to create the main application window
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 400,
    height: 650,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      //preload: path.join(__dirname, 'preload.js')
    }
  })

  // Load your existing index.html file
  mainWindow.loadFile('index.html')
}

// Create window when Electron is ready
app.whenReady().then(() => {
  createWindow()
  
  // On macOS, recreate window when dock icon is clicked
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit the app when all windows are closed (except on macOS)
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})