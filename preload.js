const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  setCode: (code) => ipcRenderer.invoke('set-code', code),
  setConfig: (config) => ipcRenderer.invoke('set-config', config),
  toggleHackerMode: (enable) => ipcRenderer.invoke('toggle-hacker-mode', enable),
  toggleAutoPlay: (enable) => ipcRenderer.invoke('toggle-autoplay', enable),
  resetProgress: () => ipcRenderer.invoke('reset-progress'),
  
  onModeToggled: (callback) => ipcRenderer.on('mode-toggled', (_event, value) => callback(value)),
  onAutoPlayToggled: (callback) => ipcRenderer.on('autoplay-toggled', (_event, value) => callback(value)),
  onProgressUpdate: (callback) => ipcRenderer.on('progress-update', (_event, data) => callback(data)),
  onStatusUpdate: (callback) => ipcRenderer.on('status-update', (_event, data) => callback(data))
});
