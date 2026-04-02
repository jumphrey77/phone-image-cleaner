const fs = require('fs')
const path = require('path')

const FileSystemService = {
  ensureDir(dirPath) {
    try {
      fs.mkdirSync(dirPath, { recursive: true })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  verifyFile(localPath, expectedSize) {
    try {
      const stat = fs.statSync(localPath)
      return { success: true, exists: true, sizeMatch: stat.size === expectedSize, actualSize: stat.size }
    } catch {
      return { success: false, exists: false }
    }
  },

  generateFolderName(sourceFolder, files, pattern = 'YYYY-MM-DD Title') {
    try {
      const dates = files.map((f) => f.date).filter(Boolean).sort()
      const earliestDate = dates[0] || new Date().toISOString().split('T')[0]
      const [year, month, day] = earliestDate.split('-')

      let title = path.basename(sourceFolder)
      title = title.replace(/^[#\d\-_]+/, '').trim()
      title = title.replace(/[^a-zA-Z0-9 \-]/g, '').trim()
      title = title || 'Photos'

      return { success: true, folderName: `${year}-${month}-${day} ${title}` }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  appendLog(logPath, entry) {
    try {
      const ts = new Date().toISOString()
      const line = `[${ts}] [${entry.action}] ${entry.folder || ''} | ${entry.filename || ''} | ${entry.result}${entry.error ? ' | ERROR: ' + entry.error : ''}\n`
      fs.appendFileSync(logPath, line, 'utf8')
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  // Recursively scan rootPath and return all filenames (lowercased) for PC-presence lookup.
  // onProgress(count, lastFilename) is called every 250 files so the renderer can stream updates.
  scanLocalFiles(rootPath, onProgress) {
    try {
      const filenames = []
      const scan = (dir) => {
        let entries
        try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
        for (const entry of entries) {
          if (entry.isDirectory()) {
            scan(path.join(dir, entry.name))
          } else {
            filenames.push(entry.name.toLowerCase())
            if (onProgress && filenames.length % 250 === 0) {
              onProgress(filenames.length, entry.name)
            }
          }
        }
      }
      scan(rootPath)
      return { success: true, count: filenames.length, filenames }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }
}

module.exports = { FileSystemService }
