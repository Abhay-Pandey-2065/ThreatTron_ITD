import psutil
from utils.config import base_event

def collect_process_activity():
    events = []
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percentage']):
        try:
            event = base_event("process_activity")
            event["metadata"] = {
                "pid": proc.info['pid'],
                "process_name": proc.info['name'],
                "cpu_percent": proc.info['cpu_percent']
            }
            events.append(event)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return events