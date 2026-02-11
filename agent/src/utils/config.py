import uuid
import platform
from datetime import datetime

AGENT_ID = str(uuid.uuid4())
SYSTEM_INFO = {
    "os": platform.system(),
    "os_version": platform.version(),
    "machine": platform.machine()
}
MONITORED_DIRECTORIES = {
    r"D:\Personal_Projects"
}

def base_event(event_type):
    return {
        "agent_id": AGENT_ID,
        "event_type": event_type,
        "timestamp": datetime.utcnow().isoformat(),
        "system": SYSTEM_INFO
    }