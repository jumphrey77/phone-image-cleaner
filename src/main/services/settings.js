const Store = require('electron-store')

const DEFAULT_SETTINGS = {
  adbPath: 'D:\\Apps\\Android Platform Tools\\platform-tools\\adb.exe',
  localPicturesRoot: 'D:\\OneDrive\\OneDrive - Certified Training Services\\Pictures',
  folderPattern: 'YYYY-MM-DD Title',
  devicePath: '/sdcard/DCIM',
  goalGb: 15,
  startingGb: 25.55,
  whatIfMode: false,
  configured: false,
  // Google Photos OAuth — user sets these from Google Cloud Console
  gpClientId: '',
  gpClientSecret: '',
  gpTokens: null   // { access_token, refresh_token, expiry_date, ... }
}

let store = null

function getStore() {
  if (!store) store = new Store({ name: 'app-config' })
  return store
}

const SettingsService = {
  load() {
    try {
      const s = getStore()
      return { success: true, settings: { ...DEFAULT_SETTINGS, ...s.get('settings', {}) } }
    } catch (err) {
      return { success: false, error: err.message, settings: DEFAULT_SETTINGS }
    }
  },

  save(settings) {
    try {
      const s = getStore()
      s.set('settings', { ...settings, configured: true })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  isConfigured() {
    try {
      const s = getStore()
      return { success: true, configured: !!s.get('settings.configured') }
    } catch {
      return { success: true, configured: false }
    }
  }
}

module.exports = { SettingsService }
