import psutil
import threading
import time
from utils.config import base_event

ADMIN_TOOLS = {
    "powershell.exe","cmd.exe", "wmic.exe", "wscript.exe", "cscript.exe",
    "mshta.exe", "rundll32.exe", "regsvr32.exe", "certutil.exe", "net.exe",
    "netsh.exe", "schtasks.exe", "taskkill.exe", "reg.exe", "psexec.exe"
}

BENIGN_PARENTS = {
    "explorer.exe",
    "taskeng.exe",
    "taskhostw.exe",
    "svchost.exe",
    "services.exe",
    "wininit.exe",
    "userinit.exe",
    "conhost.exe",
    "python.exe",
    "code.exe",
    "windowsterminal.exe",
}

def _get_parent_info(pid: int):
    try:
        proc = psutil.Process(pid)
        parent = proc.parent()
        if parent:
            return parent.name(), parent.pid
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        pass
    return None, None

def _is_suspicious_spawn(child_name: str, parent_name) -> bool:
    if child_name.lower() not in ADMIN_TOOLS:
        return False
    if parent_name is None:
        return False
    return parent_name.lower() not in BENIGN_PARENTS

class ProcessMonitor:

    def __init__(self, event_callback, interval=10):
        self.event_callback = event_callback
        self.interval = interval
        self.baseline = self._capture_current_processes()

    def _capture_current_processes(self):
        processes = {}
        for proc in psutil.process_iter(['pid', 'name', 'exe']):
            try:
                exe = proc.info['exe']
                name = proc.info['name']
                pid = proc.info['pid']
                if not exe:
                    continue
                parent_name, parent_pid = _get_parent_info(pid)

                processes[pid] = {
                    "name": name,
                    "exe": exe,
                    "parent_name": parent_name,
                    "parent_pid": parent_pid,
                }
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        return processes
    
    def start(self):
        # self._log_startup_snapshot()
        thread = threading.Thread(target = self._monitor_loop)
        thread.daemon = True
        thread.start()

    def _monitor_loop(self):
        while True:
            current = self._capture_current_processes()

            new_pids = set(current) - set(self.baseline)
            terminated_pids = set(self.baseline) - set(current)

            for pid in new_pids:
                info = current[pid]
                name = info["name"]
                parent_name = info["parent_name"]
                suspicious = bool(_is_suspicious_spawn(name, parent_name))

                event = base_event("process_started")
                event["metadata"] = {
                    "process_name": name,
                    "exe_path": info["exe"],
                    "pid": pid,
                    "parent_name": parent_name,
                    "parent_pid": info["parent_pid"],
                    "is_admin_tool": name.lower() in ADMIN_TOOLS,
                    "suspicious_spawn": suspicious,
                }
                self.event_callback(event)

            for pid in terminated_pids:
                info = self.baseline[pid]
                name = info["name"]
                event = base_event("process_terminated")
                event["metadata"] = {
                    "process_name": name,
                    "exe_path": info["exe"],
                    "pid": pid,
                    "parent_name": info["parent_name"],
                    "parent_pid": info["parent_pid"],
                    "is_admin_tool": name.lower() in ADMIN_TOOLS,
                    "suspicious_spawn": False,
                }
                self.event_callback(event)

            self.baseline = current
            time.sleep(self.interval)