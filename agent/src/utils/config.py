import os
import uuid
import platform
from datetime import datetime, timezone
from utils.session import session as agent_session

def base_event(event_type: str) -> dict:
    return {
        "event_type": event_type,
        "agent_id": agent_session.agent_id,
        "session_id": agent_session.session_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

def on_agent_start(event_callback):
    event = base_event("session_started")
    event["metadata"] = agent_session.to_dict()
    event_callback(event)

MONITORED_DIRECTORIES = {
    r"C:\Users\Parth\Desktop\New folder"
}


# def get_monitored_directories() -> set:
#     """Return all mounted root directories for the current system."""
#     if platform.system() == "Windows":
#         try:
#             import psutil
#             drives = {partition.mountpoint for partition in psutil.disk_partitions(all=False) if partition.mountpoint}
#             if drives:
#                 return drives
#         except Exception:
#             pass
#         return {r"C:\\"}

#     return {os.path.abspath(os.sep)}

# MONITORED_DIRECTORIES = get_monitored_directories()