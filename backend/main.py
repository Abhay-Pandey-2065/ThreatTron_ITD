from fastapi import FastAPI
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Base, AgentSession, FileEvent, ProcessEvent, SystemEvent, EmailEvent, USBEvent, NetworkEvent
from datetime import datetime

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI()


@app.get("/")
def root():
    return {"message": "ThreatTron Backend Running (MySQL)"}


@app.post("/events/batch")
def receive_events(payload: dict):
    db: Session = SessionLocal()

    events = payload.get("events", [])

    for event in events:
        event_type = event.get("event_type")
        metadata = event.get("metadata", {})
        timestamp = datetime.fromisoformat(event.get("timestamp"))
        agent_id = event.get("agent_id")
        session_id = event.get("session_id")

        if event_type == "session_started":
            existing = db.get(AgentSession, session_id)
            if not existing:
                db.add(AgentSession(
                    session_id=session_id,
                    agent_id=agent_id,
                    hostname=metadata.get("hostname"),
                    mac_address=metadata.get("mac_address"),
                    started_at=timestamp
                ))
            db.flush()
            continue

        if not session_id or db.get(AgentSession, session_id) is None:
            continue

        # FILE EVENTS
        if event_type in ["file_activity", "file_moved", "file_renamed"]:
            db.add(FileEvent(
                session_id=session_id,
                agent_id=agent_id,
                event_type=event_type,
                timestamp=timestamp,
                file_path=metadata.get("file_path") or metadata.get("src_path") or metadata.get("directory"),
                action=metadata.get("action"),
                extra_data=metadata.get("extra_data")
            ))

        # PROCESS EVENTS
        elif event_type in ["process_started", "process_terminated", "startup_process"]:
            suspicious_raw = metadata.get("suspicious_spawn")
            db_event = ProcessEvent(
                session_id=session_id,
                agent_id=agent_id,
                event_type=event_type,
                timestamp=timestamp,
                process_name=metadata.get("process_name"),
                exe_path=metadata.get("exe_path"),
                parent_name=metadata.get("parent_name"),
                parent_pid=metadata.get("parent_pid"),
                suspicious_spawn=bool(suspicious_raw) if suspicious_raw is not None else None,
            )
            db.add(db_event)

        # NETWORK EVENTS
        elif event_type == "network_connection":
            db_event = NetworkEvent(
                session_id=session_id,
                agent_id=agent_id,
                timestamp=timestamp,
                local_ip_hash=metadata.get("local_ip_hash"),
                local_port=metadata.get("local_port"),
                remote_ip_hash=metadata.get("remote_ip_hash"),
                remote_port=metadata.get("remote_port"),
                status=metadata.get("status"),
                pid=metadata.get("pid"),
                process_name=metadata.get("process_name"),
            )
            db.add(db_event)

        # SYSTEM EVENTS
        elif event_type == "system_activity":
            db_event = SystemEvent(
                session_id=session_id,
                agent_id=agent_id,
                timestamp=timestamp,
                cpu_usage=metadata.get("cpu_usage"),
                memory_usage=metadata.get("memory_usage")
            )
            db.add(db_event)

        # EMAIL EVENTS
        elif event_type == "email_received":
            has_links_raw = metadata.get("has_links")
            db_event = EmailEvent(
                session_id=session_id,
                agent_id=agent_id,
                timestamp=timestamp,
                sender=metadata.get("sender"),
                subject=metadata.get("subject"),
                snippet_length=metadata.get("snippet_length"),
                has_links=bool(has_links_raw) if has_links_raw is not None else None,
            )
            db.add(db_event)

        # USB EVENTS
        elif event_type in ["usb_inserted", "usb_removed"]:
            db_event = USBEvent(
                session_id=session_id,
                agent_id=agent_id,
                event_type=event_type,
                timestamp=timestamp,
                mountpoint=metadata.get("mountpoint")
            )
            db.add(db_event)

    db.commit()
    db.close()

    return {"status": "success", "count": len(events)}