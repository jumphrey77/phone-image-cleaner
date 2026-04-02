"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const api = {
  dialog: {
    openFolder: () => ipcRenderer.invoke("dialog:openFolder"),
    openFile: () => ipcRenderer.invoke("dialog:openFile")
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url)
  },
  settings: {
    load: () => ipcRenderer.invoke("settings:load"),
    save: (settings) => ipcRenderer.invoke("settings:save", settings),
    isConfigured: () => ipcRenderer.invoke("settings:isConfigured")
  },
  adb: {
    checkConnection: (adbPath) => ipcRenderer.invoke("adb:checkConnection", adbPath),
    listFolders: (adbPath, devicePath) => ipcRenderer.invoke("adb:listFolders", { adbPath, devicePath }),
    listFiles: (adbPath, folderPath) => ipcRenderer.invoke("adb:listFiles", { adbPath, folderPath }),
    pullFile: (adbPath, remotePath, localPath) => ipcRenderer.invoke("adb:pullFile", { adbPath, remotePath, localPath }),
    deleteFile: (adbPath, remotePath) => ipcRenderer.invoke("adb:deleteFile", { adbPath, remotePath }),
    deleteFolder: (adbPath, folderPath) => ipcRenderer.invoke("adb:deleteFolder", { adbPath, folderPath }),
    renameFolder: (adbPath, oldPath, newPath) => ipcRenderer.invoke("adb:renameFolder", { adbPath, oldPath, newPath }),
    switchToMtp: (adbPath) => ipcRenderer.invoke("adb:switchToMtp", { adbPath })
  },
  fs: {
    verifyFile: (localPath, expectedSize) => ipcRenderer.invoke("fs:verifyFile", { localPath, expectedSize }),
    ensureDir: (dirPath) => ipcRenderer.invoke("fs:ensureDir", dirPath),
    generateFolderName: (sourceFolder, files, pattern) => ipcRenderer.invoke("fs:generateFolderName", { sourceFolder, files, pattern }),
    appendLog: (logPath, entry) => ipcRenderer.invoke("fs:appendLog", { logPath, entry }),
    scanLocalFiles: (rootPath) => ipcRenderer.invoke("fs:scanLocalFiles", { rootPath }),
    // Returns an unsubscribe function — call it in useEffect cleanup
    onScanProgress: (cb) => {
      const handler = (_, data) => cb(data);
      ipcRenderer.on("fs:scanProgress", handler);
      return () => ipcRenderer.removeListener("fs:scanProgress", handler);
    }
  },
  db: {
    init: (dbPath) => ipcRenderer.invoke("db:init", dbPath),
    saveFolders: (folders) => ipcRenderer.invoke("db:saveFolders", folders),
    updateFolderStatus: (folderPath, status) => ipcRenderer.invoke("db:updateFolderStatus", { folderPath, status }),
    getFolders: () => ipcRenderer.invoke("db:getFolders"),
    clearFolders: () => ipcRenderer.invoke("db:clearFolders"),
    logAction: (entry) => ipcRenderer.invoke("db:logAction", entry)
  },
  gp: {
    startOAuth: (clientId, clientSecret) => ipcRenderer.invoke("gp:startOAuth", { clientId, clientSecret }),
    checkAuth: (tokens, clientId, clientSecret) => ipcRenderer.invoke("gp:checkAuth", { tokens, clientId, clientSecret }),
    listByDateRange: (tokens, start, end, clientId, clientSecret) => ipcRenderer.invoke("gp:listByDateRange", { tokens, startDate: start, endDate: end, clientId, clientSecret }),
    batchDelete: (tokens, mediaItemIds, clientId, clientSecret) => ipcRenderer.invoke("gp:batchDelete", { tokens, mediaItemIds, clientId, clientSecret }),
    createPickerSession: (tokens, clientId, clientSecret, dateRange) => ipcRenderer.invoke("gp:createPickerSession", { tokens, clientId, clientSecret, dateRange }),
    pollPickerSession: (tokens, clientId, clientSecret, sessionId) => ipcRenderer.invoke("gp:pollPickerSession", { tokens, clientId, clientSecret, sessionId }),
    getPickerItems: (tokens, clientId, clientSecret, sessionId) => ipcRenderer.invoke("gp:getPickerItems", { tokens, clientId, clientSecret, sessionId }),
    openPickerPopup: (pickerUri) => ipcRenderer.invoke("gp:openPickerPopup", { pickerUri })
  }
};
contextBridge.exposeInMainWorld("api", api);
