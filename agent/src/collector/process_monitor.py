import psutil
import threading
import time
from utils.config import base_event

class ProcessMonitor:

    def __init__(self, event_callback, interval=10):
        self.event_callback = event_callback
        self.interval = interval
        self.baseline = self._capture_current_processes()

    def _capture_current_processes(self):
        processes = set()
        for proc in psutil.process_iter(['pid', 'name', 'exe']):
            try:
                exe = proc.info['exe']
                name = proc.info['name']
                if exe:
                    processes.add((name, exe))
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        return processes
    
    def start(self):
        # self._log_startup_snapshot()
        thread = threading.Thread(target = self._monitor_loop)
        thread.daemon = True
        thread.start()

    def _log_startup_snapshot(self):
        for name, exe in self.baseline:
            event = base_event("baseline_process")
            event["metadata"] = {
                "process_name": name,
                "exe_path": exe
            }
            self.event_callback(event)

    def _monitor_loop(self):
        while True:
            current = self._capture_current_processes()

            new_processes = current - self.baseline
            terminated_processes = self.baseline - current

            for name, exe in new_processes:
                event = base_event("process_started")
                event["metadata"] = {
                    "process_name": name,
                    "exe_path": exe
                }
                self.event_callback(event)

            for name, exe in terminated_processes:
                event = base_event("process_terminated")
                event["metadata"] = {
                    "process_name": name,
                    "exe_path": exe
                }
                self.event_callback(event)

            self.baseline = current
            time.sleep(self.interval)