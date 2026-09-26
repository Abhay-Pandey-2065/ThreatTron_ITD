# ThreatTron Windows Data Collection Agent

This agent runs quietly as a Windows service, starts automatically with Windows, and sends selected endpoint telemetry to the ThreatTron backend. **It does not collect email.**

Only install it on a computer you own or are authorized to monitor. The installer asks which folders to watch; review that list before confirming.

> [!WARNING]
> The Windows service background process is currently not working. Do **not** download or use `ThreatTronAgent.zip` until this issue has been resolved.

## Easiest way to download

### Download a ready-to-install ZIP from GitHub

1. Open the project's **Releases** page: <https://github.com/Abhay-Pandey-2065/ThreatTron_ITD/releases>.
2. Download `ThreatTronAgent.zip` from the latest release.
3. Right-click the ZIP, choose **Extract All...**, and open the extracted `ThreatTronAgent` folder.
4. Continue with **Install the agent** below.

The release ZIP contains only the files needed by the agent. It does not include Gmail/email code, credentials, local tokens, or developer cache files.
If the Releases page has no `ThreatTronAgent.zip` yet, a project maintainer can publish a new release or run **Actions → Package Windows agent release → Run workflow**, entering the existing release tag. GitHub then builds and attaches the ZIP to that release.

### Download directly from the repository

If there is no release yet, open the repository on GitHub, select **Code → Download ZIP**, extract it, and open `agent`. Then continue with **Install the agent** below. The full repository download is larger than the release ZIP.

## Install the agent

You need Windows 10 or 11, an internet connection, and a Windows administrator account.

1. Install **64-bit Python 3.12** from <https://www.python.org/downloads/windows/>. In the installer, enable **Add python.exe to PATH**.
2. Open the extracted `ThreatTronAgent` folder. Right-click an empty area while holding **Shift**, then choose **Open PowerShell window here** or **Open in Terminal**.
3. In the terminal, run:

   ```powershell
   Set-ExecutionPolicy -Scope Process Bypass
   .\Install-ThreatTronAgent.ps1
   ```

   The installer will open an administrator PowerShell window and ask you to approve it. Continue answering the setup questions in that new window.

4. When asked, paste the HTTPS base address of your ThreatTron backend, such as `https://your-backend.onrender.com`. Do not add `/events/batch`; the installer adds that path.
5. Enter each folder that should be monitored. Press Enter on an empty line to finish. The installer checks that each folder exists and shows the final list.
6. Type `yes` only if the backend and folder list are correct. The installer creates a private Python environment, installs dependencies, registers the Windows service, and starts it.
7. Keep the extracted folder in place. The installed service runs its program from this folder.

If you do not know your backend address, ask the ThreatTron administrator who gave you the agent. Do not guess an address.

## Confirm it is running

- Open the Windows **Services** app (search for `Services` in the Start menu).
- Find **ThreatTron Data Collection Agent**. Its status should be **Running** and startup type should be **Automatic**.
- In the ThreatTron console, look for the endpoint under its agent ID/hostname. The first records can take around 10 seconds to appear.

## Start, stop, or uninstall

Run these helper files from the extracted folder. Windows may ask for administrator permission.

- `Stop-ThreatTronAgent.bat` stops collection. It will start again at the next Windows boot.
- `Start-ThreatTronAgent.bat` starts collection again.
- `uninstall_service.bat` stops and removes the service. It does not delete the extracted files or collected backend records.

## What the agent collects

The service collects file activity in the folders you selected, process starts/stops, selected network connection metadata, USB device activity, and system resource activity. It sends records to the configured backend. It does not read file contents or collect email. System-level process and network monitoring may require administrator permissions.

## Troubleshooting

- **Python 3.12 was not found:** install 64-bit Python 3.12, enable **Add python.exe to PATH**, then reopen an Administrator PowerShell window and retry.
- **Service did not start:** open Services, select **ThreatTron Data Collection Agent**, and check its properties. Also open **Event Viewer → Windows Logs → Application** and look for service errors.
- **Error 1053 / service start timed out:** use the latest agent ZIP. Older releases may not report the Windows service as running before initializing the collectors and contacting the backend. In Services, the display name is **ThreatTron Data Collection Agent**; its internal name is `ThreatTronAgent`.
- **No records appear:** verify the backend HTTPS address with the administrator and ensure this computer has internet access. A free hosting service may take time to wake.
- **Folder skipped:** check that the path exists and that the service account can access it.
- **Change folders or backend:** stop the service, edit `config\monitor_config.json` or `config\service_settings.json`, then start it again.

## Build a ZIP to send to someone

From the repository's `agent` folder, run PowerShell:

```powershell
.\package_agent.ps1
```

The clean, shareable ZIP is written to `agent\dist\ThreatTronAgent.zip`. It excludes machine-specific configuration, email code, credentials, and local tokens.
