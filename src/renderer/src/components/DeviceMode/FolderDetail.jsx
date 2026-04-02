import { useState } from 'react'

function formatSize(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

const TYPE_ICONS = { photo: '📷', video: '📹', other: '📄' }

// Detect source app from filename prefix or folder name
function getSourceBadge(filename, folderName) {
  const up = filename.toUpperCase()
  const folder = (folderName || '').toUpperCase()

  if (up.startsWith('FB_IMG_') || up.startsWith('FB_VID_'))
    return { label: 'FB', title: 'Facebook', color: '#1877f2' }
  if (up.startsWith('SCREENSHOT_') || up.startsWith('SCR_') || up.startsWith('SCREEN_'))
    return { label: 'SCR', title: 'Screenshot', color: '#6b7280' }
  if (folder.includes('WHATSAPP') || up.startsWith('WA') || /^IMG-\d{8}-WA/.test(up))
    return { label: 'WA', title: 'WhatsApp', color: '#25d366' }
  if (up.startsWith('PANO_'))
    return { label: 'PANO', title: 'Panorama', color: '#8b5cf6' }
  if (up.startsWith('BURST') || up.startsWith('BURST_'))
    return { label: 'BURST', title: 'Burst shot', color: '#f59e0b' }
  if (up.startsWith('SNAPSEED') || folder.includes('SNAPSEED'))
    return { label: 'SNAP', title: 'Snapseed edit', color: '#06b6d4' }
  return null
}

function isTrashed(filename) {
  return filename.startsWith('.trashed') || filename.startsWith('.Trashed')
}

function CloudCell({ value, gpReady }) {
  if (!gpReady) return <span className="cloud-na">—</span>
  if (value === true) return <span className="cloud-yes">✅</span>
  if (value === false) return <span className="cloud-no">❌</span>
  return <span className="cloud-na">—</span>
}

export default function FolderDetail({ folder, files, loading, gpReady }) {
  const [showTrashed, setShowTrashed] = useState(false)

  if (!folder) {
    return (
      <div className="folder-detail empty">
        <div className="fd-empty-msg">← Select a folder to view its contents</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="folder-detail loading">
        <div className="fd-loading">Loading files from {folder.name}…</div>
      </div>
    )
  }

  const trashedFiles = files.filter((f) => isTrashed(f.name))
  const visibleFiles = showTrashed ? files : files.filter((f) => !isTrashed(f.name))

  const totalSize = visibleFiles.reduce((sum, f) => sum + f.size, 0)
  const cloudCount = visibleFiles.filter((f) => f.onCloud === true).length

  return (
    <div className="folder-detail">
      <div className="fd-header">
        <div className="fd-header-row">
          <h3>{folder.name}</h3>
          {trashedFiles.length > 0 && (
            <button
              className={`fd-trashed-btn ${showTrashed ? 'active' : ''}`}
              onClick={() => setShowTrashed((v) => !v)}
              title={showTrashed ? 'Hide trashed files' : 'Show trashed files'}
            >
              🗑 {trashedFiles.length} trashed {showTrashed ? '▲' : '▼'}
            </button>
          )}
        </div>
        <div className="fd-summary">
          <span>{visibleFiles.length} files</span>
          <span>{formatSize(totalSize)}</span>
          {folder.dateMin && <span>{folder.dateMin} → {folder.dateMax}</span>}
          {gpReady && files.length > 0 && (
            <span className={cloudCount === visibleFiles.length ? 'cloud-badge-all' : 'cloud-badge-partial'}>
              ☁ {cloudCount}/{visibleFiles.length} in Google Photos
            </span>
          )}
        </div>
      </div>

      <div className="fd-table-wrap">
        <table className="fd-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Filename</th>
              <th>Size</th>
              <th>Date</th>
              <th>Time</th>
              <th title={gpReady ? 'In Google Photos' : 'Connect Google Photos in Settings'}>Cloud</th>
              <th>PC</th>
            </tr>
          </thead>
          <tbody>
            {visibleFiles.map((file) => {
              const badge = getSourceBadge(file.name, folder.name)
              const trashed = isTrashed(file.name)
              return (
                <tr key={file.name} className={`type-${file.type}${trashed ? ' trashed-row' : ''}`}>
                  <td>{TYPE_ICONS[file.type] || '📄'}</td>
                  <td className="fd-filename">
                    {trashed && <span className="badge-trashed" title="Android trash file">🗑</span>}
                    {badge && (
                      <span
                        className="badge-source"
                        style={{ background: badge.color }}
                        title={badge.title}
                      >
                        {badge.label}
                      </span>
                    )}
                    <span title={file.name}>{file.name}</span>
                  </td>
                  <td>{formatSize(file.size)}</td>
                  <td>{file.date}</td>
                  <td>{file.time}</td>
                  <td><CloudCell value={file.onCloud} gpReady={gpReady} /></td>
                  <td>{file.onPc === null ? '—' : file.onPc ? '✅' : '❌'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
