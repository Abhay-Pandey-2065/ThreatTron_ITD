from fastapi import APIRouter
from database import SessionLocal
from models import EmailEvent
from datetime import datetime

router = APIRouter()

@router.post("/")
def receive_email_events(events: list):
    db = SessionLocal()

    for event in events:
        db.add(EmailEvent(
            agent_id=event["agent_id"],
            timestamp=datetime.fromisoformat(event["timestamp"]),
            sender=event["metadata"].get("sender"),
            subject=event["metadata"].get("subject"),
            snippet_length=event["metadata"].get("snippet_length"),
            has_links=str(event["metadata"].get("has_links"))
        ))

    db.commit()
    db.close()

    return {"status": "email events stored"}
