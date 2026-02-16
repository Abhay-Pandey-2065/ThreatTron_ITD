from fastapi import APIRouter
from database import SessionLocal
from models import ProcessEvent
from datetime import datetime

router = APIRouter()

@router.post("/")
def receive_process_events(events: list):
    db = SessionLocal()

    for event in events:
        db.add(ProcessEvent(
            agent_id=event["agent_id"],
            event_type=event["event_type"],
            timestamp=datetime.fromisoformat(event["timestamp"]),
            process_name=event["metadata"].get("process_name"),
            exe_path=event["metadata"].get("exe_path")
        ))

    db.commit()
    db.close()

    return {"status": "process events stored"}
