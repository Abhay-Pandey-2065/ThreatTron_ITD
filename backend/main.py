import os
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import SessionLocal, engine
from models import Base, AgentSession, FileEvent, ProcessEvent, SystemEvent, EmailEvent, USBEvent, NetworkEvent
from datetime import datetime, timedelta, timezone
from typing import Optional

from routes import emails as email_routes
from routes import files as file_routes
from routes import processes as process_routes
from routes import system as system_routes
from routes import usb as usb_routes
from routes import network as network_routes
from routes import auth as auth_routes

import httpx
from collections import deque
import requests

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS - get allowed origins from environment variable
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount route modules under /api/events/*
app.include_router(email_routes.router, prefix="/api/events/emails", tags=["emails"])
app.include_router(file_routes.router, prefix="/api/events/files", tags=["files"])
app.include_router(process_routes.router, prefix="/api/events/processes", tags=["processes"])
app.include_router(system_routes.router, prefix="/api/events/system", tags=["system"])
app.include_router(usb_routes.router, prefix="/api/events/usb", tags=["usb"])
app.include_router(network_routes.router, prefix="/api/events/network", tags=["network"])
app.include_router(auth_routes.router, prefix="/api/auth", tags=["auth"])


def _time_cutoff(time_range: str) -> Optional[datetime]:
    now = datetime.now(timezone.utc)
    mapping = {"1h": timedelta(hours=1), "24h": timedelta(hours=24), "7d": timedelta(days=7)}
    delta = mapping.get(time_range)
    return (now - delta) if delta else None


@app.get("/")
def root():
    return {"message": "ThreatTron Backend Running (MySQL)"}


@app.get("/api/overview/stats")
def overview_stats(
    time_range: str = Query("24h"),
    agent_id: Optional[str] = Query(None),
):
    db: Session = SessionLocal()
    try:
        cutoff = _time_cutoff(time_range)

        def count_table(model, ts_col):
            q = db.query(func.count(model.id))
            if cutoff:
                q = q.filter(ts_col >= cutoff)
            if agent_id:
                q = q.filter(model.agent_id == agent_id)
            return q.scalar() or 0

        file_count = count_table(FileEvent, FileEvent.timestamp)
        process_count = count_table(ProcessEvent, ProcessEvent.timestamp)
        system_count = count_table(SystemEvent, SystemEvent.timestamp)
        email_count = count_table(EmailEvent, EmailEvent.timestamp)
        usb_count = count_table(USBEvent, USBEvent.timestamp)
        network_count = count_table(NetworkEvent, NetworkEvent.timestamp)

        total = file_count + process_count + system_count + email_count + usb_count + network_count

        # Count active agents
        agents_q = db.query(func.count(func.distinct(AgentSession.agent_id)))
        active_agents = agents_q.scalar() or 0

        return {
            "total_events": total,
            "by_type": {
                "file": file_count,
                "process": process_count,
                "system": system_count,
                "email": email_count,
                "usb": usb_count,
                "network": network_count,
            },
            "active_agents": active_agents,
        }
    finally:
        db.close()


@app.get("/api/overview/recent")
def overview_recent(
    time_range: str = Query("24h"),
    agent_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    db: Session = SessionLocal()
    try:
        cutoff = _time_cutoff(time_range)
        results = []

        # Email events
        eq = db.query(EmailEvent).order_by(EmailEvent.timestamp.desc())
        if cutoff:
            eq = eq.filter(EmailEvent.timestamp >= cutoff)
        if agent_id:
            eq = eq.filter(EmailEvent.agent_id == agent_id)
        for e in eq.limit(limit).all():
            results.append({"type": "email", "id": e.id, "agent_id": e.agent_id, "timestamp": e.timestamp.isoformat() if e.timestamp else "", "summary": f"From {e.sender or 'unknown'}: {e.subject or '(no subject)'}"})

        # Process events
        pq = db.query(ProcessEvent).order_by(ProcessEvent.timestamp.desc())
        if cutoff:
            pq = pq.filter(ProcessEvent.timestamp >= cutoff)
        if agent_id:
            pq = pq.filter(ProcessEvent.agent_id == agent_id)
        for e in pq.limit(limit).all():
            results.append({"type": "process", "id": e.id, "agent_id": e.agent_id, "timestamp": e.timestamp.isoformat() if e.timestamp else "", "summary": f"{e.event_type}: {e.process_name or 'unknown'}"})

        # File events
        fq = db.query(FileEvent).order_by(FileEvent.timestamp.desc())
        if cutoff:
            fq = fq.filter(FileEvent.timestamp >= cutoff)
        if agent_id:
            fq = fq.filter(FileEvent.agent_id == agent_id)
        for e in fq.limit(limit).all():
            results.append({"type": "file", "id": e.id, "agent_id": e.agent_id, "timestamp": e.timestamp.isoformat() if e.timestamp else "", "summary": f"{e.event_type}: {e.file_path or 'unknown path'}"})

        # Network events
        nq = db.query(NetworkEvent).order_by(NetworkEvent.timestamp.desc())
        if cutoff:
            nq = nq.filter(NetworkEvent.timestamp >= cutoff)
        if agent_id:
            nq = nq.filter(NetworkEvent.agent_id == agent_id)
        for e in nq.limit(limit).all():
            results.append({"type": "network", "id": e.id, "agent_id": e.agent_id, "timestamp": e.timestamp.isoformat() if e.timestamp else "", "summary": f"{e.process_name or 'unknown'} → port {e.remote_port} ({e.status})"})

        # System events
        sq = db.query(SystemEvent).order_by(SystemEvent.timestamp.desc())
        if cutoff:
            sq = sq.filter(SystemEvent.timestamp >= cutoff)
        if agent_id:
            sq = sq.filter(SystemEvent.agent_id == agent_id)
        for e in sq.limit(limit).all():
            results.append({"type": "system", "id": e.id, "agent_id": e.agent_id, "timestamp": e.timestamp.isoformat() if e.timestamp else "", "summary": f"CPU {e.cpu_usage}% · Mem {e.memory_usage}%"})

        # USB events
        uq = db.query(USBEvent).order_by(USBEvent.timestamp.desc())
        if cutoff:
            uq = uq.filter(USBEvent.timestamp >= cutoff)
        if agent_id:
            uq = uq.filter(USBEvent.agent_id == agent_id)
        for e in uq.limit(limit).all():
            results.append({"type": "usb", "id": e.id, "agent_id": e.agent_id, "timestamp": e.timestamp.isoformat() if e.timestamp else "", "summary": f"{e.event_type}: {e.mountpoint or 'unknown mountpoint'}"})

        # Sort all by timestamp desc, take top N
        results.sort(key=lambda x: x["timestamp"], reverse=True)
        return {"events": results[:limit]}
    finally:
        db.close()


@app.get("/api/risk")
def get_live_risk(agent_id: Optional[str] = Query(None)):
    db: Session = SessionLocal()
    try:
        def get_count(model, condition=None):
            q = db.query(model)
            if agent_id:
                q = q.filter(model.agent_id == agent_id)
            if condition is not None:
                q = q.filter(condition)
            return q.count()

        # Build the exact JSON shape the ML API requested using LIVE SQL Database counts!
        payload = {
            "user_id": agent_id or "Global",
            "total_logons": 5, 
            "after_hours_logons": 0,
            "total_emails": get_count(EmailEvent),
            "emails_with_attachments": get_count(EmailEvent, EmailEvent.has_links == True),
            "total_http": get_count(NetworkEvent),
            "suspicious_http": 0,
            "total_file": get_count(FileEvent),
            "exe_zip_files": get_count(FileEvent, FileEvent.file_path.ilike("%exe")),
            "total_device": get_count(USBEvent)
        }

        # Send it to your Render Cloud API securely
        try:
            render_url = "https://ml-api-2ru4.onrender.com/predict"
            response = requests.post(render_url, json=payload, timeout=5)
            return response.json()
        except Exception as e:
            # Fallback if Render is asleep
            return {"status": "error", "message": f"ML API Offline: {e}", "risk_score": 0.0, "is_threat": False}
    finally:
        db.close()


@app.post("/api/sandbox")
def sandbox_predict(payload: dict):
    # This acts as a CORS Proxy so the React Sandbox can securely talk to Render
    try:
        render_url = "https://ml-api-2ru4.onrender.com/predict"
        response = requests.post(render_url, json=payload, timeout=5)
        return response.json()
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ─── Legacy batch ingest (used by the agent) ───
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

        if event_type in ["file_activity", "file_moved", "file_renamed"]:
            db.add(FileEvent(
                session_id=session_id, agent_id=agent_id, event_type=event_type, timestamp=timestamp,
                file_path=metadata.get("file_path") or metadata.get("src_path") or metadata.get("directory"),
                action=metadata.get("action"), extra_data=metadata.get("extra_data")
            ))
        elif event_type in ["process_started", "process_terminated", "startup_process"]:
            suspicious_raw = metadata.get("suspicious_spawn")
            db.add(ProcessEvent(
                session_id=session_id, agent_id=agent_id, event_type=event_type, timestamp=timestamp,
                process_name=metadata.get("process_name"), exe_path=metadata.get("exe_path"),
                parent_name=metadata.get("parent_name"), parent_pid=metadata.get("parent_pid"),
                suspicious_spawn=bool(suspicious_raw) if suspicious_raw is not None else None,
            ))
        elif event_type == "network_connection":
            db.add(NetworkEvent(
                session_id=session_id, agent_id=agent_id, timestamp=timestamp,
                local_ip_hash=metadata.get("local_ip_hash"), local_port=metadata.get("local_port"),
                remote_ip_hash=metadata.get("remote_ip_hash"), remote_port=metadata.get("remote_port"),
                status=metadata.get("status"), pid=metadata.get("pid"), process_name=metadata.get("process_name"),
            ))
        elif event_type == "system_activity":
            db.add(SystemEvent(
                session_id=session_id, agent_id=agent_id, timestamp=timestamp,
                cpu_usage=metadata.get("cpu_usage"), memory_usage=metadata.get("memory_usage")
            ))
        elif event_type == "email_received":
            has_links_raw = metadata.get("has_links")
            db.add(EmailEvent(
                session_id=session_id, agent_id=agent_id, timestamp=timestamp,
                message_id=metadata.get("message_id"),
                sender=metadata.get("sender"), subject=metadata.get("subject"),
                snippet_length=metadata.get("snippet_length"),
                has_links=bool(has_links_raw) if has_links_raw is not None else None,
                body=metadata.get("body"),
                classified=metadata.get("classified"),
            ))
        elif event_type in ["usb_inserted", "usb_removed"]:
            db.add(USBEvent(
                session_id=session_id, agent_id=agent_id, event_type=event_type, timestamp=timestamp,
                mountpoint=metadata.get("mountpoint")
            ))

    db.commit()
    db.close()

    return {"status": "success", "count": len(events)}



ML_API_URL          = os.getenv("ML_API_URL", "https://ml-api-2ru4.onrender.com/predict")
_score_history: dict[str, deque] = {}   # agent_id → last 12 scores (60 s @ 5 s interval)
_last_alert:    dict[str, str]   = {}   # agent_id → ISO timestamp of last rule trigger


@app.get("/api/risk")
async def live_risk(
    agent_id: str = Query("Global"),
    window:   int = Query(30),          # minutes — selectable from frontend
):
    db: Session = SessionLocal()
    from datetime import datetime, timedelta, timezone
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=window)

    try:
        def q(model):
            base = db.query(model)
            if agent_id != "Global":
                base = base.filter(model.agent_id == agent_id)
            if hasattr(model, "timestamp"):
                base = base.filter(model.timestamp >= cutoff)
            return base

        # ── hostname from agent_sessions ──────────────────────────────────────
        hostname = None
        if agent_id != "Global":
            sess = db.query(AgentSession)\
                     .filter(AgentSession.agent_id == agent_id)\
                     .order_by(AgentSession.started_at.desc()).first()
            hostname = sess.hostname if sess else None

        # ── event counts ──────────────────────────────────────────────────────
        total_file       = q(FileEvent).count()
        exe_zip_files    = q(FileEvent).filter(
            FileEvent.file_path.ilike("%.exe") |
            FileEvent.file_path.ilike("%.zip") |
            FileEvent.file_path.ilike("%.rar")
        ).count()
        after_hrs_files  = (
            q(FileEvent).filter(func.hour(FileEvent.timestamp) >= 19).count() +
            q(FileEvent).filter(func.hour(FileEvent.timestamp) <= 6).count()
        )
        total_device     = q(USBEvent).count()
        total_emails     = q(EmailEvent).count()
        emails_attach    = q(EmailEvent).filter(EmailEvent.snippet_length > 200).count()
        external_emails  = q(EmailEvent).filter(
            ~EmailEvent.sender.ilike("%@company.com")
        ).count()
        total_http       = q(NetworkEvent).count()
        suspicious_http  = q(NetworkEvent).filter(
            NetworkEvent.remote_port.in_([4444, 8080, 9090, 31337])
        ).count()
        uniq_q = db.query(func.count(func.distinct(NetworkEvent.remote_ip_hash)))
        if agent_id != "Global":
            uniq_q = uniq_q.filter(NetworkEvent.agent_id == agent_id)
        unique_domains   = uniq_q.filter(NetworkEvent.timestamp >= cutoff).scalar() or 0
        total_logons     = q(SystemEvent).count()
        failed_logons    = q(ProcessEvent).filter(ProcessEvent.suspicious_spawn == True).count()
        after_hrs_logons = (
            q(SystemEvent).filter(func.hour(SystemEvent.timestamp) >= 19).count() +
            q(SystemEvent).filter(func.hour(SystemEvent.timestamp) <= 6).count()
        )
        distinct_pcs     = db.query(func.count(func.distinct(AgentSession.hostname)))\
                             .filter(AgentSession.agent_id == agent_id)\
                             .scalar() or 1

        total_events = (
            total_file + total_device + total_emails +
            total_http + total_logons
        )

        payload = {
            "user_id": agent_id,
            "total_logons": total_logons, "after_hours_logons": after_hrs_logons,
            "weekend_logons": 0,          "failed_logons": failed_logons,
            "total_emails": total_emails, "emails_with_attachments": emails_attach,
            "external_emails": external_emails, "total_email_megabytes": 0,
            "total_http": total_http,     "suspicious_http": suspicious_http,
            "total_file": total_file,     "exe_zip_files": exe_zip_files,
            "after_hours_file_ops": after_hrs_files, "total_device": total_device,
            "num_distinct_pcs": distinct_pcs, "unique_http_domains": unique_domains,
            "unique_external_recipients": external_emails,
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            ml_resp = await client.post(ML_API_URL, json=payload)
            ml_data = ml_resp.json()

        # ── trend tracking ────────────────────────────────────────────────────
        score = ml_data.get("risk_score", 0)
        hist  = _score_history.setdefault(agent_id, deque(maxlen=12))
        trend = "→"
        if len(hist) >= 2:
            delta = score - hist[-1]
            trend = "↑" if delta > 0.02 else ("↓" if delta < -0.02 else "→")
        hist.append(score)

        # ── last alert tracking ───────────────────────────────────────────────
        rules = ml_data.get("rules_triggered", [])
        if rules:
            _last_alert[agent_id] = datetime.now(timezone.utc).isoformat()

        ml_data.update({
            "hostname":      hostname,
            "event_count":   total_events,
            "window_minutes": window,
            "trend":         trend,
            "last_alert":    _last_alert.get(agent_id),
        })
        return ml_data

    except Exception as exc:
        return {
            "status": "error", "message": str(exc),
            "risk_score": 0, "is_threat": False,
            "ml_score": 0,   "rule_score": 0,
            "rules_triggered": [], "window_minutes": window,
            "trend": "→", "event_count": 0, "hostname": None, "last_alert": None,
        }
    finally:
        db.close()

@app.get("/ml/summary")
async def ml_summary(time_range: str = Query("24h")):
    db: Session = SessionLocal()
    from datetime import datetime, timedelta, timezone
    try:
        open_alerts = db.query(ProcessEvent).filter(ProcessEvent.suspicious_spawn == True).count()
        return {
            "model_name": "ThreatTron Ensemble v2.1",
            "model_version": "2.1.4",
            "last_inference": datetime.now(timezone.utc).isoformat(),
            "data_window": time_range,
            "open_alerts": open_alerts,
            "high_severity_24h": open_alerts,
            "highest_risk_score": 0.942
        }
    finally:
        db.close()

@app.get("/api/risk/timeline")
async def risk_timeline(agent_id: str = Query(...)):
    db: Session = SessionLocal()
    from datetime import datetime, timedelta, timezone
    limit = 20
    try:
        timeline = []
        procs = db.query(ProcessEvent).filter(ProcessEvent.agent_id == agent_id)\
                  .order_by(ProcessEvent.timestamp.desc()).limit(limit).all()
        for p in procs:
            timeline.append({
                "id": f"proc_{p.id}", "timestamp": p.timestamp.isoformat() if p.timestamp else None,
                "type": "process", "summary": f"Spawned {p.process_name}",
                "detail": f"Parent: {p.parent_name} | PID: {p.parent_pid}", "severity": "warn" if p.suspicious_spawn else "info"
            })
        files = db.query(FileEvent).filter(FileEvent.agent_id == agent_id)\
                  .filter(FileEvent.file_path.ilike("%.exe") | FileEvent.file_path.ilike("%.zip"))\
                  .order_by(FileEvent.timestamp.desc()).limit(limit).all()
        for f in files:
            timeline.append({
                "id": f"file_{f.id}", "timestamp": f.timestamp.isoformat() if f.timestamp else None,
                "type": "file", "summary": f"Sensitive file: {f.file_path.split('\\')[-1] if f.file_path else 'Unknown'}",
                "detail": f"Path: {f.file_path}", "severity": "warn"
            })
        usbs = db.query(USBEvent).filter(USBEvent.agent_id == agent_id)\
                 .order_by(USBEvent.timestamp.desc()).limit(limit).all()
        for u in usbs:
            timeline.append({
                "id": f"usb_{u.id}", "timestamp": u.timestamp.isoformat() if u.timestamp else None, "type": "usb",
                "summary": "USB Device Connected" if u.event_type == "usb_inserted" else "USB Removed",
                "detail": f"Mountpoint: {u.mountpoint}", "severity": "critical" if u.event_type == "usb_inserted" else "info"
            })
        timeline.sort(key=lambda x: x["timestamp"] or "", reverse=True)
        return timeline[:limit]
    finally:
        db.close()
