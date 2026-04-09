from fastapi import APIRouter, Query
from database import SessionLocal
from models import FileEvent
from datetime import datetime, timedelta, timezone
from typing import Optional

router = APIRouter()

def _time_cutoff(time_range: str) -> Optional[datetime]:
    now = datetime.now(timezone.utc)
    mapping = {"1h": timedelta(hours=1), "24h": timedelta(hours=24), "7d": timedelta(days=7)}
    delta = mapping.get(time_range)
    return (now - delta) if delta else None

@router.get("/")
def get_file_events(
    time_range: str = Query("24h"),
    agent_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    db = SessionLocal()
    try:
        q = db.query(FileEvent).order_by(FileEvent.timestamp.desc())
        cutoff = _time_cutoff(time_range)
        if cutoff:
            q = q.filter(FileEvent.timestamp >= cutoff)
        if agent_id:
            q = q.filter(FileEvent.agent_id == agent_id)
        events = q.offset(offset).limit(limit).all()
        return {"events": [{"id": e.id, "agent_id": e.agent_id, "event_type": e.event_type, "timestamp": e.timestamp.isoformat() if e.timestamp else None, "file_path": e.file_path, "action": e.action, "extra_data": e.extra_data} for e in events]}
    finally:
        db.close()

@router.post("/")
def receive_file_events(events: list):
    db = SessionLocal()
    for event in events:
        db.add(FileEvent(agent_id=event["agent_id"], event_type=event["event_type"], timestamp=datetime.fromisoformat(event["timestamp"]), file_path=event["metadata"].get("file_data") or event["metadata"].get("source_path"), action=event["metadata"].get("action"), extra_data=event["metadata"]))
    db.commit()
    db.close()
    return {"status": "file events stored"}
