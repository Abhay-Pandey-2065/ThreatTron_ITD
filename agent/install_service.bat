@echo off
cd /d %~dp0
set EXE_PATH=dist\ThreatTronAgent.exe
if not exist "%EXE_PATH%" set EXE_PATH=ThreatTronAgent.exe
if not exist "%EXE_PATH%" (
  echo Error: ThreatTronAgent.exe not found. Run build_agent.bat first or place the executable in this folder.
  exit /b 1
)
echo Installing ThreatTron service...
"%EXE_PATH%" install
if %errorlevel% neq 0 (
  echo Failed to install service. Make sure you are running this as Administrator.
  pause
  exit /b %errorlevel%
)
echo Starting ThreatTron service...
"%EXE_PATH%" start
if %errorlevel% neq 0 (
  echo Failed to start service. Make sure you are running this as Administrator.
  pause
  exit /b %errorlevel%
)
echo Service installed and started.
pause
