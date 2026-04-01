import { useState, useEffect } from 'react'
import SetupScreen from './components/SetupScreen'
import DeviceMode from './components/DeviceMode/DeviceMode'
import SpaceTracker from './components/SpaceTracker'
import ExecutionLog from './components/ExecutionLog'
import SettingsModal from './components/SettingsModal'

export default function App() {
  const [screen, setScreen] = useState('loading') // 'loading' | 'setup' | 'device'
  const [settings, setSettings] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [whatIf, setWhatIf] = useState(false)
  const [spaceData, setSpaceData] = useState({ startingGb: 25.55, currentGb: 25.55, goalGb: 15 })
  const [logEntries, setLogEntries] = useState([])

  // On launch: load settings, decide which screen to show
  useEffect(() => {
    async function init() {
      const result = await window.api.settings.load()
      if (result.success) {
        const s = result.settings
        setSettings(s)
        setWhatIf(s.whatIfMode || false)
        setSpaceData({ startingGb: s.startingGb, currentGb: s.startingGb, goalGb: s.goalGb })
        // If already configured, skip setup and go straight to device mode
        if (s.configured) {
          await window.api.db.init(s.localPicturesRoot)
          setScreen('device')
        } else {
          setScreen('setup')
        }
      } else {
        setScreen('setup')
      }
    }
    init()
  }, [])

  const addLog = (entry) => {
    const ts = new Date().toLocaleTimeString()
    setLogEntries((prev) => [...prev.slice(-299), { ...entry, ts }])
  }

  const onSpaceFreed = (freedMb) => {
    if (whatIf) return // Don't update in WhatIf mode
    setSpaceData((prev) => ({
      ...prev,
      currentGb: Math.max(0, prev.currentGb - freedMb / 1024)
    }))
  }

  const handleSettingsSave = async (newSettings) => {
    await window.api.settings.save(newSettings)
    setSettings(newSettings)
    setWhatIf(newSettings.whatIfMode || false)
    setSpaceData({ startingGb: newSettings.startingGb, currentGb: newSettings.startingGb, goalGb: newSettings.goalGb })
    setShowSettings(false)
    addLog({ action: 'SETTINGS', result: 'Settings saved' })
  }

  const handleConnect = async (newSettings) => {
    await window.api.settings.save(newSettings)
    setSettings(newSettings)
    await window.api.db.init(newSettings.localPicturesRoot)
    setScreen('device')
  }

  const toggleWhatIf = async () => {
    const newVal = !whatIf
    setWhatIf(newVal)
    const updated = { ...settings, whatIfMode: newVal }
    setSettings(updated)
    await window.api.settings.save(updated)
    addLog({ action: 'WHATIF', result: newVal ? '⚠ WhatIf Mode ON — no files will be changed' : 'WhatIf Mode OFF — live mode active' })
  }

  if (screen === 'loading') {
    return <div className="app-loading">Loading...</div>
  }

  return (
    <div className="app">
      <SpaceTracker
        {...spaceData}
        whatIf={whatIf}
        onToggleWhatIf={toggleWhatIf}
        onOpenSettings={() => setShowSettings(true)}
      />
      <div className="app-body">
        {screen === 'setup' ? (
          <SetupScreen
            settings={settings}
            onSettingsChange={setSettings}
            onConnect={handleConnect}
            addLog={addLog}
          />
        ) : (
          <DeviceMode
            settings={settings}
            whatIf={whatIf}
            onSpaceFreed={onSpaceFreed}
            addLog={addLog}
            onBack={() => setScreen('setup')}
          />
        )}
      </div>
      <ExecutionLog entries={logEntries} />
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSettingsSave}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
