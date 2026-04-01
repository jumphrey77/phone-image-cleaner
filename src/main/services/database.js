const Store = require('electron-store')

let store = null

const DatabaseService = {
  init(dbPath) {
    try {
      store = new Store({ name: 'photo-cleaner-db', cwd: dbPath })
      if (!store.get('folders')) store.set('folders', [])
      if (!store.get('actionsLog')) store.set('actionsLog', [])
      if (!store.get('lastScan')) store.set('lastScan', null)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  saveFolders(folders) {
    try {
      const map = {}
      const existing = store.get('folders') || []
      existing.forEach((f) => (map[f.path] = f))
      folders.forEach((f) => { map[f.path] = { ...(map[f.path] || {}), ...f } })
      store.set('folders', Object.values(map))
      store.set('lastScan', new Date().toISOString())
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  updateFolderStatus(folderPath, status) {
    try {
      const folders = store.get('folders') || []
      store.set('folders', folders.map((f) => f.path === folderPath ? { ...f, status } : f))
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  getFolders() {
    try {
      return {
        success: true,
        folders: store.get('folders') || [],
        lastScan: store.get('lastScan') || null
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  clearFolders() {
    try {
      store.set('folders', [])
      store.set('lastScan', null)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  logAction(entry) {
    try {
      const log = store.get('actionsLog') || []
      log.push({ ...entry, timestamp: new Date().toISOString() })
      store.set('actionsLog', log)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }
}

module.exports = { DatabaseService }
