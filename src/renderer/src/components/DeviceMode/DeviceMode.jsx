import { useState, useEffect } from 'react'
import FolderList from './FolderList'
import FolderDetail from './FolderDetail'
import ActionPanel from './ActionPanel'

export default function DeviceMode({ settings, whatIf, onSpaceFreed, addLog, onSettingsUpdate }) {
  const [folders, setFolders] = useState([])
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [executionProgress, setExecutionProgress] = useState(null)
  const [suggestedName, setSuggestedName] = useState('')
  const [lastScan, setLastScan] = useState(null)

  const gpReady = !!(settings?.gpTokens && settings?.gpClientId && settings?.gpClientSecret)

  useEffect(() => { loadFromCache() }, [])

  const loadFromCache = async () => {
    setLoading(true)
    const result = await window.api.db.getFolders()
    if (result.success && result.folders?.length > 0) {
      setFolders(sortFolders(result.folders))
      setLastScan(result.lastScan || null)
      addLog({ action: 'LOAD', result: `Loaded ${result.folders.length} folders from cache` })
    } else {
      addLog({ action: 'LOAD', result: 'No cached data — use Refresh to scan device' })
    }
    setLoading(false)
  }

  const sortFolders = (list) =>
    [...list].sort((a, b) => {
      if (a.locked && !b.locked) return 1
      if (!a.locked && b.locked) return -1
      return (b.totalSizeMb || 0) - (a.totalSizeMb || 0)
    })

  const scanDevice = async () => {
    setLoading(true)
    addLog({ action: 'SCAN', result: `Scanning ${settings.devicePath}…` })
    const result = await window.api.adb.listFolders(settings.adbPath, settings.devicePath)
    if (result.success) {
      const sorted = sortFolders(result.folders)
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
    if (!result.success) {
      addLog({ action: 'LIST', folder: folder.name, result: 'Failed', error: result.error })
      setLoadingFiles(false)
      return
    }

    // Generate suggested folder name
    const nameResult = await window.api.fs.generateFolderName(folder.path, result.files, settings.folderPattern)
    if (nameResult.success) setSuggestedName(nameResult.folderName)

    setFiles(result.files)
    setLoadingFiles(false)

    // Update window title to show selected folder
    document.title = `Photo Cleanup Manager — ${folder.name} (${result.files.length} files)`
  }

  const deleteEmptyFolder = async (folder) => {
    if (whatIf) {
      addLog({ action: '[WHATIF] DELETE FOLDER', result: `Would delete empty folder: ${folder.name}` })
      setFolders((prev) => prev.filter((f) => f.path !== folder.path))
      return
    }
    const result = await window.api.adb.deleteFolder(settings.adbPath, folder.path)
    if (result.success) {
      addLog({ action: 'DELETE FOLDER', result: `Deleted: ${folder.name}` })
      const updated = folders.filter((f) => f.path !== folder.path)
      setFolders(updated)
      await window.api.db.saveFolders(updated)
    } else {
      addLog({ action: 'DELETE FOLDER', result: 'Failed', error: result.error })
    }
  }

  const executeAction = async (action, destinationName) => {
    if (!selectedFolder || executing) return
    setExecuting(true)
    const localDest = `${settings.localPicturesRoot}\\${destinationName}`
    let freedBytes = 0
    const gpItemIdsToDelete = []

    setExecutionProgress({ total: files.length, done: 0, current: '' })

    if (action === 'copy-to-pc' || action === 'move-to-pc') {
      if (whatIf) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          setExecutionProgress({ total: files.length, done: i + 1, current: file.name })
          addLog({
            action: '[WHATIF] COPY',
            folder: selectedFolder.name,
            filename: file.name,
            result: `Would copy → ${localDest}\\${file.name}`
          })
          if (action === 'move-to-pc' && file.gpItemId) {
            addLog({
              action: '[WHATIF] OPEN CLOUD',
              folder: selectedFolder.name,
              filename: file.name,
              result: 'Would open Google Photos in browser for manual delete'
            })
          }
          freedBytes += file.size
          await new Promise((r) => setTimeout(r, 30))
        }
      } else {
        await window.api.fs.ensureDir(localDest)

        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const localFilePath = `${localDest}\\${file.name}`
          setExecutionProgress({ total: files.length, done: i, current: file.name })

          const pullResult = await window.api.adb.pullFile(settings.adbPath, file.remotePath, localFilePath)

          if (pullResult.success) {
            const verify = await window.api.fs.verifyFile(localFilePath, file.size)
            if (verify.sizeMatch) {
              freedBytes += file.size
              if (action === 'move-to-pc' && file.gpItemId) {
                gpItemIdsToDelete.push(file.gpItemId)
              }
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
              addLog({ action: 'COPY', folder: selectedFolder.name, filename: file.name, result: 'SIZE MISMATCH' })
            }
          } else {
            addLog({ action: 'COPY', folder: selectedFolder.name, filename: file.name, result: 'FAILED', error: pullResult.error })
          }
        }

        // After copying, open Google Photos in browser so user can manually delete
        // (API deletion of existing user photos requires restricted Google scope — not available)
        if (action === 'move-to-pc' && gpItemIdsToDelete.length > 0) {
          const dates = files.map((f) => f.date).filter(Boolean).sort()
          const startDate = dates[0]
          const endDate = dates[dates.length - 1]
          // Open GP search for this date range so user can bulk-select and delete
          const gpUrl = `https://photos.google.com/search/${encodeURIComponent(startDate)}`
          await window.api.shell.openExternal(gpUrl)
          addLog({
            action: 'OPEN CLOUD',
            folder: selectedFolder.name,
            result: `Opened Google Photos — select and delete ${gpItemIdsToDelete.length} files manually`
          })
        }
      }
    }

    const newStatus = action === 'leave-alone' ? 'locked' : action === 'skip' ? 'skipped' : 'done'
    if (!whatIf) {
      await window.api.db.updateFolderStatus(selectedFolder.path, newStatus)
    }
    setFolders((prev) =>
      prev.map((f) => (f.path === selectedFolder.path ? { ...f, status: newStatus } : f))
    )

    if (!whatIf) onSpaceFreed(freedBytes / 1024 / 1024)

    setExecutionProgress(null)
    setExecuting(false)
    setSelectedFolder(null)
    setFiles([])

    addLog({
      action: whatIf ? `[WHATIF] ${action.toUpperCase()}` : action.toUpperCase(),
      folder: selectedFolder.name,
      result: `${whatIf ? 'Simulated' : 'Done'} — ${(freedBytes / 1024 / 1024).toFixed(1)} MB processed`
    })
  }

  const [pickerStatus, setPickerStatus] = useState('')
  const [pickerItems, setPickerItems] = useState([])

  const openPicker = async () => {
    if (!gpReady) {
      addLog({ action: 'PICKER', result: '⚠ Connect Google Photos in Settings first' })
      return
    }
    setPickerStatus('Creating session…')
    addLog({ action: 'PICKER', result: 'Creating picker session…' })

    // Step 1: Create session
    const session = await window.api.gp.createPickerSession(
      settings.gpTokens, settings.gpClientId, settings.gpClientSecret
    )
    if (!session.success) {
      setPickerStatus(`❌ ${session.error}`)
      addLog({ action: 'PICKER', result: 'Failed', error: session.error })
      return
    }

    // Step 2: Open picker in browser
    await window.api.shell.openExternal(session.pickerUri)
    setPickerStatus('⏳ Select photos in browser, then wait…')
    addLog({ action: 'PICKER', result: `Picker opened — select photos and close/finish in browser` })

    // Step 3: Poll until done
    const poll = await window.api.gp.pollPickerSession(
      settings.gpTokens, settings.gpClientId, settings.gpClientSecret, session.sessionId
    )
    if (!poll.success) {
      setPickerStatus(`❌ ${poll.error}`)
      addLog({ action: 'PICKER', result: 'Poll failed', error: poll.error })
      return
    }

    // Step 4: Fetch items
    setPickerStatus('Fetching selected items…')
    const result = await window.api.gp.getPickerItems(
      settings.gpTokens, settings.gpClientId, settings.gpClientSecret, session.sessionId
    )
    if (!result.success) {
      setPickerStatus(`❌ ${result.error}`)
      addLog({ action: 'PICKER', result: 'Fetch failed', error: result.error })
      return
    }

    setPickerItems(result.items)
    setPickerStatus(`✅ Got ${result.total} items`)
    addLog({ action: 'PICKER', result: `${result.total} items selected` })
    result.items.forEach((item) => {
      addLog({ action: 'PICKER ITEM', filename: item.filename, result: `${item.date} | ${item.type} | ID: ${item.id.substring(0, 20)}…` })
    })

    // After-picker action
    const doneAction = settings?.gpPickerDoneAction || 'close'
    if (doneAction !== 'close' && result.items.length > 0) {
      const dates = result.items.map((i) => i.date).filter(Boolean).sort()
      const earliestDate = dates[0] // YYYY-MM-DD
      let gpUrl = ''
      if (doneAction === 'open-day') {
        gpUrl = `https://photos.google.com/search/${encodeURIComponent(earliestDate)}`
      } else if (doneAction === 'open-month') {
        const ym = earliestDate.substring(0, 7) // YYYY-MM
        gpUrl = `https://photos.google.com/search/${encodeURIComponent(ym)}`
      }
      if (gpUrl) {
        await window.api.shell.openExternal(gpUrl)
        addLog({ action: 'PICKER', result: `Opened Google Photos: ${gpUrl}` })
      }
    }
  }

  const formatScanTime = (iso) => iso ? new Date(iso).toLocaleString() : 'Never'

  return (
    <div className="device-mode">
      <div className="dm-header">
        <div className="dm-title-group">
          <h2>📱 Device Mode</h2>
          {lastScan && <span className="dm-last-scan">Last scan: {formatScanTime(lastScan)}</span>}
          {!lastScan && !loading && <span className="dm-last-scan warn">No scan yet — connect phone and click Refresh</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {gpReady && (
            <button className="btn-ghost btn-picker" onClick={openPicker} title="Open Google Photos Picker">
              ☁ Picker Test {pickerStatus ? `— ${pickerStatus}` : ''}
            </button>
          )}
          <button className="btn-ghost" onClick={scanDevice} disabled={loading}>
            {loading ? '⏳ Loading…' : '↻ Refresh Device'}
          </button>
        </div>
      </div>

      <div className="dm-body">
        <FolderList
          folders={folders}
          loading={loading}
          selectedFolder={selectedFolder}
          onSelect={selectFolder}
          onDeleteFolder={deleteEmptyFolder}
        />
        <FolderDetail
          folder={selectedFolder}
          files={files}
          loading={loadingFiles}
          gpReady={gpReady}
        />
        <ActionPanel
          folder={selectedFolder}
          suggestedName={suggestedName}
          onSuggestedNameChange={setSuggestedName}
          onExecute={executeAction}
          executing={executing}
          progress={executionProgress}
          whatIf={whatIf}
          gpReady={gpReady}
        />
      </div>
    </div>
  )
}
