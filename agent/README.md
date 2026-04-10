# ThreatTron Agent Packaging

This folder contains the ThreatTron Windows agent source plus packaging helpers.

## Build the downloadable agent executable

1. Open PowerShell or CMD as Administrator.
2. Navigate to `d:\Personal_Projects\ThreatTron_ITD\agent`.
3. Run `build_agent.bat`.

This will:
- install build dependencies from `requirements.txt`
- run PyInstaller
- produce `dist\ThreatTronAgent.exe`

## Result

The packaged agent executable is located at:

- `agent\dist\ThreatTronAgent.exe`

This is the single self-contained downloadable file.

## Install as a Windows service

Run `install_service.bat` as Administrator after the build completes.

It will:
- install the `ThreatTronAgent` Windows service
- start the service

## Uninstall the service

Run `uninstall_service.bat` as Administrator.

## Environment variables

The packaged agent reads these variables at runtime:

- `THREATTRON_BACKEND_URL` — backend URL for event delivery
- `THREATTRON_EMAIL_ENABLED` — `true` or `false`

If these are not set, the default backend URL is:

- `https://threattron-api.onrender.com/events/batch`
