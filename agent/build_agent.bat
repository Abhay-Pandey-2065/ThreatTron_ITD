@echo off
cd /d %~dp0
echo Installing build dependencies...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
echo Building ThreatTronAgent.exe...
python -m PyInstaller --clean --onefile --name ThreatTronAgent src\windows_service.py
echo Build completed.
echo Find the executable in dist\ThreatTronAgent.exe
pause
