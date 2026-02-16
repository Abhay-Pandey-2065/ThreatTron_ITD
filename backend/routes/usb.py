from fastapi import APIRouter
from database import SessionLocal
from models import USBEvent
from datetime import datetime

router = APIRouter()

@router.post("/")
def receive_usb_events(events: list):
    db = SessionLocal()

    for event in events:
        db.add(USBEvent(
            agent_id=event["agent_id"],
            event_type=event["event_type"],
            timestamp=datetime.fromisoformat(event["timestamp"]),
            mountpoint=event["metadata"].get("mountpoint")
        ))

    db.commit()
    db.close()

    return {"status": "usb events stored"}
