import { useState, useEffect } from 'react'
import SetupScreen from './components/SetupScreen'
import DeviceMode from './components/DeviceMode/DeviceMode'
import SpaceTracker from './components/SpaceTracker'
import ExecutionLog from './components/ExecutionLog'

const DEFAULT_SETTINGS = {
  adbPath: 'D:\\Apps\\Android Platform Tools\\platform-tools\\adb.exe',
  localPicturesRoot: 'D:\\OneDrive\\OneDrive - Certified Training Services\\Pictures',
  folderPattern: 'YYYY-MM-DD Title',
  devicePath: '/sdcard/DCIM',
  goalGb: 15,
  startingGb: 25.55
}

export default function App() {
  const [screen, setScreen] = useState('setup') // 'setup' | 'device'
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [connected, setConnected] = useState(false)
  const [spaceData, setSpaceData] = useState({ startingGb: 25.55, currentGb: 25.55, goalGb: 15 })
  const [logEntries, setLogEntries] = useState([])

  const addLog = (entry) => {
    const ts = new Date().toLocaleTimeString()
    setLogEntries((prev) => [...prev.slice(-199), { ...entry, ts }])
  }

  const onSpaceFreed = (freedMb) => {
    setSpaceData((prev) => ({
      ...prev,
      currentGb: Math.max(0, prev.currentGb - freedMb / 1024)
    }))
  }

  return (
    <div className="app">
      <SpaceTracker {...spaceData} />
      <div className="app-body">
        {screen === 'setup' ? (
          <SetupScreen
            settings={settings}
            onSettingsChange={setSettings}
            onConnect={() => { setConnected(true); setScreen('device') }}
            addLog={addLog}
          />
        ) : (
          <DeviceMode
            settings={settings}
            onSpaceFreed={onSpaceFreed}
            addLog={addLog}
            onBack={() => setScreen('setup')}
          />
        )}
      </div>
      <ExecutionLog entries={logEntries} />
    </div>
  )
}
