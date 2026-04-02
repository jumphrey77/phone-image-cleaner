import { useState } from 'react'

export default function ActionPanel({
  folder, suggestedName, onSuggestedNameChange,
  onExecute, executing, progress, whatIf, gpReady
}) {
  const [selectedAction, setSelectedAction] = useState('copy-to-pc')

  const ACTIONS = [
    {
      id: 'copy-to-pc',
      label: '📦 Copy to PC Only',
      desc: 'Copy to local archive. Keep on device and in Google Photos.'
    },
    {
      id: 'move-to-pc',
      label: '💾 Move to PC + Delete Cloud',
      desc: gpReady
        ? 'Copy to PC, verify, then open Google Photos in browser to delete manually.'
        : 'Requires Google Photos connection (Settings → Connect Google Photos).',
      disabled: !gpReady
    },
    {
      id: 'leave-alone',
      label: '🔒 Leave Alone',
      desc: 'Mark as protected. Will never be touched.'
    },
    {
      id: 'skip',
      label: '⏭ Skip',
      desc: 'Come back to this folder later.'
    }
  ]

  if (!folder) {
    return (
      <div className="action-panel empty">
        <div className="ap-empty">Select a folder to see actions</div>
        {whatIf && <div className="whatif-banner">⚠ WhatIf Mode — no files will be changed</div>}
      </div>
    )
  }

  if (folder.locked) {
    return (
      <div className="action-panel">
        {whatIf && <div className="whatif-banner">⚠ WhatIf Mode — no files will be changed</div>}
        <div className="ap-locked">
          <span>🔒</span>
          <p>This folder is protected and cannot be modified.</p>
        </div>
      </div>
    )
  }

  const handleExecute = () => {
    if (executing) return
    onExecute(selectedAction, suggestedName || folder.name)
  }

  return (
    <div className="action-panel">
      {whatIf && (
        <div className="whatif-banner">
          ⚠ WhatIf Mode — actions logged but NO files changed
        </div>
      )}

      <h3>Actions</h3>

      <div className="ap-folder-name">
        <label>Destination Folder Name</label>
        <input
          type="text"
          value={suggestedName}
          onChange={(e) => onSuggestedNameChange(e.target.value)}
          placeholder="YYYY-MM-DD Title"
        />
        <small>Auto-generated from file dates. Edit if needed.</small>
      </div>

      <div className="ap-actions">
        {ACTIONS.map((action) => (
          <div
            key={action.id}
            className={`ap-action ${selectedAction === action.id ? 'selected' : ''} ${action.disabled ? 'disabled' : ''}`}
            onClick={() => !action.disabled && setSelectedAction(action.id)}
          >
            <div className="ap-action-label">{action.label}</div>
            <div className="ap-action-desc">{action.desc}</div>
            {action.id === 'move-to-pc' && !gpReady && (
              <span className="badge-stub">Needs GP</span>
            )}
          </div>
        ))}
      </div>

      {progress && (
        <div className="ap-progress">
          <div className="ap-progress-bar">
            <div
              className="ap-progress-fill"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
          <div className="ap-progress-text">
            {progress.done}/{progress.total} — {progress.current}
          </div>
        </div>
      )}

      <button
        className={`btn-primary btn-execute ${whatIf ? 'btn-whatif-exec' : ''}`}
        onClick={handleExecute}
        disabled={executing}
      >
        {executing ? '⏳ Working…' : whatIf ? '▶ Simulate (WhatIf)' : '▶ Execute'}
      </button>
    </div>
  )
}
