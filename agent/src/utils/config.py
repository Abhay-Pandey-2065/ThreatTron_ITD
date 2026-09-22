import json
import os
import uuid
import platform
from datetime import datetime, timezone
from utils.session import session as agent_session

DEFAULT_MONITOR_CONFIG = {
    "thread_pool_size": 3,
    "monitored_directories": [r"C:\Users"],
}

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

def _resolve_config_path() -> str:
    env_path = os.environ.get("THREATTRON_MONITOR_CONFIG")
    if env_path:
        return env_path
    base_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    return os.path.join(base_path, "config", "monitor_config.json")

def load_monitor_config(config_path: str | None = None) -> dict:
    resolved_path = config_path or _resolve_config_path()
    config = dict(DEFAULT_MONITOR_CONFIG)

    try:
        with open(resolved_path, "r", encoding="utf-8") as fh:
            loaded = json.load(fh) or {}
        if isinstance(loaded, dict):
            config.update(loaded)
    except FileNotFoundError:
        os.makedirs(os.path.dirname(resolved_path), exist_ok=True)
        with open(resolved_path, "w", encoding="utf-8") as fh:
            json.dump(DEFAULT_MONITOR_CONFIG, fh, indent=2)
    except json.JSONDecodeError:
        pass

    directories = config.get("monitored_directories") or config.get("directories") or config.get("folders")
    if isinstance(directories, str):
        directories = [directories]
    if not directories:
        directories = list(DEFAULT_MONITOR_CONFIG["monitored_directories"])

    thread_pool_size = config.get("thread_pool_size") or config.get("max_workers") or 3
    try:
        thread_pool_size = int(thread_pool_size)
    except (TypeError, ValueError):
        thread_pool_size = DEFAULT_MONITOR_CONFIG["thread_pool_size"]

    return {
        "thread_pool_size": max(1, thread_pool_size),
        "monitored_directories": list(directories),
    }


monitor_config = load_monitor_config()
MONITORED_DIRECTORIES = set(monitor_config["monitored_directories"])
THREAD_POOL_SIZE = monitor_config["thread_pool_size"]


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