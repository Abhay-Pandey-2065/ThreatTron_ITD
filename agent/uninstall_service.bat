@echo off
setlocal
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
    echo Run this uninstaller from an elevated Administrator terminal.
    exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
    echo Agent Python environment not found. Remove the service with Windows Services.
    exit /b 1
)

".venv\Scripts\python.exe" windows_service.py stop
".venv\Scripts\python.exe" windows_service.py remove
if errorlevel 1 (
    echo Could not remove ThreatTronAgent. Check the service in Windows Services.
    exit /b 1
)

echo ThreatTronAgent has been removed.
