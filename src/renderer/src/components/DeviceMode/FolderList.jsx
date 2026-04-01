const STATUS_ICONS = { pending: '⬜', done: '✅', skipped: '⏭', locked: '🔒' }
const STATUS_LABELS = { pending: 'Pending', done: 'Done', skipped: 'Skipped', locked: 'Leave Alone' }

export default function FolderList({ folders, loading, selectedFolder, onSelect }) {
  if (loading) return <div className="folder-list loading">Scanning device folders...</div>

  return (
    <div className="folder-list">
      <div className="fl-header">
        <span>Folders ({folders.length})</span>
        <div className="fl-legend">
          <span>⬜ Pending</span><span>✅ Done</span><span>⏭ Skip</span><span>🔒 Lock</span>
        </div>
      </div>
      <div className="fl-items">
        {folders.map((folder) => (
          <div
            key={folder.path}
            className={`fl-item ${selectedFolder?.path === folder.path ? 'selected' : ''} ${folder.locked ? 'locked' : ''} status-${folder.status}`}
            onClick={() => onSelect(folder)}
          >
            <div className="fl-item-top">
              <span className="fl-status">{STATUS_ICONS[folder.status] || '⬜'}</span>
              <span className="fl-name">{folder.name}</span>
              {folder.hasVideo && <span className="fl-badge video">📹</span>}
              {folder.locked && <span className="fl-badge locked-badge">🔒</span>}
            </div>
            <div className="fl-item-meta">
              <span>{folder.fileCount} files</span>
              <span>{folder.totalSizeMb} MB</span>
              {folder.dateMin && <span>{folder.dateMin}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
