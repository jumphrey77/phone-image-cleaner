const { execFileSync } = require('child_process')
const path = require('path')

// keywords comes from settings.lockedKeywords — injected by main process
function isProtected(filePath, keywords = ['kora']) {
  const lower = filePath.toLowerCase()
  return keywords.some((k) => k && lower.includes(k.toLowerCase()))
}

function parseLsOutput(raw) {
  const files = []
  // Split on \r\n or \n — ADB on Windows often produces CRLF output
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    // Only process regular file lines (start with '-')
    if (!trimmed.startsWith('-')) continue
    // Android ls -la format:
    // -rw-rw---- 1 u0_a123 sdcard_rw 1234567 2024-06-01 12:34:56 filename.jpg
    const match = trimmed.match(
      /^-[\w-]+\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\d{4}-\d{2}-\d{2})\s+([\d:]+)\s+(.+)$/
    )
    if (match) {
      files.push({
        size: parseInt(match[1], 10),
        date: match[2],
        time: match[3],
        name: match[4].trim(),
        type: getFileType(match[4].trim())
      })
    }
  }
  return files
}

function getFileType(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  if (['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif'].includes(ext)) return 'photo'
  if (['mp4', 'mov', 'avi', 'mkv', '3gp'].includes(ext)) return 'video'
  return 'other'
}

const AdbService = {
  checkConnection(adbPath) {
    try {
      const result = execFileSync(adbPath, ['devices'], { encoding: 'utf8', timeout: 5000 })
      const lines = result.trim().split('\n').slice(1)
      const devices = lines
        .filter((l) => l.includes('\tdevice'))
        .map((l) => ({ serial: l.split('\t')[0], status: 'connected' }))
      return { success: true, devices }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  listFolders(adbPath, devicePath = '/sdcard/DCIM', keywords = ['kora']) {
    try {
      const result = execFileSync(adbPath, ['shell', `find "${devicePath}" -maxdepth 1 -type d`], {
        encoding: 'utf8', timeout: 30000
      })
      const folders = result.trim().split('\n')
        .map((f) => f.trim())
        .filter((f) => f && f !== devicePath)
        .map((folderPath) => {
          const name = path.posix.basename(folderPath)
          const locked = isProtected(folderPath, keywords)
          return { path: folderPath, name, locked, status: locked ? 'locked' : 'pending' }
        })

      const enriched = folders.map((folder) => {
        try {
          const lsResult = execFileSync(
            adbPath, ['shell', `ls -la "${folder.path}/" 2>/dev/null`],
            { encoding: 'utf8', timeout: 15000, maxBuffer: 10 * 1024 * 1024 }
          )
          const files = parseLsOutput(lsResult)
          const totalSize = files.reduce((sum, f) => sum + f.size, 0)
          const dates = files.map((f) => f.date).filter(Boolean).sort()
          return {
            ...folder,
            fileCount: files.length,
            totalSizeMb: Math.round((totalSize / 1024 / 1024) * 10) / 10,
            dateMin: dates[0] || null,
            dateMax: dates[dates.length - 1] || null,
            hasVideo: files.some((f) => f.type === 'video')
          }
        } catch {
          return { ...folder, fileCount: 0, totalSizeMb: 0, hasVideo: false }
        }
      })

      return { success: true, folders: enriched }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  listFiles(adbPath, folderPath, keywords = ['kora']) {
    if (isProtected(folderPath, keywords)) {
      return { success: false, error: 'This folder is protected and cannot be accessed.' }
    }
    try {
      const result = execFileSync(
        adbPath, ['shell', `ls -la "${folderPath}/" 2>/dev/null`],
        { encoding: 'utf8', timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
      )
      const files = parseLsOutput(result).map((f) => ({
        ...f,
        remotePath: `${folderPath}/${f.name}`,
        onDevice: true,
        onCloud: null,  // null = unknown (requires Google Photos API — Phase 2)
        onPc: null      // null = unknown (local check not yet implemented)
      }))
      return { success: true, files }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  pullFile(adbPath, remotePath, localPath, keywords = ['kora']) {
    if (isProtected(remotePath, keywords)) {
      return { success: false, error: 'Protected file — cannot copy.' }
    }
    try {
      execFileSync(adbPath, ['pull', remotePath, localPath], { encoding: 'utf8', timeout: 300000 })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  deleteFile(adbPath, remotePath, keywords = ['kora']) {
    if (isProtected(remotePath, keywords)) {
      return { success: false, error: 'Protected file — cannot delete.' }
    }
    try {
      execFileSync(adbPath, ['shell', `rm "${remotePath}"`], { encoding: 'utf8', timeout: 15000 })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  deleteFolder(adbPath, folderPath, keywords = ['kora']) {
    if (isProtected(folderPath, keywords)) {
      return { success: false, error: 'Protected folder — cannot delete.' }
    }
    try {
      // rmdir only removes truly empty directories — safe to use
      execFileSync(adbPath, ['shell', `rmdir "${folderPath}"`], { encoding: 'utf8', timeout: 15000 })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }
}

module.exports = { AdbService }
