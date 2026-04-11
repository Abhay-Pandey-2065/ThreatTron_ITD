from fastapi import APIRouter, Query
from database import SessionLocal
from models import EmailEvent
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from pydantic import BaseModel
import requests
import os

router = APIRouter()


def _time_cutoff(time_range: str) -> Optional[datetime]:
    now = datetime.now(timezone.utc)
    mapping = {
        "1h":  timedelta(hours=1),
        "24h": timedelta(hours=24),
        "7d":  timedelta(days=7),
        "30d": timedelta(days=30),
    }
    delta = mapping.get(time_range)
    return (now - delta) if delta else None


@router.get("/")
def get_emails(
    time_range: str = Query("24h", description="Filter window: 1h, 24h, 7d, 30d, or 'all'"),
    agent_id: Optional[str] = Query(None, description="Filter by agent ID"),
    has_links: Optional[bool] = Query(None, description="Filter by whether email has links"),
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

        if has_links is not None:
            q = q.filter(EmailEvent.has_links == has_links)

        total = q.count()
        events = q.offset(offset).limit(limit).all()

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "events": [
                {
                    "id":             e.id,
                    "agent_id":       e.agent_id,
                    "session_id":     e.session_id,
                    "timestamp":      e.timestamp.isoformat() if e.timestamp else None,
                    "sender":         e.sender,
                    "subject":        e.subject,
                    "snippet_length": e.snippet_length,
                    "has_links":      e.has_links,
                    "classified":     e.classified
                }
                for e in events
            ],
        }
    finally:
        db.close()


@router.get("/force-classify")
def force_classify():
    count = process_unclassified_logic()
    return {"updated": count}


# --- New Classification APIs ---

class ClassificationUpdate(BaseModel):
    email_id: int
    classification: str  # "Phishing" or "Legitimate" (translated to spam/ham if preferred)

@router.get("/analyze-pending")
def analyze_pending_emails():
    """
    API 1: Fetches unclassified emails and sends them to ML model.
    """
    db = SessionLocal()
    ml_url = os.getenv("THREATTRON_EMAIL_ML_URL", "https://email-agent-c2ra.onrender.com/predict")
    
    try:
        # 1. Fetch unclassified emails
        pending = db.query(EmailEvent).filter(EmailEvent.classified == None).limit(10).all()
        
        results = []
        for email in pending:
            # 2. Call ML API
            payload = {
                "subject": email.subject or "",
                "message": email.body or "",
                "sender": email.sender or "",
                "urls": "1" if email.has_links else "0"
            }
            try:
                resp = requests.post(ml_url, json=payload, timeout=10)
                resp.raise_for_status()
                ml_data = resp.json()
                
                # Map "Phishing" -> "spam", "Legitimate" -> "ham"
                label = "spam" if ml_data.get("classification") == "Phishing" else "ham"
                email.classified = label

                results.append({
                    "email_id": email.id,
                    "subject": email.subject,
                    "classification": label,
                    "risk_score": ml_data.get("risk_score")
                })

            except Exception as e:
                results.append({
                    "email_id": email.id,
                    "error": f"ML Error: {str(e)}"
                })
        
        db.commit()
        return {"count": len(results), "results": results}
    finally:
        db.close()

@router.post("/save-classification")
def save_classification(updates: List[ClassificationUpdate]):
    """
    API 2: Saves ML output (spam/ham) back to database.
    """
    db = SessionLocal()
    try:
        updated_count = 0
        for update in updates:
            email = db.query(EmailEvent).filter(EmailEvent.id == update.email_id).first()
            if email:
                email.classified = update.classification
                updated_count += 1
        
        db.commit()
        return {"status": "success", "updated_count": updated_count}
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        db.close()

# --- Internal Automation Logic ---

def process_unclassified_logic():
    """
    Internal logic to fetch unclassified emails, hit ML, and save results.
    Used by background tasks for automatic classification.
    """
    print("DEBUG: [Classification Task] Started.")
    db = SessionLocal()
    ml_url = os.getenv("THREATTRON_EMAIL_ML_URL", "https://email-agent-c2ra.onrender.com/predict")
    
    try:
        pending = db.query(EmailEvent).filter(EmailEvent.classified == None).limit(20).all()
        print(f"DEBUG: [Classification Task] Found {len(pending or [])} pending emails.")
        if not pending:
            return 0
            
        updated_count = 0
        for email in pending:
            payload = {
                "subject": email.subject or "",
                "message": email.body or "",
                "sender": email.sender or "",
                "urls": "1" if email.has_links else "0"
            }
            try:
                print(f"DEBUG: [Classification Task] Checking ID: {email.id}")
                resp = requests.post(ml_url, json=payload, timeout=10)
                print(f"DEBUG: [Classification Task] Status: {resp.status_code}")
                if resp.status_code == 200:
                    ml_data = resp.json()
                    email.classified = "spam" if ml_data.get("classification") == "Phishing" else "ham"
                    updated_count += 1
                    print(f"DEBUG: [Classification Task] Classified ID {email.id}")
            except Exception as e:
                print(f"DEBUG: [Classification Task] Error: {str(e)}")
                continue
        
        db.commit()
        print(f"DEBUG: [Classification Task] Finished. Updated: {updated_count}")
        return updated_count
    finally:
        db.close()
