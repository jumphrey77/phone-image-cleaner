export default function SpaceTracker({ startingGb, currentGb, goalGb }) {
  const freedGb = Math.max(0, startingGb - currentGb).toFixed(2)
  const remainingGb = Math.max(0, currentGb - goalGb).toFixed(2)
  const progressPct = Math.min(100, ((startingGb - currentGb) / (startingGb - goalGb)) * 100)

  return (
    <div className="space-tracker">
      <div className="st-item">
        <span className="st-label">Cloud Storage</span>
        <span className="st-value">{currentGb.toFixed(2)} GB</span>
      </div>
      <div className="st-divider" />
      <div className="st-item">
        <span className="st-label">Freed</span>
        <span className="st-value freed">{freedGb} GB</span>
      </div>
      <div className="st-divider" />
      <div className="st-item">
        <span className="st-label">To Goal ({goalGb} GB)</span>
        <span className="st-value remaining">{remainingGb} GB left</span>
      </div>
      <div className="st-progress-wrap">
        <div className="st-progress-bar">
          <div className="st-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="st-pct">{Math.round(progressPct)}%</span>
      </div>
    </div>
  )
}
