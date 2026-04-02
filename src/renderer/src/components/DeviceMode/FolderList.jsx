import { useState } from 'react'

const STATUS_ICONS = { pending: '⬜', done: '✅', skipped: '⏭', locked: '🔒' }

export default function FolderList({ folders, loading, selectedFolder, onSelect, onDeleteFolder }) {
  const [sortBy, setSortBy] = useState('size')     // 'size' | 'date' | 'name'
  const [sortDir, setSortDir] = useState('desc')   // 'asc' | 'desc'
  const [showAll, setShowAll] = useState(true)      // true = all, false = pending only

  if (loading) return <div className="folder-list loading">Scanning device folders...</div>

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
  }

  const sorted = [...folders]
    .filter((f) => showAll || f.status === 'pending')
    .sort((a, b) => {
      // Locked always sink to bottom
      if (a.locked && !b.locked) return 1
      if (!a.locked && b.locked) return -1

      let cmp = 0
      if (sortBy === 'size') cmp = (b.totalSizeMb || 0) - (a.totalSizeMb || 0)
      else if (sortBy === 'date') cmp = (a.dateMin || '').localeCompare(b.dateMin || '')
      else if (sortBy === 'name') cmp = a.name.localeCompare(b.name)

      return sortDir === 'desc' ? cmp : -cmp
    })

  const arrow = (key) => {
    if (sortBy !== key) return ''
    return sortDir === 'desc' ? ' ▼' : ' ▲'
  }

  return (
    <div className="folder-list">
      <div className="fl-header">
        <div className="fl-header-top">
          <span>Folders ({sorted.length}/{folders.length})</span>
          <button
            className={`fl-filter-btn ${!showAll ? 'active' : ''}`}
            onClick={() => setShowAll((v) => !v)}
            title={showAll ? 'Showing all — click to show pending only' : 'Showing pending — click to show all'}
          >
            {showAll ? 'All' : 'Pending'}
          </button>
        </div>
        <div className="fl-sort-row">
          <span className="fl-sort-label">Sort:</span>
          {['size', 'date', 'name'].map((key) => (
            <button
              key={key}
              className={`fl-sort-btn ${sortBy === key ? 'active' : ''}`}
              onClick={() => toggleSort(key)}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}{arrow(key)}
            </button>
          ))}
        </div>
      </div>
      <div className="fl-items">
        {sorted.length === 0 && (
          <div className="fl-empty">
            {folders.length === 0 ? 'No data — connect phone and click Refresh' : 'No pending folders'}
          </div>
        )}
        {sorted.map((folder) => {
          const isEmpty = folder.fileCount === 0
          return (
            <div
              key={folder.path}
              className={`fl-item ${selectedFolder?.path === folder.path ? 'selected' : ''} ${folder.locked ? 'locked' : ''} ${isEmpty ? 'empty-folder' : ''} status-${folder.status}`}
              onClick={() => !isEmpty && onSelect(folder)}
            >
              <div className="fl-item-top">
                <span className="fl-status">{isEmpty ? '🗂' : (STATUS_ICONS[folder.status] || '⬜')}</span>
                <span className="fl-name">{folder.name}</span>
                {folder.hasVideo && !isEmpty && <span className="fl-badge video">📹</span>}
                {folder.locked && <span className="fl-badge locked-badge">🔒</span>}
                {isEmpty && (
                  <button
                    className="fl-delete-btn"
                    title={`Delete empty folder: ${folder.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteFolder(folder)
                    }}
                  >
                    🗑
                  </button>
                )}
              </div>
              <div className="fl-item-meta">
                <span className={isEmpty ? 'empty-label' : ''}>{isEmpty ? 'Empty' : `${folder.fileCount} files`}</span>
                {!isEmpty && <span>{folder.totalSizeMb} MB</span>}
                {!isEmpty && folder.dateMin && <span>{folder.dateMin}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
