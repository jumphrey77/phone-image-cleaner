import { useState, useEffect } from 'react'

export default function ActionPanel({
  folder, suggestedName, onSuggestedNameChange,
  onExecute, onRenameFolder, onDeleteAllEmpty,
  executing, progress, whatIf, gpReady, emptyFolderCount
}) {
  const [activeTab, setActiveTab] = useState('pc')
  const [renameValue, setRenameValue] = useState('')
  const [pcAction, setPcAction] = useState('copy-to-pc')
  const [deviceAction, setDeviceAction] = useState('leave-alone')

  // Sync rename field when folder or suggestedName changes
  useEffect(() => {
    setRenameValue(suggestedName || folder?.name || '')
  }, [folder, suggestedName])

  if (!folder) {
    return (
      <div className="action-panel empty">
        <div className="ap-tabs">
          <button className={`ap-tab ${activeTab === 'device' ? 'active' : ''}`} onClick={() => setActiveTab('device')}>📱 Device</button>
          <button className={`ap-tab ${activeTab === 'pc' ? 'active' : ''}`} onClick={() => setActiveTab('pc')}>💻 PC</button>
        </div>
        <div className="ap-empty">Select a folder to see actions</div>
        {activeTab === 'device' && emptyFolderCount > 0 && (
          <div className="ap-bulk-section">
            <button className="btn-danger-ghost" onClick={onDeleteAllEmpty}>
              🗑 Delete All Empty Folders ({emptyFolderCount})
            </button>
            <small>Removes {emptyFolderCount} empty folder{emptyFolderCount !== 1 ? 's' : ''} from device</small>
          </div>
        )}
        {whatIf && <div className="whatif-banner">⚠ WhatIf Mode — no files will be changed</div>}
      </div>
    )
  }

  if (folder.locked) {
    return (
      <div className="action-panel">
        <div className="ap-tabs">
          <button className={`ap-tab ${activeTab === 'device' ? 'active' : ''}`} onClick={() => setActiveTab('device')}>📱 Device</button>
          <button className={`ap-tab ${activeTab === 'pc' ? 'active' : ''}`} onClick={() => setActiveTab('pc')}>💻 PC</button>
        </div>
        {whatIf && <div className="whatif-banner">⚠ WhatIf Mode — no files will be changed</div>}
        <div className="ap-locked">
          <span>🔒</span>
          <p>This folder is protected and cannot be modified.</p>
        </div>
      </div>
    )
  }

  const handlePcExecute = () => {
    if (executing) return
    onExecute(pcAction, suggestedName || folder.name)
  }

  const handleDeviceExecute = () => {
    if (executing) return
    if (deviceAction === 'rename') {
      if (!renameValue.trim() || renameValue.trim() === folder.name) return
      onRenameFolder(folder, renameValue.trim())
    } else if (deviceAction === 'delete-empty') {
      onDeleteAllEmpty()
    } else {
      // leave-alone, skip
      onExecute(deviceAction, folder.name)
    }
  }

  const deviceExecuteLabel = () => {
    if (executing) return '⏳ Working…'
    if (whatIf) {
      if (deviceAction === 'rename') return '▶ Simulate Rename'
      if (deviceAction === 'delete-empty') return '▶ Simulate Delete Empty'
      return '▶ Simulate'
    }
    if (deviceAction === 'rename') return '✏ Rename on Device'
    if (deviceAction === 'delete-empty') return `🗑 Delete ${emptyFolderCount} Empty Folder${emptyFolderCount !== 1 ? 's' : ''}`
    if (deviceAction === 'leave-alone') return '🔒 Mark Leave Alone'
    if (deviceAction === 'skip') return '⏭ Mark Skip'
    return '▶ Execute'
  }

  const deviceExecuteDisabled = () => {
    if (executing) return true
    if (deviceAction === 'rename') return !renameValue.trim() || renameValue.trim() === folder.name
    if (deviceAction === 'delete-empty') return emptyFolderCount === 0
    return false
  }

  return (
    <div className="action-panel">
      {/* Tab bar */}
      <div className="ap-tabs">
        <button className={`ap-tab ${activeTab === 'device' ? 'active' : ''}`} onClick={() => setActiveTab('device')}>📱 Device</button>
        <button className={`ap-tab ${activeTab === 'pc' ? 'active' : ''}`} onClick={() => setActiveTab('pc')}>💻 PC</button>
      </div>

      {whatIf && <div className="whatif-banner">⚠ WhatIf Mode — actions logged, no files changed</div>}

      {/* ── DEVICE TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'device' && (
        <div className="ap-tab-body">
          <div className="ap-section">
            <div className="ap-section-label">📱 Device Actions</div>
            <div className="ap-actions">

              {/* Rename */}
              <div
                className={`ap-action ${deviceAction === 'rename' ? 'selected' : ''}`}
                onClick={() => setDeviceAction('rename')}
              >
                <div className="ap-action-label">✏ Rename Folder</div>
                <div className="ap-action-desc">Rename on device to date + title pattern</div>
                {deviceAction === 'rename' && (
                  <div className="ap-inline-input" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      placeholder="YYYY-MM-DD Title"
                      autoFocus
                    />
                    <small>Auto-filled from file dates — edit if needed</small>
                  </div>
                )}
              </div>

              {/* Delete All Empty */}
              <div
                className={`ap-action ${deviceAction === 'delete-empty' ? 'selected' : ''}${emptyFolderCount === 0 ? ' disabled' : ''}`}
                onClick={() => emptyFolderCount > 0 && setDeviceAction('delete-empty')}
              >
                <div className="ap-action-label">🗑 Delete All Empty Folders</div>
                <div className="ap-action-desc">
                  {emptyFolderCount > 0
                    ? `Remove ${emptyFolderCount} empty folder${emptyFolderCount !== 1 ? 's' : ''} from device`
                    : 'No empty folders detected'}
                </div>
              </div>

              {/* Leave Alone */}
              <div
                className={`ap-action ${deviceAction === 'leave-alone' ? 'selected' : ''}`}
                onClick={() => setDeviceAction('leave-alone')}
              >
                <div className="ap-action-label">🔒 Leave Alone</div>
                <div className="ap-action-desc">Mark as protected — never touched by this tool</div>
              </div>

              {/* Skip */}
              <div
                className={`ap-action ${deviceAction === 'skip' ? 'selected' : ''}`}
                onClick={() => setDeviceAction('skip')}
              >
                <div className="ap-action-label">⏭ Skip</div>
                <div className="ap-action-desc">Come back to this folder later</div>
              </div>
            </div>
          </div>

          <button
            className={`btn-primary btn-execute ${whatIf ? 'btn-whatif-exec' : ''} ${deviceAction === 'delete-empty' ? 'btn-execute-danger' : ''}`}
            onClick={handleDeviceExecute}
            disabled={deviceExecuteDisabled()}
          >
            {deviceExecuteLabel()}
          </button>
        </div>
      )}

      {/* ── PC TAB ────────────────────────────────────────────────────────── */}
      {activeTab === 'pc' && (
        <div className="ap-tab-body">
          <div className="ap-section">
            <div className="ap-section-label">📂 Destination Folder Name</div>
            <div className="ap-folder-name">
              <input
                type="text"
                value={suggestedName}
                onChange={(e) => onSuggestedNameChange(e.target.value)}
                placeholder="YYYY-MM-DD Title"
              />
              <small>Auto-generated from file dates. Edit if needed.</small>
            </div>
          </div>

          <div className="ap-section">
            <div className="ap-section-label">💾 PC Actions</div>
            <div className="ap-actions">
              <div
                className={`ap-action ${pcAction === 'copy-to-pc' ? 'selected' : ''}`}
                onClick={() => setPcAction('copy-to-pc')}
              >
                <div className="ap-action-label">📦 Copy to PC Only</div>
                <div className="ap-action-desc">Archive to local drive. Keep on device and in Google Photos.</div>
              </div>
              <div
                className={`ap-action ${pcAction === 'move-to-pc' ? 'selected' : ''} ${!gpReady ? 'disabled' : ''}`}
                onClick={() => gpReady && setPcAction('move-to-pc')}
              >
                <div className="ap-action-label">💾 Move to PC + Delete Cloud</div>
                <div className="ap-action-desc">
                  {gpReady
                    ? 'Copy to PC, verify, then open Google Photos in browser to delete manually.'
                    : 'Requires Google Photos connection (Settings → Connect).'}
                </div>
                {!gpReady && <span className="badge-stub">Needs GP</span>}
              </div>
            </div>
          </div>

          {progress && (
            <div className="ap-progress">
              <div className="ap-progress-bar">
                <div className="ap-progress-fill" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
              <div className="ap-progress-text">{progress.done}/{progress.total} — {progress.current}</div>
            </div>
          )}

          <button
            className={`btn-primary btn-execute ${whatIf ? 'btn-whatif-exec' : ''}`}
            onClick={handlePcExecute}
            disabled={executing}
          >
            {executing ? '⏳ Working…' : whatIf ? '▶ Simulate (WhatIf)' : '▶ Execute'}
          </button>
        </div>
      )}
    </div>
  )
}
