@echo off
cd /d %~dp0
if not exist dist\ThreatTronAgent.exe (
  echo Error: dist\ThreatTronAgent.exe not found. Run build_agent.bat first.
  exit /b 1
)
echo Installing ThreatTron service...
dist\ThreatTronAgent.exe install
if %errorlevel% neq 0 (
  echo Failed to install service. Make sure you are running this as Administrator.
  pause
  exit /b %errorlevel%
)
echo Starting ThreatTron service...
dist\ThreatTronAgent.exe start
if %errorlevel% neq 0 (
  echo Failed to start service. Make sure you are running this as Administrator.
  pause
  exit /b %errorlevel%
)
echo Service installed and started.
pause
