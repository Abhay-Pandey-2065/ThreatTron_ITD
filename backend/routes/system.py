from fastapi import APIRouter
from database import SessionLocal
from models import SystemEvent
from datetime import datetime

router = APIRouter()

@router.post("/")
def receive_system_events(events: list):
    db = SessionLocal()

    for event in events:
        db.add(SystemEvent(
            agent_id=event["agent_id"],
            timestamp=datetime.fromisoformat(event["timestamp"]),
            cpu_usage=event["metadata"].get("cpu_usage"),
            memory_usage=event["metadata"].get("memory_usage")
        ))

    db.commit()
    db.close()

    return {"status": "system events stored"}
