@echo off
cd /d %~dp0
if not exist dist\ThreatTronAgent.exe (
  echo Error: dist\ThreatTronAgent.exe not found. Run build_agent.bat first.
  exit /b 1
)
echo Stopping ThreatTron service...
dist\ThreatTronAgent.exe stop
if %errorlevel% neq 0 (
  echo Failed to stop service or service was not running.
)
echo Removing ThreatTron service...
dist\ThreatTronAgent.exe remove
if %errorlevel% neq 0 (
  echo Failed to remove service. Make sure you are running this as Administrator.
  pause
  exit /b %errorlevel%
)
echo Service removed.
pause
