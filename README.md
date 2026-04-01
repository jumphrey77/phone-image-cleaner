# Photo Cleanup Manager

Electron app for cleaning up Google Photos and Android device storage.

## Setup

```bash
npm install
npm run dev
```

## Requirements
- Node.js 18+
- ADB platform tools: `D:\Apps\Android Platform Tools\platform-tools\adb.exe`
- Samsung S24 Ultra with USB Debugging enabled

## Phase 1 Features
- Device Mode: browse phone folders, copy to PC
- Space Tracker: live progress toward 15 GB goal
- Execution Log: full audit trail

## Phase 2 (Coming)
- Google Photos API: delete cloud copies
- Duplicate Finder
- Unmatched/Sync Mode

## Folder Convention
`YYYY-MM-DD Title` — e.g. `2024-06-01 Apex Event`
Destination: `D:\OneDrive\OneDrive - Certified Training Services\Pictures\`
