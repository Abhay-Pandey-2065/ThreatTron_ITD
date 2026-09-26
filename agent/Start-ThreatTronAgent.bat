@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Agent Python environment not found. Run Install-ThreatTronAgent.ps1 first.
    exit /b 1
)
".venv\Scripts\python.exe" windows_service.py start
if errorlevel 1 (
    echo Could not start ThreatTronAgent. Try running this file as Administrator.
    exit /b 1
)
echo ThreatTronAgent is running.
