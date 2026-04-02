import { useState } from 'react'

const STATUS_ICONS = { pending: '⬜', done: '✅', skipped: '⏭', locked: '🔒' }
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function monthLabel(ym) {
  if (!ym || ym === 'unknown') return '📁 Unknown Date'
  const [y, m] = ym.split('-')
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`
}

function FolderItem({ folder, selected, onSelect, onDeleteFolder }) {
  const isEmpty = folder.fileCount === 0
  return (
    <div
      className={`fl-item ${selected ? 'selected' : ''} ${folder.locked ? 'locked' : ''} ${isEmpty ? 'empty-folder' : ''} status-${folder.status}`}
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
            onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder) }}
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
}

export default function FolderList({ folders, loading, selectedFolder, onSelect, onDeleteFolder }) {
  const [sortBy, setSortBy]     = useState('size')    // 'size' | 'date' | 'name'
  const [sortDir, setSortDir]   = useState('desc')    // 'asc' | 'desc'
  const [groupBy, setGroupBy]   = useState('folder')  // 'folder' | 'month'
  const [showAll, setShowAll]   = useState(true)
  const [collapsed, setCollapsed] = useState({})       // { 'YYYY-MM': true/false }

  if (loading) return <div className="folder-list loading">Scanning device folders...</div>

  const toggleSort = (key) => {
    if (sortBy === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortBy(key); setSortDir('desc') }
  }

  const toggleCollapse = (ym) =>
    setCollapsed((prev) => ({ ...prev, [ym]: !prev[ym] }))

  const arrow = (key) => sortBy !== key ? '' : sortDir === 'desc' ? ' ▼' : ' ▲'

  const filtered = folders.filter((f) => showAll || f.status === 'pending')

  const sortFolders = (list) =>
    [...list].sort((a, b) => {
      if (a.locked && !b.locked) return 1
      if (!a.locked && b.locked) return -1
      let cmp = 0
      if (sortBy === 'size') cmp = (b.totalSizeMb || 0) - (a.totalSizeMb || 0)
      else if (sortBy === 'date') cmp = (a.dateMin || '').localeCompare(b.dateMin || '')
      else if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
      return sortDir === 'desc' ? cmp : -cmp
    })

  // ── Month grouping ─────────────────────────────────────────────────────────
  const renderMonthView = () => {
    const byMonth = {}
    filtered.forEach((f) => {
      const ym = f.dateMin ? f.dateMin.substring(0, 7) : 'unknown'
      if (!byMonth[ym]) byMonth[ym] = []
      byMonth[ym].push(f)
    })

    const groups = Object.entries(byMonth).sort(([a], [b]) => {
      const cmp = a.localeCompare(b)
      return sortDir === 'desc' ? -cmp : cmp
    })

    return groups.map(([ym, monthFolders]) => {
      const sorted = sortFolders(monthFolders)
      const totalMb = monthFolders.reduce((s, f) => s + (f.totalSizeMb || 0), 0)
      const isCollapsed = !!collapsed[ym]
      return (
        <div key={ym} className="fl-month-group">
          <div className="fl-month-header" onClick={() => toggleCollapse(ym)}>
            <span className="fl-month-arrow">{isCollapsed ? '▶' : '▼'}</span>
            <span className="fl-month-label">{monthLabel(ym)}</span>
            <span className="fl-month-meta">{monthFolders.length} folders · {totalMb.toFixed(0)} MB</span>
          </div>
          {!isCollapsed && sorted.map((folder) => (
            <FolderItem
              key={folder.path}
              folder={folder}
              selected={selectedFolder?.path === folder.path}
              onSelect={onSelect}
              onDeleteFolder={onDeleteFolder}
            />
          ))}
        </div>
      )
    })
  }

  // ── Folder (flat) view ─────────────────────────────────────────────────────
  const renderFolderView = () => {
    const sorted = sortFolders(filtered)
    if (sorted.length === 0) {
      return <div className="fl-empty">
        {folders.length === 0 ? 'No data — connect phone and click Refresh' : 'No pending folders'}
      </div>
    }
    return sorted.map((folder) => (
      <FolderItem
        key={folder.path}
        folder={folder}
        selected={selectedFolder?.path === folder.path}
        onSelect={onSelect}
        onDeleteFolder={onDeleteFolder}
      />
    ))
  }

  return (
    <div className="folder-list">
      <div className="fl-header">
        <div className="fl-header-top">
          <div className="fl-group-toggle">
            <button
              className={`fl-sort-btn ${groupBy === 'folder' ? 'active' : ''}`}
              onClick={() => setGroupBy('folder')}
            >📁 Folder</button>
            <button
              className={`fl-sort-btn ${groupBy === 'month' ? 'active' : ''}`}
              onClick={() => setGroupBy('month')}
            >📅 Month</button>
          </div>
          <button
            className={`fl-filter-btn ${!showAll ? 'active' : ''}`}
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? 'All' : 'Pending'}
          </button>
        </div>
        <div className="fl-sort-row">
          <span className="fl-sort-label">{groupBy === 'month' ? 'Sort months:' : 'Sort:'}</span>
          {groupBy === 'folder' && ['size', 'name'].map((key) => (
            <button
              key={key}
              className={`fl-sort-btn ${sortBy === key ? 'active' : ''}`}
              onClick={() => toggleSort(key)}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}{arrow(key)}
            </button>
          ))}
          <button
            className={`fl-sort-btn ${sortBy === 'date' || groupBy === 'month' ? 'active' : ''}`}
            onClick={() => { setSortBy('date'); setSortDir((d) => d === 'desc' ? 'asc' : 'desc') }}
          >
            {groupBy === 'month' ? 'Month' : 'Date'}{(sortBy === 'date' || groupBy === 'month') ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''}
          </button>
        </div>
        <div className="fl-count-row">
          {filtered.length}/{folders.length} folders
        </div>
      </div>

      <div className="fl-items">
        {groupBy === 'month' ? renderMonthView() : renderFolderView()}
      </div>
    </div>
  )
}
