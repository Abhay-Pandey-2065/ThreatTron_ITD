from fastapi import APIRouter, Query
from database import SessionLocal
from models import ProcessEvent
from datetime import datetime, timedelta, timezone
from typing import Optional

router = APIRouter()

def _time_cutoff(time_range: str) -> Optional[datetime]:
    now = datetime.now(timezone.utc)
    mapping = {"1h": timedelta(hours=1), "24h": timedelta(hours=24), "7d": timedelta(days=7)}
    delta = mapping.get(time_range)
    return (now - delta) if delta else None

@router.get("/")
def get_process_events(
    time_range: str = Query("24h"),
    agent_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    db = SessionLocal()
    try:
        q = db.query(ProcessEvent).order_by(ProcessEvent.timestamp.desc())
        cutoff = _time_cutoff(time_range)
        if cutoff:
            q = q.filter(ProcessEvent.timestamp >= cutoff)
        if agent_id:
            q = q.filter(ProcessEvent.agent_id == agent_id)
        events = q.offset(offset).limit(limit).all()
        return {"events": [{"id": e.id, "agent_id": e.agent_id, "event_type": e.event_type, "timestamp": e.timestamp.isoformat() if e.timestamp else None, "process_name": e.process_name, "exe_path": e.exe_path, "parent_name": e.parent_name, "parent_pid": e.parent_pid, "suspicious_spawn": e.suspicious_spawn} for e in events]}
    finally:
        db.close()

@router.post("/")
def receive_process_events(events: list):
    db = SessionLocal()
    for event in events:
        db.add(ProcessEvent(agent_id=event["agent_id"], event_type=event["event_type"], timestamp=datetime.fromisoformat(event["timestamp"]), process_name=event["metadata"].get("process_name"), exe_path=event["metadata"].get("exe_path")))
    db.commit()
    db.close()
    return {"status": "process events stored"}
