import { useState } from 'react'

export default function SetupScreen({ settings, onSettingsChange, onConnect, addLog }) {
  const [status, setStatus] = useState('')
  const [connecting, setConnecting] = useState(false)

  const update = (key, value) => onSettingsChange((prev) => ({ ...prev, [key]: value }))

  const handleConnect = async () => {
    setConnecting(true)
    setStatus('Checking ADB connection...')
    try {
      const result = await window.api.adb.checkConnection(settings.adbPath)
      if (result.success && result.devices.length > 0) {
        const device = result.devices[0]
        setStatus(`✅ Connected: ${device.serial}`)
        addLog({ action: 'CONNECT', result: `Device ${device.serial} connected` })
        await window.api.db.init(settings.localPicturesRoot)
        setTimeout(() => onConnect(), 800)
      } else {
        setStatus('❌ No device found. Check USB Debugging is enabled and cable is connected.')
        addLog({ action: 'CONNECT', result: 'Failed — no device', error: result.error })
      }
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`)
    }
    setConnecting(false)
  }

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h1>📷 Photo Cleanup Manager</h1>
        <p className="setup-subtitle">Configure your paths and connect your device to get started.</p>

        <div className="form-group">
          <label>ADB Path</label>
          <input
            type="text"
            value={settings.adbPath}
            onChange={(e) => update('adbPath', e.target.value)}
            placeholder="D:\Apps\Android Platform Tools\platform-tools\adb.exe"
          />
        </div>

        <div className="form-group">
          <label>Device DCIM Path</label>
          <input
            type="text"
            value={settings.devicePath}
            onChange={(e) => update('devicePath', e.target.value)}
            placeholder="/sdcard/DCIM"
          />
        </div>

        <div className="form-group">
          <label>Local Pictures Root</label>
          <input
            type="text"
            value={settings.localPicturesRoot}
            onChange={(e) => update('localPicturesRoot', e.target.value)}
            placeholder="D:\OneDrive\...\Pictures"
          />
        </div>

        <div className="form-group">
          <label>Folder Naming Pattern</label>
          <input
            type="text"
            value={settings.folderPattern}
            onChange={(e) => update('folderPattern', e.target.value)}
            placeholder="YYYY-MM-DD Title"
          />
          <small>Example: 2024-06-01 Apex Event</small>
        </div>

        <div className="form-row">
          <div className="form-group half">
            <label>Starting Cloud (GB)</label>
            <input
              type="number"
              value={settings.startingGb}
              onChange={(e) => update('startingGb', parseFloat(e.target.value))}
            />
          </div>
          <div className="form-group half">
            <label>Goal (GB)</label>
            <input
              type="number"
              value={settings.goalGb}
              onChange={(e) => update('goalGb', parseFloat(e.target.value))}
            />
          </div>
        </div>

        <div className="setup-status">{status}</div>

        <button className="btn-primary btn-large" onClick={handleConnect} disabled={connecting}>
          {connecting ? 'Connecting...' : '🔌 Connect Device & Start'}
        </button>

        <div className="gp-note">
          <span>☁️ Google Photos</span>
          <span className="badge-stub">Phase 2</span>
          <small>Cloud deletion will be enabled in the next release.</small>
        </div>
      </div>
    </div>
  )
}
