from fastapi import APIRouter, Query
from database import SessionLocal
from models import SystemEvent
from datetime import datetime, timedelta, timezone
from typing import Optional

router = APIRouter()

def _time_cutoff(time_range: str) -> Optional[datetime]:
    now = datetime.now(timezone.utc)
    mapping = {"1h": timedelta(hours=1), "24h": timedelta(hours=24), "7d": timedelta(days=7)}
    delta = mapping.get(time_range)
    return (now - delta) if delta else None

@router.get("/")
def get_system_events(
    time_range: str = Query("24h"),
    agent_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    db = SessionLocal()
    try:
        q = db.query(SystemEvent).order_by(SystemEvent.timestamp.desc())
        cutoff = _time_cutoff(time_range)
        if cutoff:
            q = q.filter(SystemEvent.timestamp >= cutoff)
        if agent_id:
            q = q.filter(SystemEvent.agent_id == agent_id)
        events = q.offset(offset).limit(limit).all()
        return {"events": [{"id": e.id, "agent_id": e.agent_id, "timestamp": e.timestamp.isoformat() if e.timestamp else None, "cpu_usage": e.cpu_usage, "memory_usage": e.memory_usage} for e in events]}
    finally:
        db.close()

@router.post("/")
def receive_system_events(events: list):
    db = SessionLocal()
    for event in events:
        db.add(SystemEvent(agent_id=event["agent_id"], timestamp=datetime.fromisoformat(event["timestamp"]), cpu_usage=event["metadata"].get("cpu_usage"), memory_usage=event["metadata"].get("memory_usage")))
    db.commit()
    db.close()
    return {"status": "system events stored"}
