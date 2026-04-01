const { contextBridge, ipcRenderer } = require('electron')

const api = {
  adb: {
    checkConnection: (adbPath) => ipcRenderer.invoke('adb:checkConnection', adbPath),
    listFolders: (adbPath, devicePath) => ipcRenderer.invoke('adb:listFolders', { adbPath, devicePath }),
    listFiles: (adbPath, folderPath) => ipcRenderer.invoke('adb:listFiles', { adbPath, folderPath }),
    pullFile: (adbPath, remotePath, localPath) => ipcRenderer.invoke('adb:pullFile', { adbPath, remotePath, localPath }),
    deleteFile: (adbPath, remotePath) => ipcRenderer.invoke('adb:deleteFile', { adbPath, remotePath })
  },
  fs: {
    verifyFile: (localPath, expectedSize) => ipcRenderer.invoke('fs:verifyFile', { localPath, expectedSize }),
    ensureDir: (dirPath) => ipcRenderer.invoke('fs:ensureDir', dirPath),
    generateFolderName: (sourceFolder, files, pattern) => ipcRenderer.invoke('fs:generateFolderName', { sourceFolder, files, pattern }),
    appendLog: (logPath, entry) => ipcRenderer.invoke('fs:appendLog', { logPath, entry })
  },
  db: {
    init: (dbPath) => ipcRenderer.invoke('db:init', dbPath),
    saveFolders: (folders) => ipcRenderer.invoke('db:saveFolders', folders),
    updateFolderStatus: (folderPath, status) => ipcRenderer.invoke('db:updateFolderStatus', { folderPath, status }),
    getFolders: () => ipcRenderer.invoke('db:getFolders'),
    logAction: (entry) => ipcRenderer.invoke('db:logAction', entry)
  },
  gp: {
    getAuthUrl: (creds) => ipcRenderer.invoke('gp:getAuthUrl', creds),
    exchangeCode: (creds, code) => ipcRenderer.invoke('gp:exchangeCode', { clientCredentials: creds, code }),
    listByDateRange: (tokens, start, end) => ipcRenderer.invoke('gp:listByDateRange', { tokens, startDate: start, endDate: end }),
    deleteItems: (tokens, ids) => ipcRenderer.invoke('gp:deleteItems', { tokens, mediaItemIds: ids })
  }
}

contextBridge.exposeInMainWorld('api', api)
