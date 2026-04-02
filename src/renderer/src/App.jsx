import { useState, useEffect, useRef } from 'react'
import SetupScreen from './components/SetupScreen'
import DeviceMode from './components/DeviceMode/DeviceMode'
import SpaceTracker from './components/SpaceTracker'
import ExecutionLog from './components/ExecutionLog'
import SettingsModal from './components/SettingsModal'

export default function App() {
  const [screen, setScreen] = useState('loading')
  const [settings, setSettings] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [whatIf, setWhatIf] = useState(false)
  const [spaceData, setSpaceData] = useState({ startingGb: 25.55, currentGb: 25.55, goalGb: 15 })
  const [logEntries, setLogEntries] = useState([])
  const [adbStatus, setAdbStatus] = useState('unknown') // 'unknown' | 'connected' | 'disconnected'
  const [adbSerial, setAdbSerial] = useState('')
  const [gpConnected, setGpConnected] = useState(false)
  const [logHeight, setLogHeight] = useState(120)
  const adbPollRef = useRef(null)

  // On launch: load settings, decide screen
  useEffect(() => {
    async function init() {
      try {
        const result = await window.api.settings.load()
        if (result.success) {
          const s = result.settings
          setSettings(s)
          setWhatIf(s.whatIfMode || false)
          setSpaceData({ startingGb: s.startingGb, currentGb: s.startingGb, goalGb: s.goalGb })
          setGpConnected(!!(s.gpTokens && s.gpClientId))
          if (s.configured) {
            await window.api.db.init(s.localPicturesRoot)
            setScreen('device')
          } else {
            setScreen('setup')
          }
        } else {
          setScreen('setup')
        }
      } catch {
        setScreen('setup')
      }
    }
    init()
  }, [])

  // ADB status polling — every 30 seconds
  useEffect(() => {
    const poll = async () => {
      if (!settings?.adbPath) return
      const result = await window.api.adb.checkConnection(settings.adbPath)
      if (result.success && result.devices.length > 0) {
        setAdbStatus('connected')
        setAdbSerial(result.devices[0].serial)
      } else {
        setAdbStatus('disconnected')
        setAdbSerial('')
      }
    }

    if (screen !== 'loading' && settings?.adbPath) {
      poll() // Immediate check
      adbPollRef.current = setInterval(poll, 30000)
    }
    return () => clearInterval(adbPollRef.current)
  }, [screen, settings?.adbPath])

  const addLog = (entry) => {
    const ts = new Date().toLocaleTimeString()
    setLogEntries((prev) => [...prev.slice(-299), { ...entry, ts }])
  }

  const onSpaceFreed = (freedMb) => {
    if (whatIf) return
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
    setGpConnected(!!(newSettings.gpTokens && newSettings.gpClientId))
    setShowSettings(false)
    addLog({ action: 'SETTINGS', result: 'Settings saved' })
  }

  const handleConnect = async (newSettings) => {
    const saved = { ...newSettings, configured: true }
    await window.api.settings.save(saved)
    setSettings(saved)
    setGpConnected(!!(saved.gpTokens && saved.gpClientId))
    await window.api.db.init(newSettings.localPicturesRoot)
    setScreen('device')
  }

  const toggleWhatIf = async () => {
    const newVal = !whatIf
    setWhatIf(newVal)
    const updated = { ...settings, whatIfMode: newVal }
    setSettings(updated)
    await window.api.settings.save(updated)
    addLog({ action: 'WHATIF', result: newVal ? '⚠ WhatIf Mode ON' : 'WhatIf Mode OFF — live mode active' })
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
        adbStatus={adbStatus}
        adbSerial={adbSerial}
        gpConnected={gpConnected}
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
            onSettingsUpdate={(updated) => {
              setSettings(updated)
              setGpConnected(!!(updated.gpTokens && updated.gpClientId))
            }}
          />
        )}
      </div>
      <ExecutionLog entries={logEntries} logHeight={logHeight} onHeightChange={setLogHeight} />
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
