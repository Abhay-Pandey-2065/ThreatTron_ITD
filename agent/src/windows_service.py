import win32serviceutil, win32service, win32event, servicemanager
import threading, os, sys

sys.path.insert(0, os.path.dirname(__file__))
from main import run_agent

class ThreatTronService(win32serviceutil.ServiceFramework):
    _svc_name_ = "ThreatTronAgent"
    _svc_display_name_ = "ThreatTron Security Agent"
    _svc_description_ = "Collects system telemetry and sends to ThreatTron backend."

    def __init__(self, args):
        super().__init__(args)
        self.stop_event = win32event.CreateEvent(None, 0, 0, None)

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.stop_event)

    def SvcDoRun(self):
        servicemanager.LogMsg(servicemanager.EVENTLOG_INFORMATION_TYPE, servicemanager.PYS_SERVICE_STARTED, (self._svc_name, ""))
        thread = threading.Thread(target=run_agent, daemon=True)
        thread.start()
        win32event.WaitForSingleObject(self.stop_event, win32event.INFINITE)

if __name__ == "__main__":
    win32serviceutil.HandleCommandLine(ThreatTronService)