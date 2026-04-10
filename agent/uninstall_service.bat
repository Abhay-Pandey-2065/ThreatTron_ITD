@echo off
cd /d %~dp0
set EXE_PATH=dist\ThreatTronAgent.exe
if not exist "%EXE_PATH%" set EXE_PATH=ThreatTronAgent.exe
if not exist "%EXE_PATH%" (
  echo Error: ThreatTronAgent.exe not found. Run build_agent.bat first or place the executable in this folder.
  exit /b 1
)
echo Stopping ThreatTron service...
"%EXE_PATH%" stop
if %errorlevel% neq 0 (
  echo Failed to stop service or service was not running.
)
echo Removing ThreatTron service...
"%EXE_PATH%" remove
if %errorlevel% neq 0 (
  echo Failed to remove service. Make sure you are running this as Administrator.
  pause
  exit /b %errorlevel%
)
echo Service removed.
pause
