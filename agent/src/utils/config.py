import uuid
import platform
from datetime import datetime
from utils.session import session as agent_session
from datetime import datetime, timezone

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
    r"D:\Personal_Projects"
}