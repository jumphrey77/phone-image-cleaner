import { useEffect, useRef, useCallback } from 'react'

const RESULT_COLORS = { OK: '#4ade80', FAILED: '#f87171', ERROR: '#f87171', 'SIZE MISMATCH': '#fbbf24' }
const MIN_HEIGHT = 60
const MAX_HEIGHT = 500

export default function ExecutionLog({ entries, logHeight, onHeightChange }) {
  const bottomRef = useRef(null)
  const dragRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = logHeight

    const onMove = (ev) => {
      const delta = startY - ev.clientY   // dragging up = bigger
      const newH = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startH + delta))
      onHeightChange(newH)
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [logHeight, onHeightChange])

  return (
    <div className="execution-log" style={{ height: logHeight }}>
      <div className="el-resize-handle" onMouseDown={onMouseDown} title="Drag to resize log" />
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
