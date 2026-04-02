function formatSize(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

const TYPE_ICONS = { photo: '📷', video: '📹', other: '📄' }

function CloudCell({ value, gpReady, checking }) {
  if (checking) return <span className="cloud-checking">…</span>
  if (!gpReady) return <span className="cloud-na">—</span>
  if (value === true) return <span className="cloud-yes">✅</span>
  if (value === false) return <span className="cloud-no">❌</span>
  return <span className="cloud-na">—</span>
}

export default function FolderDetail({ folder, files, loading, checkingCloud, gpReady }) {
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

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)
  const cloudCount = files.filter((f) => f.onCloud === true).length

  return (
    <div className="folder-detail">
      <div className="fd-header">
        <h3>{folder.name}</h3>
        <div className="fd-summary">
          <span>{files.length} files</span>
          <span>{formatSize(totalSize)}</span>
          {folder.dateMin && <span>{folder.dateMin} → {folder.dateMax}</span>}
          {gpReady && !checkingCloud && files.length > 0 && (
            <span className={cloudCount === files.length ? 'cloud-badge-all' : 'cloud-badge-partial'}>
              ☁ {cloudCount}/{files.length} in Google Photos
            </span>
          )}
          {checkingCloud && <span className="cloud-badge-checking">☁ Checking…</span>}
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
            {files.map((file) => (
              <tr key={file.name} className={`type-${file.type}`}>
                <td>{TYPE_ICONS[file.type] || '📄'}</td>
                <td className="fd-filename">{file.name}</td>
                <td>{formatSize(file.size)}</td>
                <td>{file.date}</td>
                <td>{file.time}</td>
                <td>
                  <CloudCell value={file.onCloud} gpReady={gpReady} checking={checkingCloud} />
                </td>
                <td>{file.onPc === null ? '—' : file.onPc ? '✅' : '❌'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
