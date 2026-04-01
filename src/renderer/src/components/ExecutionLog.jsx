import { useEffect, useRef } from 'react'

const RESULT_COLORS = { OK: '#4ade80', FAILED: '#f87171', ERROR: '#f87171', 'SIZE MISMATCH': '#fbbf24' }

export default function ExecutionLog({ entries }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  return (
    <div className="execution-log">
      <div className="el-header">Execution Log ({entries.length})</div>
      <div className="el-entries">
        {entries.length === 0 && <div className="el-empty">No actions yet.</div>}
        {entries.map((entry, i) => (
          <div key={i} className="el-entry">
            <span className="el-ts">{entry.ts}</span>
            <span className="el-action">[{entry.action}]</span>
            {entry.folder && <span className="el-folder">{entry.folder}</span>}
            {entry.filename && <span className="el-file">{entry.filename}</span>}
            <span
              className="el-result"
              style={{ color: RESULT_COLORS[entry.result] || '#e5e7eb' }}
            >
              {entry.result}
            </span>
            {entry.error && <span className="el-error">⚠ {entry.error}</span>}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
