"use strict";
const { app, shell, BrowserWindow, ipcMain, dialog } = require("electron");
const { join } = require("path");
const { AdbService } = require("./services/adb");
const { FileSystemService } = require("./services/fileSystem");
const { DatabaseService } = require("./services/database");
const { GooglePhotosService } = require("./services/googlePhotos");
const { SettingsService } = require("./services/settings");
let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: "Photo Cleanup Manager",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  mainWindow.on("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });
  const isDev = process.env.NODE_ENV === "development";
  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
ipcMain.handle("shell:openExternal", (_, url) => shell.openExternal(url));
ipcMain.handle("dialog:openFolder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select Folder",
    properties: ["openDirectory"]
  });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle("dialog:openFile", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select ADB Executable",
    properties: ["openFile"],
    filters: [{ name: "Executables", extensions: ["exe", "*"] }]
  });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle("settings:load", () => SettingsService.load());
ipcMain.handle("settings:save", (_, settings) => SettingsService.save(settings));
ipcMain.handle("settings:isConfigured", () => SettingsService.isConfigured());
function getLockedKeywords() {
  try {
    const result = SettingsService.load();
    const raw = result.settings?.lockedKeywords || "kora";
    return raw.split(",").map((k) => k.trim()).filter(Boolean);
  } catch {
    return ["kora"];
  }
}
ipcMain.handle("adb:checkConnection", (_, adbPath) => AdbService.checkConnection(adbPath));
ipcMain.handle("adb:listFolders", (_, { adbPath, devicePath }) => AdbService.listFolders(adbPath, devicePath, getLockedKeywords()));
ipcMain.handle("adb:listFiles", (_, { adbPath, folderPath }) => AdbService.listFiles(adbPath, folderPath, getLockedKeywords()));
ipcMain.handle("adb:pullFile", (_, { adbPath, remotePath, localPath }) => AdbService.pullFile(adbPath, remotePath, localPath, getLockedKeywords()));
ipcMain.handle("adb:deleteFile", (_, { adbPath, remotePath }) => AdbService.deleteFile(adbPath, remotePath, getLockedKeywords()));
ipcMain.handle("adb:deleteFolder", (_, { adbPath, folderPath }) => AdbService.deleteFolder(adbPath, folderPath, getLockedKeywords()));
ipcMain.handle("adb:renameFolder", (_, { adbPath, oldPath, newPath }) => AdbService.renameFolder(adbPath, oldPath, newPath, getLockedKeywords()));
ipcMain.handle("adb:switchToMtp", (_, { adbPath }) => AdbService.switchToMtp(adbPath));
ipcMain.handle("fs:verifyFile", (_, { localPath, expectedSize }) => FileSystemService.verifyFile(localPath, expectedSize));
ipcMain.handle("fs:ensureDir", (_, dirPath) => FileSystemService.ensureDir(dirPath));
ipcMain.handle("fs:generateFolderName", (_, { sourceFolder, files, pattern }) => FileSystemService.generateFolderName(sourceFolder, files, pattern));
ipcMain.handle("fs:appendLog", (_, { logPath, entry }) => FileSystemService.appendLog(logPath, entry));
ipcMain.handle(
  "fs:scanLocalFiles",
  (event, { rootPath }) => FileSystemService.scanLocalFiles(rootPath, (count, lastFile) => {
    event.sender.send("fs:scanProgress", { count, lastFile });
  })
);
ipcMain.handle("db:init", (_, dbPath) => DatabaseService.init(dbPath));
ipcMain.handle("db:saveFolders", (_, folders) => DatabaseService.saveFolders(folders));
ipcMain.handle("db:updateFolderStatus", (_, { folderPath, status }) => DatabaseService.updateFolderStatus(folderPath, status));
ipcMain.handle("db:getFolders", () => DatabaseService.getFolders());
ipcMain.handle("db:logAction", (_, entry) => DatabaseService.logAction(entry));
ipcMain.handle("db:clearFolders", () => DatabaseService.clearFolders());
ipcMain.handle("gp:startOAuth", async (_, { clientId, clientSecret }) => {
  const prep = GooglePhotosService.prepareOAuth(clientId, clientSecret);
  if (!prep.success) return prep;
  shell.openExternal(prep.authUrl);
  return await prep.tokenPromise;
});
ipcMain.handle("gp:checkAuth", async (_, { tokens, clientId, clientSecret }) => GooglePhotosService.checkAuth(tokens, clientId, clientSecret));
ipcMain.handle("gp:listByDateRange", async (_, { tokens, startDate, endDate, clientId, clientSecret }) => GooglePhotosService.listByDateRange(tokens, startDate, endDate, clientId, clientSecret));
ipcMain.handle("gp:batchDelete", async (_, { tokens, mediaItemIds, clientId, clientSecret }) => GooglePhotosService.batchDelete(tokens, mediaItemIds, clientId, clientSecret));
ipcMain.handle("gp:createPickerSession", async (_, { tokens, clientId, clientSecret, dateRange }) => GooglePhotosService.createPickerSession(tokens, clientId, clientSecret, dateRange || null));
ipcMain.handle("gp:pollPickerSession", async (_, { tokens, clientId, clientSecret, sessionId }) => GooglePhotosService.pollPickerSession(tokens, clientId, clientSecret, sessionId));
ipcMain.handle("gp:getPickerItems", async (_, { tokens, clientId, clientSecret, sessionId }) => GooglePhotosService.getPickerItems(tokens, clientId, clientSecret, sessionId));
ipcMain.handle("gp:openPickerPopup", (_, { pickerUri }) => {
  try {
    const popup = new BrowserWindow({
      width: 920,
      height: 700,
      autoHideMenuBar: true,
      title: "Google Photos — Select Photos",
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    popup.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: "deny" };
    });
    popup.loadURL(pickerUri + "/autoclose");
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
