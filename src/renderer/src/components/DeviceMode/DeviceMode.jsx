import { useState, useEffect } from 'react'
import FolderList from './FolderList'
import FolderDetail from './FolderDetail'
import ActionPanel from './ActionPanel'

export default function DeviceMode({ settings, whatIf, onSpaceFreed, addLog, onBack }) {
  const [folders, setFolders] = useState([])
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [executionProgress, setExecutionProgress] = useState(null)
  const [suggestedName, setSuggestedName] = useState('')
  const [lastScan, setLastScan] = useState(null)

  // On mount: load from cache — do NOT auto-scan the device
  useEffect(() => {
    loadFromCache()
  }, [])

  const loadFromCache = async () => {
    setLoading(true)
    const result = await window.api.db.getFolders()
    if (result.success && result.folders && result.folders.length > 0) {
      const sorted = result.folders.sort((a, b) => {
        if (a.locked && !b.locked) return 1
        if (!a.locked && b.locked) return -1
        return (b.totalSizeMb || 0) - (a.totalSizeMb || 0)
      })
      setFolders(sorted)
      setLastScan(result.lastScan || null)
      addLog({ action: 'LOAD', result: `Loaded ${sorted.length} folders from cache` })
    } else {
      // Nothing cached yet — prompt user to scan
      addLog({ action: 'LOAD', result: 'No cached data — use Refresh to scan device' })
    }
    setLoading(false)
  }

  const scanDevice = async () => {
    setLoading(true)
    addLog({ action: 'SCAN', result: `Scanning ${settings.devicePath}...` })
    const result = await window.api.adb.listFolders(settings.adbPath, settings.devicePath)
    if (result.success) {
      const sorted = result.folders.sort((a, b) => {
        if (a.locked && !b.locked) return 1
        if (!a.locked && b.locked) return -1
        return (b.totalSizeMb || 0) - (a.totalSizeMb || 0)
      })
      setFolders(sorted)
      setLastScan(new Date().toISOString())
      await window.api.db.saveFolders(sorted)
      addLog({ action: 'SCAN', result: `Found ${sorted.length} folders` })
    } else {
      addLog({ action: 'SCAN', result: 'Scan failed', error: result.error })
    }
    setLoading(false)
  }

  const selectFolder = async (folder) => {
    if (folder.locked) return
    setSelectedFolder(folder)
    setFiles([])
    setSuggestedName('')
    setLoadingFiles(true)

    const result = await window.api.adb.listFiles(settings.adbPath, folder.path)
    if (result.success) {
      setFiles(result.files)
      const nameResult = await window.api.fs.generateFolderName(
        folder.path,
        result.files,
        settings.folderPattern
      )
      if (nameResult.success) setSuggestedName(nameResult.folderName)
    } else {
      addLog({ action: 'LIST', folder: folder.name, result: 'Failed', error: result.error })
    }
    setLoadingFiles(false)
  }

  const executeAction = async (action, destinationName) => {
    if (!selectedFolder || executing) return
    setExecuting(true)
    const localDest = `${settings.localPicturesRoot}\\${destinationName}`
    let freedBytes = 0

    setExecutionProgress({ total: files.length, done: 0, current: '' })

    if (action === 'copy-to-pc' || action === 'move-to-pc') {
      if (whatIf) {
        // WhatIf: simulate the loop, log what would happen — no real file ops
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          setExecutionProgress({ total: files.length, done: i + 1, current: file.name })
          addLog({
            action: `[WHATIF] COPY`,
            folder: selectedFolder.name,
            filename: file.name,
            result: `Would copy → ${localDest}\\${file.name}`
          })
          freedBytes += file.size
          // Small artificial delay so progress is visible
          await new Promise((r) => setTimeout(r, 30))
        }
      } else {
        // Live execution
        await window.api.fs.ensureDir(localDest)

        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const localFilePath = `${localDest}\\${file.name}`
          setExecutionProgress({ total: files.length, done: i, current: file.name })

          const pullResult = await window.api.adb.pullFile(
            settings.adbPath,
            file.remotePath,
            localFilePath
          )

          if (pullResult.success) {
            const verify = await window.api.fs.verifyFile(localFilePath, file.size)
            if (verify.sizeMatch) {
              freedBytes += file.size
              addLog({ action: 'COPY', folder: selectedFolder.name, filename: file.name, result: 'OK' })
              await window.api.db.logAction({
                action: 'COPY', folder: selectedFolder.name,
                filename: file.name, size_bytes: file.size, result: 'OK'
              })
              await window.api.fs.appendLog(
                `${settings.localPicturesRoot}\\execution_log.txt`,
                { action: 'COPY', folder: selectedFolder.name, filename: file.name, result: 'OK' }
              )
            } else {
              addLog({ action: 'COPY', folder: selectedFolder.name, filename: file.name, result: 'SIZE MISMATCH', error: 'Verification failed' })
            }
          } else {
            addLog({ action: 'COPY', folder: selectedFolder.name, filename: file.name, result: 'FAILED', error: pullResult.error })
          }
        }
      }
    }

    // Update folder status (even in WhatIf, update the display state so you can see what would be done)
    const newStatus = action === 'leave-alone' ? 'locked' : action === 'skip' ? 'skipped' : 'done'
    if (!whatIf) {
      await window.api.db.updateFolderStatus(selectedFolder.path, newStatus)
    }
    setFolders((prev) =>
      prev.map((f) => (f.path === selectedFolder.path ? { ...f, status: newStatus } : f))
    )

    if (!whatIf) {
      onSpaceFreed(freedBytes / 1024 / 1024)
    }

    setExecutionProgress(null)
    setExecuting(false)
    setSelectedFolder(null)
    setFiles([])

    addLog({
      action: whatIf ? `[WHATIF] ${action.toUpperCase()}` : action.toUpperCase(),
      folder: selectedFolder.name,
      result: `${whatIf ? 'Simulated' : 'Done'} — ${(freedBytes / 1024 / 1024).toFixed(1)} MB ${whatIf ? 'would be' : ''} processed`
    })
  }

  const formatScanTime = (iso) => {
    if (!iso) return 'Never'
    return new Date(iso).toLocaleString()
  }

  return (
    <div className="device-mode">
      <div className="dm-header">
        <button className="btn-ghost" onClick={onBack}>← Back to Setup</button>
        <div className="dm-title-group">
          <h2>📱 Device Mode</h2>
          {lastScan && (
            <span className="dm-last-scan">Last scan: {formatScanTime(lastScan)}</span>
          )}
          {!lastScan && !loading && (
            <span className="dm-last-scan warn">No scan yet — connect phone and click Refresh</span>
          )}
        </div>
        <button className="btn-ghost" onClick={scanDevice} disabled={loading}>
          {loading ? '⏳ Loading...' : '↻ Refresh Device'}
        </button>
      </div>

      <div className="dm-body">
        <FolderList
          folders={folders}
          loading={loading}
          selectedFolder={selectedFolder}
          onSelect={selectFolder}
        />
        <FolderDetail
          folder={selectedFolder}
          files={files}
          loading={loadingFiles}
        />
        <ActionPanel
          folder={selectedFolder}
          suggestedName={suggestedName}
          onSuggestedNameChange={setSuggestedName}
          onExecute={executeAction}
          executing={executing}
          progress={executionProgress}
          whatIf={whatIf}
        />
      </div>
    </div>
  )
}
