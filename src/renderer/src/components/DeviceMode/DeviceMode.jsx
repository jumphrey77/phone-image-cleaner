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

    // Annotate each file with onPc if PC scan is available
    const enriched = result.files.map((f) => ({
      ...f,
      onPc: localFileSet ? localFileSet.has(f.name.toLowerCase()) : null
    }))
    setFiles(enriched)
    setLoadingFiles(false)

    // Update window title to show selected folder
    document.title = `Photo Cleanup Manager — ${folder.name} (${result.files.length} files)`
  }

  const renameFolder = async (folder, newName) => {
    const parentPath = folder.path.substring(0, folder.path.lastIndexOf('/'))
    const newPath = `${parentPath}/${newName}`
    if (whatIf) {
      addLog({ action: '[WHATIF] RENAME', result: `Would rename: ${folder.name} → ${newName}` })
      return
    }
    const result = await window.api.adb.renameFolder(settings.adbPath, folder.path, newPath)
    if (result.success) {
      addLog({ action: 'RENAME', result: `${folder.name} → ${newName}` })
      const updated = folders.map((f) =>
        f.path === folder.path ? { ...f, path: newPath, name: newName } : f
      )
      setFolders(updated)
      setSelectedFolder(null)
      setFiles([])
      await window.api.db.saveFolders(updated)
      document.title = 'Photo Cleanup Manager'
    } else {
      addLog({ action: 'RENAME', result: 'Failed', error: result.error })
    }
  }

  const deleteAllEmptyFolders = async () => {
    const emptyFolders = folders.filter((f) => f.fileCount === 0 && !f.locked)
    if (emptyFolders.length === 0) { addLog({ action: 'DELETE EMPTY', result: 'No empty folders found' }); return }
    // WhatIf-aware prefix for the summary log
    const pfx = whatIf ? '[WHATIF] ' : ''
    addLog({ action: `${pfx}DELETE EMPTY`, result: `${whatIf ? 'Would delete' : 'Deleting'} ${emptyFolders.length} empty folders…` })
    let count = 0
    for (const f of emptyFolders) {
      if (whatIf) {
        addLog({ action: '[WHATIF] DELETE FOLDER', result: `Would delete: ${f.name}` })
        count++
      } else {
        const r = await window.api.adb.deleteFolder(settings.adbPath, f.path)
        if (r.success) { addLog({ action: 'DELETE FOLDER', result: `Deleted: ${f.name}` }); count++ }
        else addLog({ action: 'DELETE FOLDER', result: `Failed: ${f.name}`, error: r.error })
      }
    }
    // Only update UI and DB when NOT in WhatIf — in WhatIf folders stay visible
    if (!whatIf) {
      const updated = folders.filter((f) => f.fileCount !== 0 || f.locked)
      setFolders(updated)
      await window.api.db.saveFolders(updated)
    }
    addLog({ action: `${pfx}DELETE EMPTY`, result: `${whatIf ? 'Simulation complete' : 'Done'} — ${count} folder${count !== 1 ? 's' : ''} ${whatIf ? 'would be' : ''} removed` })
  }

  const switchToMtp = async () => {
    addLog({ action: 'MTP', result: 'Switching device to MTP file transfer mode…' })
    const result = await window.api.adb.switchToMtp(settings.adbPath)
    if (result.success) addLog({ action: 'MTP', result: '✅ MTP mode activated — check device notification' })
    else addLog({ action: 'MTP', result: 'Failed', error: result.error })
  }

  const scanLocalFiles = async () => {
    if (!settings?.localPicturesRoot) {
      addLog({ action: 'PC SCAN', result: '⚠ Local Pictures Root not set in Settings' })
      return
    }
    setScanningPc(true)
    setScanCount(0)
    setScanLog([])
    setScanLogOpen(true)   // auto-open scan activity panel when scan starts
    addLog({ action: 'PC SCAN', result: `Scanning ${settings.localPicturesRoot}…` })

    // Subscribe to streaming progress events from main process
    const unsub = window.api.fs.onScanProgress(({ count, lastFile }) => {
      setScanCount(count)
      setScanLog((prev) => {
        const next = [...prev, lastFile]
        return next.length > 200 ? next.slice(-200) : next   // keep last 200 entries
      })
    })

    const result = await window.api.fs.scanLocalFiles(settings.localPicturesRoot)
    unsub()   // clean up listener

    if (result.success) {
      const fileSet = new Set(result.filenames)
      setLocalFileSet(fileSet)
      setScanCount(result.count)
      addLog({ action: 'PC SCAN', result: `Done — ${result.count.toLocaleString()} files indexed. PC column now active.` })
      // Re-enrich currently loaded files if a folder is open
      if (files.length > 0) {
        setFiles((prev) => prev.map((f) => ({ ...f, onPc: fileSet.has(f.name.toLowerCase()) })))
      }
    } else {
      addLog({ action: 'PC SCAN', result: 'Scan failed', error: result.error })
    }
    setScanningPc(false)
  }

  const deleteEmptyFolder = async (folder) => {
    if (whatIf) {
      // WhatIf: log only — do NOT modify UI or touch device
      addLog({ action: '[WHATIF] DELETE FOLDER', result: `Would delete empty folder: ${folder.name}` })
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
      // Only persist and visually update folder status in live mode
      await window.api.db.updateFolderStatus(selectedFolder.path, newStatus)
      setFolders((prev) =>
        prev.map((f) => (f.path === selectedFolder.path ? { ...f, status: newStatus } : f))
      )
    }

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
  const [pickerMonth, setPickerMonth] = useState('')   // YYYY-MM format

  // PC file scan state — null = not yet scanned, Set = lowercased filenames from localPicturesRoot
  const [localFileSet, setLocalFileSet] = useState(null)
  const [scanningPc, setScanningPc] = useState(false)
  const [scanCount, setScanCount] = useState(0)           // live file count during scan
  const [scanLog, setScanLog] = useState([])              // recent filenames scrolling during scan
  const [scanLogOpen, setScanLogOpen] = useState(false)   // collapsible scan log panel

  const openPicker = async () => {
    if (!gpReady) {
      addLog({ action: 'PICKER', result: '⚠ Connect Google Photos in Settings first' })
      return
    }
    setPickerStatus('Creating session…')
    addLog({ action: 'PICKER', result: 'Creating picker session…' })

    // Build date range from pickerMonth (YYYY-MM) if set
    let dateRange = null
    if (pickerMonth) {
      const [y, m] = pickerMonth.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()  // last day of month
      dateRange = {
        startDate: `${pickerMonth}-01`,
        endDate: `${pickerMonth}-${String(lastDay).padStart(2, '0')}`
      }
      addLog({ action: 'PICKER', result: `Month filter: ${dateRange.startDate} → ${dateRange.endDate} (client-side — select any photos, app will keep only this month's)` })
    } else {
      addLog({ action: 'PICKER', result: 'No month filter — all selected photos will be returned' })
    }

    // Step 1: Create session
    const session = await window.api.gp.createPickerSession(
      settings.gpTokens, settings.gpClientId, settings.gpClientSecret, dateRange
    )
    if (!session.success) {
      setPickerStatus(`❌ ${session.error}`)
      addLog({ action: 'PICKER', result: 'Failed', error: session.error })
      return
    }

    // Step 2: Open picker in a popup window (autoclose is appended inside the IPC handler)
    await window.api.gp.openPickerPopup(session.pickerUri)
    setPickerStatus('⏳ Select photos in popup, then click Done…')
    addLog({ action: 'PICKER', result: `Picker opened in popup — select photos and click Done` })

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

    // Client-side date filter — Picker API may not support dateFilter server-side
    let items = result.items
    if (dateRange && pickerMonth) {
      const before = items.length
      items = items.filter((item) => item.date && item.date.startsWith(pickerMonth))
      if (before !== items.length) {
        addLog({ action: 'PICKER', result: `Client-side filter: ${before} → ${items.length} items matching ${pickerMonth}` })
      } else {
        addLog({ action: 'PICKER', result: `All ${items.length} items already within ${pickerMonth}` })
      }
    }

    setPickerItems(items)
    setPickerStatus(`✅ Got ${items.length} items`)
    addLog({ action: 'PICKER', result: `${items.length} item${items.length !== 1 ? 's' : ''} selected` })
    items.forEach((item) => {
      addLog({ action: 'PICKER ITEM', filename: item.filename, result: `${item.date} | ${item.type} | ID: ${item.id.substring(0, 20)}…` })
    })

    // Cross-reference picker results against currently loaded files → light up Cloud column ✅
    if (files.length > 0 && items.length > 0) {
      const pickerNames = new Set(items.map((i) => i.filename.toLowerCase()))
      setFiles((prev) =>
        prev.map((f) => pickerNames.has(f.name.toLowerCase()) ? { ...f, onCloud: true } : f)
      )
      const matched = files.filter((f) => pickerNames.has(f.name.toLowerCase())).length
      if (matched > 0) {
        addLog({ action: 'PICKER', result: `☁ Marked ${matched} file${matched !== 1 ? 's' : ''} as In Cloud in current folder view` })
      }
    }

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
            <div className="picker-row">
              <input
                type="month"
                className="picker-month-input"
                value={pickerMonth}
                onChange={(e) => setPickerMonth(e.target.value)}
                title="Filter picker to a specific month (optional)"
              />
              <button className="btn-ghost btn-picker" onClick={openPicker} title="Open Google Photos Picker">
                ☁ Picker {pickerMonth || 'All'} {pickerStatus ? `— ${pickerStatus}` : ''}
              </button>
            </div>
          )}
          <button
            className={`btn-ghost${localFileSet ? ' btn-pc-active' : ''}`}
            onClick={scanLocalFiles}
            disabled={scanningPc}
            title={localFileSet ? `PC scan active — ${localFileSet.size.toLocaleString()} files indexed. Click to re-scan.` : 'Scan local PC pictures folder to show which phone files are already on PC'}
          >
            {scanningPc
              ? `⏳ Scanning PC… ${scanCount > 0 ? scanCount.toLocaleString() : ''}`
              : localFileSet
                ? `🖥 PC ✓ ${localFileSet.size.toLocaleString()}`
                : '🖥 Scan PC'}
          </button>
          {(scanningPc || scanLog.length > 0) && (
            <button
              className="btn-ghost"
              onClick={() => setScanLogOpen((v) => !v)}
              title="Toggle scan activity log"
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              {scanLogOpen ? '▲ Activity' : '▼ Activity'}
            </button>
          )}
          <button className="btn-ghost" onClick={switchToMtp} title="Switch phone to MTP file transfer mode">
            📲 MTP
          </button>
          <button className="btn-ghost" onClick={scanDevice} disabled={loading}>
            {loading ? '⏳ Loading…' : '↻ Scan Device'}
          </button>
        </div>
      </div>

      {/* Scan Activity panel — collapsible, auto-opens during PC scan, shows live filenames */}
      {scanLogOpen && scanLog.length > 0 && (
        <div className="scan-activity-panel">
          <div className="scan-activity-header">
            <span>🖥 PC Scan Activity {scanningPc ? `— ${scanCount.toLocaleString()} files…` : `— Complete (${(localFileSet?.size || scanCount).toLocaleString()} files)`}</span>
            <button className="btn-ghost" onClick={() => setScanLogOpen(false)} style={{ fontSize: 11, padding: '2px 8px' }}>✕ Close</button>
          </div>
          <div className="scan-activity-log" ref={(el) => { if (el) el.scrollTop = el.scrollHeight }}>
            {scanLog.map((name, i) => (
              <div key={i} className="scan-activity-line">{name}</div>
            ))}
            {scanningPc && <div className="scan-activity-line scan-activity-pulse">⏳ scanning…</div>}
          </div>
        </div>
      )}

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
          onRenameFolder={renameFolder}
          onDeleteAllEmpty={deleteAllEmptyFolders}
          executing={executing}
          progress={executionProgress}
          whatIf={whatIf}
          gpReady={gpReady}
          emptyFolderCount={folders.filter((f) => f.fileCount === 0 && !f.locked).length}
        />
      </div>
    </div>
  )
}
