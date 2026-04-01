const { app, shell, BrowserWindow, ipcMain } = require('electron')
const { join } = require('path')
const { AdbService } = require('./services/adb')
const { FileSystemService } = require('./services/fileSystem')
const { DatabaseService } = require('./services/database')
const { GooglePhotosService } = require('./services/googlePhotos')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'Photo Cleanup Manager',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // In dev, load from vite dev server; in prod, load built file
  const isDev = process.env.NODE_ENV === 'development'
  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── ADB IPC Handlers ──────────────────────────────────────────────────────────
ipcMain.handle('adb:checkConnection', (_, adbPath) => AdbService.checkConnection(adbPath))
ipcMain.handle('adb:listFolders', (_, { adbPath, devicePath }) => AdbService.listFolders(adbPath, devicePath))
ipcMain.handle('adb:listFiles', (_, { adbPath, folderPath }) => AdbService.listFiles(adbPath, folderPath))
ipcMain.handle('adb:pullFile', (_, { adbPath, remotePath, localPath }) => AdbService.pullFile(adbPath, remotePath, localPath))
ipcMain.handle('adb:deleteFile', (_, { adbPath, remotePath }) => AdbService.deleteFile(adbPath, remotePath))

// ── FileSystem IPC Handlers ───────────────────────────────────────────────────
ipcMain.handle('fs:verifyFile', (_, { localPath, expectedSize }) => FileSystemService.verifyFile(localPath, expectedSize))
ipcMain.handle('fs:ensureDir', (_, dirPath) => FileSystemService.ensureDir(dirPath))
ipcMain.handle('fs:generateFolderName', (_, { sourceFolder, files, pattern }) => FileSystemService.generateFolderName(sourceFolder, files, pattern))
ipcMain.handle('fs:appendLog', (_, { logPath, entry }) => FileSystemService.appendLog(logPath, entry))

// ── Database IPC Handlers ─────────────────────────────────────────────────────
ipcMain.handle('db:init', (_, dbPath) => DatabaseService.init(dbPath))
ipcMain.handle('db:saveFolders', (_, folders) => DatabaseService.saveFolders(folders))
ipcMain.handle('db:updateFolderStatus', (_, { folderPath, status }) => DatabaseService.updateFolderStatus(folderPath, status))
ipcMain.handle('db:getFolders', () => DatabaseService.getFolders())
ipcMain.handle('db:logAction', (_, entry) => DatabaseService.logAction(entry))

// ── Google Photos IPC Handlers ────────────────────────────────────────────────
ipcMain.handle('gp:getAuthUrl', (_, creds) => GooglePhotosService.getAuthUrl(creds))
ipcMain.handle('gp:exchangeCode', async (_, { clientCredentials, code }) => GooglePhotosService.exchangeCode(clientCredentials, code))
ipcMain.handle('gp:listByDateRange', async (_, { tokens, startDate, endDate }) => GooglePhotosService.listByDateRange(tokens, startDate, endDate))
ipcMain.handle('gp:deleteItems', async (_, { tokens, mediaItemIds }) => GooglePhotosService.deleteItems(tokens, mediaItemIds))
