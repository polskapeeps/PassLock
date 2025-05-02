// main.js - Electron Main Process Setup

// Import necessary Electron modules
const { app, BrowserWindow, ipcMain, clipboard, Menu, Tray } = require('electron');
const path = require('path');
// No longer need separate tray.js if simple, can integrate here or keep separate
// const createTray = require('./tray.js'); // Assuming tray.js exists and is correct

// Keep track of the main window, tray, and quitting state
let mainWindow;
let tray = null; // Initialize tray as null
let isQuitting = false;

// --- Single Instance Lock ---
// Ensure only one instance of the application runs
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is running, quit this one
  app.quit();
} else {
  // Focus the existing window if a second instance is attempted
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show(); // Show the window if hidden (e.g., in tray)
      mainWindow.focus();
    }
  });
}

// --- Create Main Window Function ---
function createWindow () {
  // Define window options
  mainWindow = new BrowserWindow({
    width: 400, // Adjusted width for potential history UI
    height: 680, // Adjusted height
    minWidth: 380, // Prevent making it too narrow
    minHeight: 550, // Prevent making it too short
    resizable: true, // Allow resizing for better usability
    maximizable: false, // Keep false if desired
    fullscreenable: false, // Keep false
    useContentSize: true, // Width/height applies to content area
    show: false, // Don't show immediately, wait for 'ready-to-show'
    frame: false, // Frameless window
    transparent: true, // Enable transparency
    backgroundColor: '#00000000', // Transparent background
    roundedCorners: true, // Use OS rounded corners if available
    icon: path.join(__dirname, 'assets', 'Icons', 'favicon-32x32.png'), // Set window icon
    webPreferences: {
      nodeIntegration: false, // Essential for security: Disable Node.js integration in renderer
      contextIsolation: true, // Essential for security: Isolate renderer context from preload
      preload: path.join(__dirname, 'preload.js'), // Specify the preload script
      sandbox: false // Consider enabling sandbox for further security hardening if possible
                     // Note: Sandbox might restrict some Node.js modules in preload
    },
  });

  // Load the HTML file
  mainWindow.loadFile('index.html');

  // Gracefully show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Open DevTools automatically (optional, for debugging)
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  // Handle window close event (hide to tray instead of quitting)
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault(); // Prevent the window from closing
      mainWindow.hide(); // Hide the window instead
      // Optional: Show a notification that the app is still running in the tray
    }
    // If isQuitting is true, the default close behavior (quit) will proceed
  });

  // Dereference the window object when closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- Create System Tray Icon Function ---
function createTrayIcon() {
    // Determine icon path based on platform
    const iconName = process.platform === 'win32' ? 'icon.ico' : 'iconTemplate.png'; // Use Template icon for macOS dark mode
    const iconPath = path.join(__dirname, 'assets', 'Icons', iconName); // Adjust path as needed

    try {
        tray = new Tray(iconPath);
    } catch (error) {
        console.error("Failed to create tray icon:", error);
        console.error("Icon path attempted:", iconPath);
        // Handle error appropriately, maybe skip tray creation
        return;
    }


    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show PassLock',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                } else {
                    // If window was somehow destroyed, recreate it
                    createWindow();
                }
            },
        },
        { type: 'separator' },
        {
            label: 'Quit PassLock',
            click: () => {
                isQuitting = true; // Signal that we are actually quitting
                app.quit();
            },
        },
    ]);

    tray.setToolTip('PassLock Password Generator');
    tray.setContextMenu(contextMenu);

    // Toggle window visibility on single click (optional, common on Windows)
    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible() && mainWindow.isFocused()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        } else {
            createWindow(); // Recreate if closed
        }
    });
}


// --- IPC Handlers (Communication from Renderer) ---

// Example: Handle copy request from renderer via preload script
// Note: navigator.clipboard is often usable directly in modern renderers,
//       so this might only be needed for more complex OS interactions.
ipcMain.on('copy-text-to-clipboard', (event, text) => {
  if (typeof text === 'string' && text) {
    clipboard.writeText(text);
    console.log("Main: Copied text received from renderer:", text);
    // Optionally send confirmation back:
    // event.sender.send('copy-response', { success: true });
  } else {
    console.error("Main: Invalid text received for copying.");
    // Optionally send error back:
    // event.sender.send('copy-response', { success: false, error: 'Invalid text' });
  }
});

// Add other ipcMain handlers here if needed (e.g., for saving files)
// ipcMain.handle('save-file', async (event, content) => {
//   const { dialog } = require('electron');
//   const { writeFile } = require('fs').promises;
//   try {
//     const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
//       title: 'Save Password',
//       defaultPath: 'password.txt',
//     });
//     if (!canceled && filePath) {
//       await writeFile(filePath, content);
//       return { success: true, path: filePath };
//     }
//     return { success: false, canceled: true };
//   } catch (error) {
//     console.error('File save error:', error);
//     return { success: false, error: error.message };
//   }
// });


// --- Application Lifecycle Events ---

// Create window and tray when Electron is ready
app.whenReady().then(() => {
  createWindow();
  createTrayIcon(); // Create the tray icon

  // Handle macOS dock icon click
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
        mainWindow.show(); // Show existing window if dock is clicked
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  // On macOS, the app usually stays active in the dock/tray
});

// Set isQuitting flag before quitting to allow window closure
app.on('before-quit', () => {
  isQuitting = true;
});

// --- End of main.js ---
