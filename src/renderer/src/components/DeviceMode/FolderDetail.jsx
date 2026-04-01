function formatSize(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

const TYPE_ICONS = { photo: '📷', video: '📹', other: '📄' }

export default function FolderDetail({ folder, files, loading }) {
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
        <div className="fd-loading">Loading files from {folder.name}...</div>
      </div>
    )
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)

  return (
    <div className="folder-detail">
      <div className="fd-header">
        <h3>{folder.name}</h3>
        <div className="fd-summary">
          <span>{files.length} files</span>
          <span>{formatSize(totalSize)}</span>
          {folder.dateMin && <span>{folder.dateMin} → {folder.dateMax}</span>}
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
              <th>Cloud</th>
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
                <td>{file.onCloud === null ? '—' : file.onCloud ? '✅' : '❌'}</td>
                <td>{file.onPc ? '✅' : '❌'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
