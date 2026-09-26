$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
    Write-Host "`n$Message" -ForegroundColor Cyan
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host 'Administrator permission is required. Windows will ask you to approve it.'
    $scriptArguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $scriptArguments
    exit 0
}

$agentRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$configDirectory = Join-Path $agentRoot 'config'
$venvPython = Join-Path $agentRoot '.venv\Scripts\python.exe'

Write-Host 'ThreatTron Data Collection Agent setup' -ForegroundColor Green
Write-Host 'This installs an automatic-start Windows service. Email collection is not included.'
Write-Host 'Only configure folders and systems you own or have permission to monitor.'

Write-Step '1/5 - Enter the backend address'
$backendRoot = (Read-Host 'Backend HTTPS address, for example https://your-service.onrender.com').Trim().TrimEnd('/')
try {
    $backendUri = [Uri]$backendRoot
    if (-not $backendUri.IsAbsoluteUri -or $backendUri.Scheme -ne 'https') {
        throw 'Use a complete HTTPS address.'
    }
} catch {
    Write-Error "Invalid backend address. Enter the HTTPS base address, without /events/batch."
    exit 1
}
$backendEndpoint = "$backendRoot/events/batch"

Write-Step '2/5 - Choose folders to monitor'
Write-Host 'Enter one folder at a time. Press Enter on an empty line when finished.'
Write-Host "For example: $env:USERPROFILE"
$directories = [System.Collections.Generic.List[string]]::new()
while ($true) {
    $folder = (Read-Host 'Folder path (empty line finishes)').Trim().Trim('"')
    if ([string]::IsNullOrWhiteSpace($folder)) {
        break
    }
    if (-not (Test-Path -LiteralPath $folder -PathType Container)) {
        Write-Warning "Folder not found; skipping: $folder"
        continue
    }
    $resolvedFolder = (Resolve-Path -LiteralPath $folder).Path
    if (-not $directories.Contains($resolvedFolder)) {
        $directories.Add($resolvedFolder)
    }
}

if ($directories.Count -eq 0) {
    Write-Error 'Choose at least one existing folder before installing.'
    exit 1
}

Write-Host "`nFolders to monitor:" -ForegroundColor Yellow
$directories | ForEach-Object { Write-Host "  $_" }
$confirmation = Read-Host 'Continue with these folders? (yes/no)'
if ($confirmation -notmatch '^(yes|y)$') {
    Write-Host 'Setup cancelled. No service was installed.'
    exit 0
}

Write-Step '3/5 - Check for Python 3.12'
& py -3.12 --version
if ($LASTEXITCODE -ne 0) {
    Write-Error 'Python 3.12 was not found. Install 64-bit Python 3.12 from https://www.python.org/downloads/windows/ and select "Add python.exe to PATH", then run this installer again.'
    exit 1
}

Write-Step '4/5 - Install the agent and save your settings'
New-Item -ItemType Directory -Path $configDirectory -Force | Out-Null
if (-not (Test-Path -LiteralPath $venvPython)) {
    & py -3.12 -m venv (Join-Path $agentRoot '.venv')
    if ($LASTEXITCODE -ne 0) {
        Write-Error 'Could not create the agent Python environment.'
        exit 1
    }
}

& $venvPython -m pip install --disable-pip-version-check -r (Join-Path $agentRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) {
    Write-Error 'Could not install required Python packages. Check your internet connection and try again.'
    exit 1
}

$monitorConfig = @{
    thread_pool_size = 3
    monitored_directories = @($directories)
} | ConvertTo-Json -Depth 4
$settingsConfig = @{
    backend_url = $backendEndpoint
} | ConvertTo-Json -Depth 4
$utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText((Join-Path $configDirectory 'monitor_config.json'), $monitorConfig, $utf8WithoutBom)
[System.IO.File]::WriteAllText((Join-Path $configDirectory 'service_settings.json'), $settingsConfig, $utf8WithoutBom)

Write-Step '5/5 - Install and start the Windows service'
& $venvPython (Join-Path $agentRoot 'windows_service.py') --startup auto install
if ($LASTEXITCODE -ne 0) {
    Write-Error 'Windows could not install the service. See the troubleshooting section in README.md.'
    exit 1
}

& $venvPython (Join-Path $agentRoot 'windows_service.py') start
if ($LASTEXITCODE -ne 0) {
    Write-Error 'The service was installed but did not start. Open Windows Services and check ThreatTronAgent.'
    exit 1
}

Write-Host "`nSetup complete. ThreatTronAgent is running and will start with Windows." -ForegroundColor Green
Write-Host 'Use Stop-ThreatTronAgent.bat to stop it. See README.md for more instructions.'
