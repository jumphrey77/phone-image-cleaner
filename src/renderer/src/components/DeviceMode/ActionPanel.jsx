import { useState } from 'react'

const ACTIONS = [
  { id: 'copy-to-pc', label: '📦 Copy to PC Only', desc: 'Copy to local archive. Keep on device and cloud.' },
  { id: 'move-to-pc', label: '💾 Move to PC + Delete Cloud', desc: 'Copy to PC, then delete from Google Photos. (Cloud delete: Phase 2)', disabled: true },
  { id: 'leave-alone', label: '🔒 Leave Alone', desc: 'Mark as protected. Will never be touched.' },
  { id: 'skip', label: '⏭ Skip', desc: 'Come back to this folder later.' }
]

export default function ActionPanel({ folder, suggestedName, onSuggestedNameChange, onExecute, executing, progress }) {
  const [selectedAction, setSelectedAction] = useState('copy-to-pc')

  if (!folder) {
    return (
      <div className="action-panel empty">
        <div className="ap-empty">Select a folder to see actions</div>
      </div>
    )
  }

  if (folder.locked) {
    return (
      <div className="action-panel">
        <div className="ap-locked">
          <span>🔒</span>
          <p>This folder is protected and cannot be modified.</p>
        </div>
      </div>
    )
  }

  const handleExecute = () => {
    if (executing) return
    const action = selectedAction
    const dest = suggestedName || folder.name
    onExecute(action, dest)
  }

  return (
    <div className="action-panel">
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
            {action.disabled && <span className="badge-stub">Phase 2</span>}
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
        className="btn-primary btn-execute"
        onClick={handleExecute}
        disabled={executing}
      >
        {executing ? '⏳ Working...' : '▶ Execute'}
      </button>
    </div>
  )
}
