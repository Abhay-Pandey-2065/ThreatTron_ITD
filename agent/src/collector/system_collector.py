import psutil
from utils.config import base_event

def collect_system_activity():
    event = base_event("system_activity")
    event["metadata"] = {
        "cpu_usage": psutil.cpu_percent(interval=1),
        "memory_usage": psutil.virtual_memory().percent,
        "active_users": len(psutil.users())
    }
    return [event]