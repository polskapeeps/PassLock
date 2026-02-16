const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const createTray = require('./tray.js');

let mainWindow;
let tray;
let isQuitting = false;
const vaultFilePath = path.join(app.getPath('userData'), 'password-vault.json');

/* ---------- single-instance guard ---------- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
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

function createWindow() {
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
    roundedCorners: true,
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

function encodeSecret(value) {
  if (safeStorage.isEncryptionAvailable()) {
    return {
      encrypted: true,
      value: safeStorage.encryptString(value).toString('base64'),
    };
  }

  return {
    encrypted: false,
    value: Buffer.from(value, 'utf8').toString('base64'),
  };
}

function decodeSecret(storedSecret) {
  if (!storedSecret?.value) {
    return '';
  }

  if (storedSecret.encrypted && safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(Buffer.from(storedSecret.value, 'base64'));
  }

  return Buffer.from(storedSecret.value, 'base64').toString('utf8');
}

async function readVault() {
  try {
    const raw = await fs.readFile(vaultFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.entries)) {
      return { entries: [] };
    }

    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { entries: [] };
    }

    throw error;
  }
}

async function writeVault(vaultData) {
  await fs.mkdir(path.dirname(vaultFilePath), { recursive: true });
  await fs.writeFile(vaultFilePath, JSON.stringify(vaultData, null, 2), 'utf8');
}

function sanitizeEntry(entry) {
  return {
    id: entry.id,
    label: entry.label,
    username: entry.username,
    password: decodeSecret(entry.password),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

function registerVaultHandlers() {
  ipcMain.handle('vault:list', async () => {
    const vault = await readVault();
    return {
      usesSystemEncryption: safeStorage.isEncryptionAvailable(),
      entries: vault.entries.map(sanitizeEntry),
    };
  });

  ipcMain.handle('vault:save', async (_event, payload) => {
    const label = String(payload?.label || '').trim();
    const username = String(payload?.username || '').trim();
    const password = String(payload?.password || '');

    if (!label || !password) {
      throw new Error('Label and password are required.');
    }

    const now = new Date().toISOString();
    const vault = await readVault();

    const existingIndex = vault.entries.findIndex(
      (entry) => entry.label.toLowerCase() === label.toLowerCase()
    );

    const id = existingIndex >= 0 ? vault.entries[existingIndex].id : crypto.randomUUID();
    const newEntry = {
      id,
      label,
      username,
      password: encodeSecret(password),
      createdAt: existingIndex >= 0 ? vault.entries[existingIndex].createdAt : now,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      vault.entries[existingIndex] = newEntry;
    } else {
      vault.entries.unshift(newEntry);
    }

    await writeVault(vault);

    return {
      usesSystemEncryption: safeStorage.isEncryptionAvailable(),
      entries: vault.entries.map(sanitizeEntry),
    };
  });

  ipcMain.handle('vault:delete', async (_event, id) => {
    const vault = await readVault();
    vault.entries = vault.entries.filter((entry) => entry.id !== id);
    await writeVault(vault);

    return {
      usesSystemEncryption: safeStorage.isEncryptionAvailable(),
      entries: vault.entries.map(sanitizeEntry),
    };
  });
}

app.whenReady().then(() => {
  registerVaultHandlers();
  createWindow();
  tray = createTray(mainWindow);
});

app.on('before-quit', () => {
  isQuitting = true;
});
