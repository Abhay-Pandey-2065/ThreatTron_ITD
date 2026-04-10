@echo off
cd /d %~dp0
echo Installing build dependencies...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
echo Building ThreatTronAgent.exe...
python -m PyInstaller --clean --onefile --name ThreatTronAgent --hidden-import=win32serviceutil --hidden-import=win32service --hidden-import=win32event --hidden-import=servicemanager --hidden-import=pywintypes --hidden-import=pythoncom --hidden-import=win32timezone src\windows_service.py
echo Build completed.
echo Find the executable in dist\ThreatTronAgent.exe
pause
