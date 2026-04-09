from fastapi import APIRouter, Query
from database import SessionLocal
from models import NetworkEvent
from datetime import datetime, timedelta, timezone
from typing import Optional

router = APIRouter()

def _time_cutoff(time_range: str) -> Optional[datetime]:
    now = datetime.now(timezone.utc)
    mapping = {"1h": timedelta(hours=1), "24h": timedelta(hours=24), "7d": timedelta(days=7)}
    delta = mapping.get(time_range)
    return (now - delta) if delta else None


@router.get("/")
def get_network_events(
    time_range: str = Query("24h"),
    agent_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    db = SessionLocal()
    try:
        q = db.query(NetworkEvent).order_by(NetworkEvent.timestamp.desc())

        cutoff = _time_cutoff(time_range)
        if cutoff:
            q = q.filter(NetworkEvent.timestamp >= cutoff)
        if agent_id:
            q = q.filter(NetworkEvent.agent_id == agent_id)

        events = q.offset(offset).limit(limit).all()

        return {
            "events": [
                {
                    "id": e.id,
                    "agent_id": e.agent_id,
                    "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                    "local_ip_hash": e.local_ip_hash,
                    "local_port": e.local_port,
                    "remote_ip_hash": e.remote_ip_hash,
                    "remote_port": e.remote_port,
                    "status": e.status,
                    "pid": e.pid,
                    "process_name": e.process_name,
                }
                for e in events
            ]
        }
    finally:
        db.close()
