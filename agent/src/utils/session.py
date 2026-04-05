import uuid
import hashlib
import socket
import time
from datetime import datetime, timezone

def get_mac_address():
    try:
        mac_int = uuid.getnode()
        if (mac_int >> 40) & 1:
            return "000000000000"
        return f"{mac_int:012x}"
    except Exception:
        return "000000000000"
    
def _get_hostname():
    try:
        return socket.gethostname().lower()
    except Exception:
        return "unknown-host"
    
def generate_agent_id():
    mac = get_mac_address()
    hostname = _get_hostname()
    raw = f"{mac}::{hostname}".encode("utf-8")
    digest = hashlib.sha256(raw).hexdigest()
    return f"agent-{digest[:16]}"

def generate_session_id() -> str:
    return str(uuid.uuid4())



class AgentSession:
    def __init__(self):
        self.agent_id : str = generate_agent_id()
        self.session_id : str = generate_session_id()
        self.started_at : str = datetime.now(timezone.utc).isoformat()
        self._start_ts : float = time.monotonic()
    
    @property
    def uptime_seconds(self) -> float:
        return time.monotonic() - self._start_ts
    
    def to_dict(self) -> dict:
        return {
            "agent_id": self.agent_id,
            "session_id": self.session_id,
            "started_at": self.started_at,
            "hostname": _get_hostname(),
            "mac_address": get_mac_address(),
        }
    
    def __repr__(self):
        return (
            f"AgentSession(agent_id={self.agent_id!r}, "
            f"session_id={self.session_id!r}, "
            f"started_at={self.started_at!r})"
        )
    
session = AgentSession()