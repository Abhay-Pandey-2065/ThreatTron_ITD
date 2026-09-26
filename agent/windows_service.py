import os
import sys
import json
import threading
import traceback
from pathlib import Path


AGENT_ROOT = Path(__file__).resolve().parent
SOURCE_ROOT = AGENT_ROOT / "src"
os.chdir(AGENT_ROOT)
sys.path.insert(0, str(SOURCE_ROOT))

settings_path = AGENT_ROOT / "config" / "service_settings.json"
if settings_path.exists():
    with settings_path.open("r", encoding="utf-8") as settings_file:
        settings = json.load(settings_file)
    backend_url = settings.get("backend_url")
    if backend_url:
        os.environ["THREATTRON_BACKEND_URL"] = backend_url

monitor_config_path = AGENT_ROOT / "config" / "monitor_config.json"
if monitor_config_path.exists():
    os.environ["THREATTRON_MONITOR_CONFIG"] = str(monitor_config_path)

import servicemanager
import win32service
import win32serviceutil


class ThreatTronAgentService(win32serviceutil.ServiceFramework):
    _svc_name_ = "ThreatTronAgent"
    _svc_display_name_ = "ThreatTron Data Collection Agent"
    _svc_description_ = "Collects configured endpoint telemetry and sends it to the configured ThreatTron backend."

    def __init__(self, args):
        super().__init__(args)
        self.stop_event = threading.Event()

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        self.stop_event.set()

    def SvcDoRun(self):
        self.ReportServiceStatus(win32service.SERVICE_RUNNING)
        servicemanager.LogInfoMsg("ThreatTron data collection service started.")
        try:
            from main import run_agent

            run_agent(self.stop_event)
        except Exception as exc:
            error_details = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
            servicemanager.LogErrorMsg(f"ThreatTron data collection service failed:\n{error_details}")
            raise
        servicemanager.LogInfoMsg("ThreatTron data collection service stopped.")


if __name__ == "__main__":
    win32serviceutil.HandleCommandLine(ThreatTronAgentService)
