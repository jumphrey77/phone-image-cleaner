import { useState } from 'react'

export default function SettingsModal({ settings, onSave, onClose }) {
  const [form, setForm] = useState({ ...settings })
  const [gpStatus, setGpStatus] = useState('')
  const [gpConnecting, setGpConnecting] = useState(false)

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }))

  const browseFile = async (key) => {
    const chosen = await window.api.dialog.openFile()
    if (chosen) set(key, chosen)
  }

  const browseFolder = async (key) => {
    const chosen = await window.api.dialog.openFolder()
    if (chosen) set(key, chosen)
  }

  const connectGooglePhotos = async () => {
    if (!form.gpClientId || !form.gpClientSecret) {
      setGpStatus('⚠ Enter Client ID and Client Secret first.')
      return
    }
    setGpConnecting(true)
    setGpStatus('Opening browser for Google sign-in…')
    try {
      const result = await window.api.gp.startOAuth(form.gpClientId, form.gpClientSecret)
      if (result.success) {
        setForm((prev) => ({ ...prev, gpTokens: result.tokens }))
        setGpStatus('✅ Connected to Google Photos!')
      } else {
        setGpStatus(`❌ ${result.error}`)
      }
    } catch (err) {
      setGpStatus(`❌ ${err.message}`)
    }
    setGpConnecting(false)
  }

  const disconnectGooglePhotos = () => {
    set('gpTokens', null)
    setGpStatus('Disconnected.')
  }

  const isGpConnected = !!(form.gpTokens && form.gpClientId)

  const handleSave = () => onSave(form)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙ Settings</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* ── Paths ── */}
          <div className="settings-section-label">Paths</div>

          <div className="form-group">
            <label>ADB Path</label>
            <div className="input-browse">
              <input
                type="text"
                value={form.adbPath || ''}
                onChange={(e) => set('adbPath', e.target.value)}
                placeholder="C:\path\to\adb.exe"
              />
              <button className="btn-browse" onClick={() => browseFile('adbPath')}>Browse</button>
            </div>
          </div>

          <div className="form-group">
            <label>Device Path (DCIM root)</label>
            <input
              type="text"
              value={form.devicePath || ''}
              onChange={(e) => set('devicePath', e.target.value)}
              placeholder="/sdcard/DCIM"
            />
            <small>Android path — type directly</small>
          </div>

          <div className="form-group">
            <label>Local Pictures Root</label>
            <div className="input-browse">
              <input
                type="text"
                value={form.localPicturesRoot || ''}
                onChange={(e) => set('localPicturesRoot', e.target.value)}
                placeholder="D:\Pictures"
              />
              <button className="btn-browse" onClick={() => browseFolder('localPicturesRoot')}>Browse</button>
            </div>
          </div>

          <div className="form-group">
            <label>Folder Naming Pattern</label>
            <input
              type="text"
              value={form.folderPattern || ''}
              onChange={(e) => set('folderPattern', e.target.value)}
              placeholder="YYYY-MM-DD Title"
            />
            <small>Auto-generates destination folder names from file dates.</small>
          </div>

          <div className="form-row">
            <div className="form-group half">
              <label>Starting Storage (GB)</label>
              <input
                type="number"
                step="0.01"
                value={form.startingGb || ''}
                onChange={(e) => set('startingGb', parseFloat(e.target.value))}
              />
            </div>
            <div className="form-group half">
              <label>Goal (GB)</label>
              <input
                type="number"
                step="0.01"
                value={form.goalGb || ''}
                onChange={(e) => set('goalGb', parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="form-group form-check">
            <label>
              <input
                type="checkbox"
                checked={form.whatIfMode || false}
                onChange={(e) => set('whatIfMode', e.target.checked)}
              />
              <span>WhatIf Mode (simulate — no files changed)</span>
            </label>
          </div>

          {/* ── Google Photos ── */}
          {/* ── Protection ── */}
          <div className="settings-section-label" style={{ marginTop: 16 }}>Folder Protection</div>

          <div className="form-group">
            <label>Protected Keywords</label>
            <input
              type="text"
              value={form.lockedKeywords || ''}
              onChange={(e) => set('lockedKeywords', e.target.value)}
              placeholder="kora, family, baby"
            />
            <small>Comma-separated. Any folder or file path containing these words (case-insensitive) will be locked and skipped. Applies on next Refresh.</small>
          </div>

          {/* ── Google Photos ── */}
          <div className="settings-section-label" style={{ marginTop: 16 }}>Google Photos</div>

          <div className="gp-setup-note">
            <p>Requires a Google Cloud project with the <strong>Photos Library API</strong> enabled.</p>
            <p>Set the OAuth redirect URI to: <code>http://localhost:8765/oauth2callback</code></p>
          </div>

          <div className="form-group">
            <label>Client ID</label>
            <input
              type="text"
              value={form.gpClientId || ''}
              onChange={(e) => set('gpClientId', e.target.value)}
              placeholder="xxxx.apps.googleusercontent.com"
            />
          </div>

          <div className="form-group">
            <label>Client Secret</label>
            <input
              type="password"
              value={form.gpClientSecret || ''}
              onChange={(e) => set('gpClientSecret', e.target.value)}
              placeholder="GOCSPX-…"
            />
          </div>

          <div className="gp-connect-row">
            {isGpConnected ? (
              <>
                <span className="gp-connected-badge">✅ Google Photos Connected</span>
                <button className="btn-ghost" onClick={disconnectGooglePhotos}>Disconnect</button>
              </>
            ) : (
              <button
                className="btn-primary"
                onClick={connectGooglePhotos}
                disabled={gpConnecting}
              >
                {gpConnecting ? '⏳ Waiting for sign-in…' : '☁ Connect Google Photos'}
              </button>
            )}
          </div>
          {gpStatus && <div className="gp-status-msg">{gpStatus}</div>}

          <div className="form-group" style={{ marginTop: 12 }}>
            <label>After Picker — Done Action</label>
            <select
              value={form.gpPickerDoneAction || 'close'}
              onChange={(e) => set('gpPickerDoneAction', e.target.value)}
              className="form-select"
            >
              <option value="close">Close picker tab only</option>
              <option value="open-day">Open Google Photos — Day view for selected date</option>
              <option value="open-month">Open Google Photos — Month view for selected date</option>
            </select>
            <small>What the app opens in your browser after you finish picking photos.</small>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  )
}
