import { useState } from 'react'

export default function SettingsModal({ settings, onSave, onClose }) {
  const [form, setForm] = useState({ ...settings })

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }))

  const handleSave = () => {
    onSave(form)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙ Settings</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>ADB Path</label>
            <input
              type="text"
              value={form.adbPath || ''}
              onChange={(e) => set('adbPath', e.target.value)}
              placeholder="C:\path\to\adb.exe"
            />
          </div>

          <div className="form-group">
            <label>Device Path (DCIM root)</label>
            <input
              type="text"
              value={form.devicePath || ''}
              onChange={(e) => set('devicePath', e.target.value)}
              placeholder="/sdcard/DCIM"
            />
          </div>

          <div className="form-group">
            <label>Local Pictures Root</label>
            <input
              type="text"
              value={form.localPicturesRoot || ''}
              onChange={(e) => set('localPicturesRoot', e.target.value)}
              placeholder="D:\Pictures"
            />
          </div>

          <div className="form-group">
            <label>Folder Naming Pattern</label>
            <input
              type="text"
              value={form.folderPattern || ''}
              onChange={(e) => set('folderPattern', e.target.value)}
              placeholder="YYYY-MM-DD Title"
            />
            <small>Used to auto-generate destination folder names from file dates.</small>
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
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  )
}
