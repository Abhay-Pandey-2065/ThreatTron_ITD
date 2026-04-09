from fastapi import APIRouter, Query
from database import SessionLocal
from models import EmailEvent
from datetime import datetime, timedelta, timezone
from typing import Optional
from pydantic import BaseModel
import os
import requests

router = APIRouter()

def _time_cutoff(time_range: str) -> Optional[datetime]:
    now = datetime.now(timezone.utc)
    mapping = {"1h": timedelta(hours=1), "24h": timedelta(hours=24), "7d": timedelta(days=7)}
    delta = mapping.get(time_range)
    return (now - delta) if delta else None

@router.get("/")
def get_email_events(
    time_range: str = Query("24h"),
    agent_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    db = SessionLocal()
    try:
        q = db.query(EmailEvent).order_by(EmailEvent.timestamp.desc())
        cutoff = _time_cutoff(time_range)
        if cutoff:
            q = q.filter(EmailEvent.timestamp >= cutoff)
        if agent_id:
            q = q.filter(EmailEvent.agent_id == agent_id)
        events = q.offset(offset).limit(limit).all()
        return {"events": [{"id": e.id, "agent_id": e.agent_id, "timestamp": e.timestamp.isoformat() if e.timestamp else None, "sender": e.sender, "subject": e.subject, "snippet_length": e.snippet_length, "has_links": e.has_links} for e in events]}
    finally:
        db.close()

@router.post("/")
def receive_email_events(events: list):
    db = SessionLocal()
    for event in events:
        has_links_raw = event["metadata"].get("has_links")
        db.add(EmailEvent(agent_id=event["agent_id"], timestamp=datetime.fromisoformat(event["timestamp"]), sender=event["metadata"].get("sender"), subject=event["metadata"].get("subject"), snippet_length=event["metadata"].get("snippet_length"), has_links=bool(has_links_raw) if has_links_raw is not None else None))
    db.commit()
    db.close()
    return {"status": "email events stored"}

class AnalyzeEmailRequest(BaseModel):
    subject: str = ""
    message: str = ""
    sender: str = ""
    urls: str = ""

@router.post("/analyze")
def analyze_email(req: AnalyzeEmailRequest):
    ml_url = os.environ.get("THREATTRON_EMAIL_ML_URL", "http://127.0.0.1:8001/predict")
    try:
        response = requests.post(
            ml_url, 
            json={"subject": req.subject, "message": req.message, "sender": req.sender, "urls": req.urls},
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"error": str(e), "classification": "Unknown", "risk_score": 0.0}
