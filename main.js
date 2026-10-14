const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { uIOhook, UiohookKey } = require('uiohook-napi');

let mainWindow = null;
let nativeSender = null;
let codeToType = "";
let currentIndex = 0;
let isHackerModeActive = false;
let autoPlayTimer = null;
let charsPerKeypress = 3;
let autoSpeedMs = 50;

function createSenderProcess() {
  const exePath = path.join(__dirname, 'NativeSender.exe');
  if (fs.existsSync(exePath)) {
    nativeSender = spawn(exePath, [], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    nativeSender.stdout.on('data', (data) => {
      // response from sender
    });

    nativeSender.on('close', () => {
      nativeSender = null;
    });
  }
}

function sendTextToActiveWindow(text) {
  if (!text || !nativeSender) return;
  const base64 = Buffer.from(text, 'utf8').toString('base64');
  try {
    nativeSender.stdin.write(`TYPE:${base64}\n`);
  } catch (err) {
    console.error('Send error:', err);
  }
}

function typeNextChunk() {
  if (!codeToType || currentIndex >= codeToType.length) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('status-update', {
        status: 'finished',
        currentIndex,
        totalLength: codeToType.length
      });
    }
    return;
  }

  const chunk = codeToType.substr(currentIndex, charsPerKeypress);
  currentIndex += chunk.length;
  sendTextToActiveWindow(chunk);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('progress-update', {
      currentIndex,
      totalLength: codeToType.length,
      percentage: Math.min(100, Math.round((currentIndex / codeToType.length) * 100))
    });
  }
}

function startAutoPlay() {
  stopAutoPlay();
  autoPlayTimer = setInterval(() => {
    if (currentIndex >= codeToType.length) {
      stopAutoPlay();
      return;
    }
    typeNextChunk();
  }, autoSpeedMs);
}

function stopAutoPlay() {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer);
    autoPlayTimer = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 860,
    height: 720,
    title: 'Hacker Typer for VS Code / Visual Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true,
    alwaysOnTop: false
  });

  mainWindow.loadFile('index.html');
}

// Global hook setup
uIOhook.on('keydown', (e) => {
  // F8: Toggle Hacker Mode On/Off
  if (e.keycode === UiohookKey.F8) {
    isHackerModeActive = !isHackerModeActive;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mode-toggled', isHackerModeActive);
    }
    return;
  }

  // F9: Toggle Auto-Play On/Off
  if (e.keycode === UiohookKey.F9) {
    if (autoPlayTimer) {
      stopAutoPlay();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('autoplay-toggled', false);
      }
    } else {
      startAutoPlay();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('autoplay-toggled', true);
      }
    }
    return;
  }

  // F10: Reset progress
  if (e.keycode === UiohookKey.F10) {
    currentIndex = 0;
    stopAutoPlay();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('progress-update', {
        currentIndex: 0,
        totalLength: codeToType.length,
        percentage: 0
      });
      mainWindow.webContents.send('autoplay-toggled', false);
    }
    return;
  }

  // If Hacker Typer mode is active, simulate typing next code chunk on any keyboard stroke
  // Ignore special hotkeys to avoid trigger loops
  if (isHackerModeActive && !autoPlayTimer) {
    if (
      e.keycode !== UiohookKey.F8 &&
      e.keycode !== UiohookKey.F9 &&
      e.keycode !== UiohookKey.F10 &&
      e.keycode !== UiohookKey.Escape
    ) {
      typeNextChunk();
    }
  }
});

app.whenReady().then(() => {
  createSenderProcess();
  createWindow();
  uIOhook.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  uIOhook.stop();
  stopAutoPlay();
  if (nativeSender) {
    try {
      nativeSender.stdin.write('EXIT\n');
      nativeSender.kill();
    } catch (e) {}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('set-code', (event, code) => {
  codeToType = code.replace(/\r\n/g, '\n');
  currentIndex = 0;
  return { success: true, length: codeToType.length };
});

ipcMain.handle('set-config', (event, config) => {
  if (config.charsPerKeypress) charsPerKeypress = parseInt(config.charsPerKeypress) || 3;
  if (config.autoSpeedMs) autoSpeedMs = parseInt(config.autoSpeedMs) || 50;
  if (config.alwaysOnTop !== undefined && mainWindow) {
    mainWindow.setAlwaysOnTop(config.alwaysOnTop);
  }
  return { success: true };
});

ipcMain.handle('toggle-hacker-mode', (event, enable) => {
  isHackerModeActive = enable;
  return isHackerModeActive;
});

ipcMain.handle('toggle-autoplay', (event, enable) => {
  if (enable) {
    startAutoPlay();
  } else {
    stopAutoPlay();
  }
  return !!autoPlayTimer;
});

ipcMain.handle('reset-progress', () => {
  currentIndex = 0;
  stopAutoPlay();
  return { currentIndex: 0, percentage: 0 };
});
