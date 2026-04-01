import { useState, useEffect } from 'react'
import FolderList from './FolderList'
import FolderDetail from './FolderDetail'
import ActionPanel from './ActionPanel'

export default function DeviceMode({ settings, onSpaceFreed, addLog, onBack }) {
  const [folders, setFolders] = useState([])
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [executionProgress, setExecutionProgress] = useState(null)
  const [suggestedName, setSuggestedName] = useState('')

  useEffect(() => {
    loadFolders()
  }, [])

  const loadFolders = async () => {
    setLoading(true)
    addLog({ action: 'SCAN', result: `Scanning ${settings.devicePath}...` })
    const result = await window.api.adb.listFolders(settings.adbPath, settings.devicePath)
    if (result.success) {
      // Sort: locked last, then by size descending
      const sorted = result.folders.sort((a, b) => {
        if (a.locked && !b.locked) return 1
        if (!a.locked && b.locked) return -1
        return (b.totalSizeMb || 0) - (a.totalSizeMb || 0)
      })
      setFolders(sorted)
      await window.api.db.saveFolders(sorted)
      addLog({ action: 'SCAN', result: `Found ${sorted.length} folders` })
    } else {
      addLog({ action: 'SCAN', result: 'Failed', error: result.error })
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
      // Generate suggested folder name
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
      // Ensure destination folder exists
      await window.api.fs.ensureDir(localDest)

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const localFilePath = `${localDest}\\${file.name}`
        setExecutionProgress({ total: files.length, done: i, current: file.name })

        // Pull file
        const pullResult = await window.api.adb.pullFile(
          settings.adbPath,
          file.remotePath,
          localFilePath
        )

        if (pullResult.success) {
          // Verify
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

    // Update folder status
    const newStatus = action === 'leave-alone' ? 'locked' : action === 'skip' ? 'skipped' : 'done'
    await window.api.db.updateFolderStatus(selectedFolder.path, newStatus)
    setFolders((prev) =>
      prev.map((f) => (f.path === selectedFolder.path ? { ...f, status: newStatus } : f))
    )

    onSpaceFreed(freedBytes / 1024 / 1024)
    setExecutionProgress(null)
    setExecuting(false)
    setSelectedFolder(null)
    setFiles([])

    addLog({
      action: action.toUpperCase(),
      folder: selectedFolder.name,
      result: `Done — ${(freedBytes / 1024 / 1024).toFixed(1)} MB processed`
    })
  }

  return (
    <div className="device-mode">
      <div className="dm-header">
        <button className="btn-ghost" onClick={onBack}>← Back to Setup</button>
        <h2>📱 Device Mode</h2>
        <button className="btn-ghost" onClick={loadFolders}>↻ Refresh</button>
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
        />
      </div>
    </div>
  )
}
