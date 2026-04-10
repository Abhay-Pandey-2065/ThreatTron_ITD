# ThreatTron Agent Client Installation Guide

This guide explains how to install and run the ThreatTron agent on a clean Windows PC.
It assumes the client machine has no existing Python or ThreatTron software installed.

## What is included

The downloadable package contains:

- `ThreatTronAgent.exe` — a self-contained Windows executable created by PyInstaller
- service install/uninstall batch files (optional)

The executable includes:

- Python runtime
- required Python dependencies
- your agent code
- a Windows service wrapper

## Goal

After installation, the agent should run as a Windows service and send telemetry events to the ThreatTron backend.

---

## 1. Download the package

Provide the client with a single file:

- `ThreatTronAgent.exe`

If you want to include helper scripts, also provide:

- `install_service.bat`
- `uninstall_service.bat`

These can be distributed together in a ZIP archive or via GitHub Releases.

---

## 2. Prepare the client machine

On the client PC:

1. Copy `ThreatTronAgent.exe` to a folder, for example `C:\ThreatTronAgent`.
2. Make sure the user has Administrator rights.

No Python installation is required on the machine.

---

## 3. Set environment variables

The agent reads these environment variables at runtime:

- `THREATTRON_BACKEND_URL`
  - Example: `https://threattron-api.onrender.com/events/batch`
- `THREATTRON_EMAIL_ENABLED`
  - `true` or `false`

### Recommended setup

Set the variables globally in Windows before installing the service.

Example using PowerShell as Administrator:

```powershell
setx THREATTRON_BACKEND_URL "https://threattron-api.onrender.com/events/batch" /M
setx THREATTRON_EMAIL_ENABLED "false" /M
```

After using `setx`, open a new Command Prompt or PowerShell window so the values become available.

If these variables are not set, the agent will use defaults:

- `THREATTRON_BACKEND_URL=https://threattron-api.onrender.com/events/batch`
- `THREATTRON_EMAIL_ENABLED=false`

---

## 4. Install the service

Use the packaged executable to create a Windows service.

### Option A: Use the helper batch file

1. Open Command Prompt as Administrator.
2. `cd C:\ThreatTronAgent`
3. Run:

```cmd
install_service.bat
```

This will install and start the service automatically.

### Option B: Manual install

1. Open Command Prompt as Administrator.
2. `cd C:\ThreatTronAgent`
3. Run:

```cmd
ThreatTronAgent.exe install
ThreatTronAgent.exe start
```

---

## 5. Verify the agent is running

### Check service status

In Command Prompt as Administrator:

```cmd
sc query ThreatTronAgent
```

Look for `STATE : RUNNING`.

### Use Windows Services manager

1. Open `services.msc`.
2. Find `ThreatTronAgent`.
3. Confirm it is running and set to `Automatic`.

---

## 6. Verify backend delivery

After installation, the agent should start sending events to the backend.

Check the backend or Render logs for incoming POST requests to `/events/batch`.

If the backend is available, the agent will send telemetry periodically.

---

## 7. Troubleshooting

### If the service fails to start

1. Run the service executable manually in an elevated command prompt to see errors:

```cmd
ThreatTronAgent.exe start
```

2. Check Windows Event Viewer under `Application` and `System` for service errors.

3. Confirm environment vars are set correctly and visible to the service.

### If the service installs but does not send data

1. Confirm `THREATTRON_BACKEND_URL` is correct.
2. Confirm the system has network access to the backend URL.
3. Confirm the backend service is online and accepting requests.

---

## 8. Uninstalling the agent

### Using the helper batch file

```cmd
uninstall_service.bat
```

### Manual uninstall

```cmd
ThreatTronAgent.exe stop
ThreatTronAgent.exe remove
```

Then delete the directory `C:\ThreatTronAgent`.

---

## 9. Updating the agent

To update, provide a new version of `ThreatTronAgent.exe` and repeat the install steps.

If a service is already installed:

1. Stop and remove the service.
2. Replace `ThreatTronAgent.exe` with the new version.
3. Reinstall and start the service.

---

## 10. Recommended distribution method

For client delivery, use GitHub Releases:

1. Create a new release on GitHub.
2. Upload `ThreatTronAgent.exe` and optional `install_service.bat` / `uninstall_service.bat`.
3. Publish the release.

Clients download from the release page and follow the installation guide.

Other download hosting options:

- Azure Blob Storage
- AWS S3
- Google Cloud Storage
- Your own website

GitHub Releases is the simplest and most user-friendly choice.
