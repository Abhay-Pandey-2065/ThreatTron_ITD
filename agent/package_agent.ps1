param(
    [string]$OutputPath = (Join-Path $PSScriptRoot 'dist\ThreatTronAgent.zip')
)

$ErrorActionPreference = 'Stop'
$agentRoot = $PSScriptRoot
$stagingPath = Join-Path $env:TEMP "ThreatTronAgent-package-$PID"
$outputDirectory = Split-Path -Parent $OutputPath

if (Test-Path -LiteralPath $stagingPath) {
    Remove-Item -LiteralPath $stagingPath -Recurse -Force
}
New-Item -ItemType Directory -Path $stagingPath -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stagingPath 'src') -Force | Out-Null
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

try {
    foreach ($file in @(
        'README.md',
        'requirements.txt',
        'windows_service.py',
        'Install-ThreatTronAgent.ps1',
        'Start-ThreatTronAgent.bat',
        'Stop-ThreatTronAgent.bat',
        'uninstall_service.bat'
    )) {
        Copy-Item -LiteralPath (Join-Path $agentRoot $file) -Destination $stagingPath
    }

    Copy-Item -LiteralPath (Join-Path $agentRoot 'config\monitor_config.example.json') -Destination (Join-Path $stagingPath 'monitor_config.example.json')
    foreach ($directory in @('collector', 'sender', 'utils')) {
        $sourceDirectory = Join-Path $agentRoot "src\$directory"
        foreach ($sourceFile in Get-ChildItem -LiteralPath $sourceDirectory -Filter '*.py' -File -Recurse) {
            $relativePath = $sourceFile.FullName.Substring($sourceDirectory.Length).TrimStart('\')
            $destination = Join-Path $stagingPath "src\$directory\$relativePath"
            New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
            Copy-Item -LiteralPath $sourceFile.FullName -Destination $destination
        }
    }
    Copy-Item -LiteralPath (Join-Path $agentRoot 'src\main.py') -Destination (Join-Path $stagingPath 'src')
    New-Item -ItemType Directory -Path (Join-Path $stagingPath 'config') -Force | Out-Null

    if (Test-Path -LiteralPath $OutputPath) {
        Remove-Item -LiteralPath $OutputPath -Force
    }
    Compress-Archive -Path (Join-Path $stagingPath '*') -DestinationPath $OutputPath -CompressionLevel Optimal
    Write-Host "Agent package created: $OutputPath" -ForegroundColor Green
} finally {
    Remove-Item -LiteralPath $stagingPath -Recurse -Force
}
