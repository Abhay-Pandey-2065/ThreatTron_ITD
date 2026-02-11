import psutil
from utils.config import base_event

def collect_process_activity():
    events = []
    for proc in psutil.process_iter(['pid', 'name']):
        try:
            cpu_usage = proc.cpu_percent(interval=None)

            event = base_event("process_activity")
            event["metadata"] = {
                "pid": proc.info['pid'],
                "process_name": proc.info['name'],
                "cpu_percent": cpu_usage
            }
            events.append(event)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue
    return events