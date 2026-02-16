from fastapi import APIRouter
from database import SessionLocal
from models import FileEvent
from datetime import datetime

router = APIRouter()

@router.post("/")
def receive_file_events(events: list):
    db = SessionLocal()

    for event in events:
        db.add(FileEvent(
            agent_id=event["agent_id"],
            event_type=event["event_type"],
            timestamp=datetime.fromisoformat(event["timestamp"]),
            file_path=event["metadata"].get("file_data") or event["metadata"].get("source_path"),
            action=event["metadata"].get("action"),
            extra_data=event["metadata"]
        ))

    db.commit()
    db.close()

    return {"status": "file events stored"}
