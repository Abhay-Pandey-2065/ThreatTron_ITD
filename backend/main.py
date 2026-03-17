from fastapi import FastAPI
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Base, FileEvent, ProcessEvent, SystemEvent, EmailEvent, USBEvent
from datetime import datetime

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI()


# Dependency (DB session)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "ThreatTron Backend Running (MySQL)"}


# 🔥 MAIN INGEST ENDPOINT
@app.post("/events/batch")
def receive_events(payload: dict):
    db: Session = SessionLocal()

    events = payload.get("events", [])

    for event in events:
        event_type = event.get("event_type")
        metadata = event.get("metadata", {})
        timestamp = datetime.fromisoformat(event.get("timestamp"))
        agent_id = event.get("agent_id")

        # FILE EVENTS
        if event_type in ["file_activity", "file_moved"]:
            db_event = FileEvent(
                agent_id=agent_id,
                event_type=event_type,
                timestamp=timestamp,
                file_path=metadata.get("file_data") or metadata.get("source_path"),
                action=metadata.get("action"),
                extra_data=metadata
            )
            db.add(db_event)

        # PROCESS EVENTS
        elif event_type in ["process_started", "process_terminated", "startup_process"]:
            db_event = ProcessEvent(
                agent_id=agent_id,
                event_type=event_type,
                timestamp=timestamp,
                process_name=metadata.get("process_name"),
                exe_path=metadata.get("exe_path")
            )
            db.add(db_event)

        # SYSTEM EVENTS
        elif event_type == "system_activity":
            db_event = SystemEvent(
                agent_id=agent_id,
                timestamp=timestamp,
                cpu_usage=metadata.get("cpu_usage"),
                memory_usage=metadata.get("memory_usage")
            )
            db.add(db_event)

        # EMAIL EVENTS
        elif event_type == "email_received":
            db_event = EmailEvent(
                agent_id=agent_id,
                timestamp=timestamp,
                sender=metadata.get("sender"),
                subject=metadata.get("subject"),
                snippet_length=metadata.get("snippet_length"),
                has_links=str(metadata.get("has_links"))
            )
            db.add(db_event)

        # USB EVENTS
        elif event_type in ["usb_inserted", "usb_removed"]:
            db_event = USBEvent(
                agent_id=agent_id,
                event_type=event_type,
                timestamp=timestamp,
                mountpoint=metadata.get("mountpoint")
            )
            db.add(db_event)

    db.commit()
    db.close()

    return {"status": "success", "count": len(events)}