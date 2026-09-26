import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session
import bcrypt

from database import SessionLocal
from models import (
    Alert,
    AuditEvent,
    Investigation,
    InvestigationNote,
    RiskAssessment,
    SandboxAlert,
    SandboxAuditEvent,
    SandboxInvestigation,
    SandboxInvestigationNote,
    SandboxRiskCase,
    User,
)


router = APIRouter()
ACTIVE_ALERT_STATUSES = ("open", "acknowledged", "investigating")
ALERT_STATUSES = (*ACTIVE_ALERT_STATUSES, "resolved", "false_positive")
INVESTIGATION_STATUSES = ("open", "in_progress", "resolved")
basic_auth = HTTPBasic(auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_verified_actor(
    request: Request,
    credentials: Optional[HTTPBasicCredentials] = Depends(basic_auth),
    db: Session = Depends(get_db),
):
    authorization = request.headers.get("authorization")
    if not authorization:
        return None
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unsupported authorization scheme; verified HTTP Basic credentials are required",
            headers={"WWW-Authenticate": "Basic"},
        )

    user = db.query(User).filter(func.lower(User.email) == credentials.username.lower()).first()
    try:
        password_matches = user is not None and bcrypt.checkpw(
            credentials.password.encode("utf-8"),
            user.hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        password_matches = False
    if not password_matches:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid analyst credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return user


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _risk_threshold():
    try:
        threshold = float(os.getenv("RISK_ALERT_THRESHOLD", "0.4"))
        return threshold if 0 <= threshold <= 1 else 0.4
    except ValueError:
        return 0.4


def _safe_score(value):
    try:
        score = float(value)
        return score if score == score and abs(score) != float("inf") else 0.0
    except (TypeError, ValueError):
        return 0.0


def normalize_risk_score(value):
    return min(1.0, max(0.0, _safe_score(value)))


def _safe_evidence_refs(refs):
    safe_refs = []
    for ref in refs or []:
        if not isinstance(ref, dict):
            continue
        event_type, event_id = ref.get("type"), ref.get("id")
        if event_type in {"file", "process", "network", "system", "usb", "email"}:
            try:
                safe_refs.append({"type": event_type, "id": int(event_id)})
            except (TypeError, ValueError):
                continue
    return safe_refs


def _severity(score, is_threat):
    if score >= 0.9:
        return "critical"
    if score >= 0.7:
        return "high"
    if score >= 0.4 or is_threat:
        return "medium"
    return "low"


def _is_alertworthy(score, is_threat, rules):
    return score >= _risk_threshold() or is_threat or bool(rules)


def _audit(db, entity_type, entity_id, action, details, actor=None):
    db.add(AuditEvent(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        details=details,
        actor_user_id=actor.id if actor is not None else None,
        actor_email=actor.email if actor is not None else None,
    ))


def record_risk_assessment(db: Session, agent_id: str, result: dict, evidence_refs=None):
    score = normalize_risk_score(result.get("risk_score"))
    is_threat = result.get("is_threat") is True
    rules = result.get("rules_triggered")
    rules = [str(rule)[:255] for rule in rules] if isinstance(rules, list) else []
    evidence = _safe_evidence_refs(evidence_refs)

    assessment = RiskAssessment(
        agent_id=agent_id,
        risk_score=score,
        is_threat=is_threat,
        ml_score=_safe_score(result.get("ml_score")) if result.get("ml_score") is not None else None,
        rule_score=_safe_score(result.get("rule_score")) if result.get("rule_score") is not None else None,
        rules_triggered=rules,
        evidence_refs=evidence,
        result=result,
    )
    db.add(assessment)
    db.flush()

    alert = None
    if _is_alertworthy(score, is_threat, rules):
        signature = json.dumps(sorted(rules), separators=(",", ":"), ensure_ascii=True)
        rule_signature = signature if rules else ("threat" if is_threat else "risk-threshold")
        evidence_signature = json.dumps(
            sorted((ref["type"], ref["id"]) for ref in evidence),
            separators=(",", ":"),
        )
        fingerprint = hashlib.sha256(
            f"{agent_id}|{rule_signature}|{evidence_signature}".encode("utf-8")
        ).hexdigest()
        previous_alert = db.query(Alert).filter(
            Alert.agent_id == agent_id,
            Alert.fingerprint == fingerprint,
        ).order_by(Alert.id.desc()).first()
        alert = previous_alert if previous_alert and previous_alert.status in ACTIVE_ALERT_STATUSES else None

        now = _now()
        title = ("Risk indicators: " + ", ".join(rules[:3])) if rules else "Elevated risk score"
        if previous_alert is None:
            alert = Alert(
                fingerprint=fingerprint,
                agent_id=agent_id,
                title=title[:255],
                severity=_severity(score, is_threat),
                risk_score=score,
                status="open",
                false_positive=False,
                evidence_refs=evidence,
                latest_assessment_id=assessment.id,
                created_at=now,
                updated_at=now,
                last_seen_at=now,
            )
            db.add(alert)
            db.flush()
            _audit(db, "alert", alert.id, "created", {
                "risk_score": score,
                "severity": alert.severity,
                "evidence_refs": evidence,
            })
        elif alert is not None:
            alert.risk_score = score
            alert.severity = _severity(score, is_threat)
            alert.evidence_refs = evidence
            alert.latest_assessment_id = assessment.id
            alert.last_seen_at = now
            alert.updated_at = now

    db.commit()
    db.refresh(assessment)
    if alert is not None:
        db.refresh(alert)
    return assessment, alert


def _alert_response(alert):
    return {
        "id": alert.id,
        "agent_id": alert.agent_id,
        "title": alert.title,
        "severity": alert.severity,
        "risk_score": alert.risk_score,
        "status": alert.status,
        "false_positive": alert.false_positive,
        "feedback": alert.feedback,
        "evidence_refs": alert.evidence_refs or [],
        "latest_assessment_id": alert.latest_assessment_id,
        "created_at": alert.created_at,
        "updated_at": alert.updated_at,
        "last_seen_at": alert.last_seen_at,
    }


class AlertStatusUpdate(BaseModel):
    status: Literal["open", "acknowledged", "investigating", "resolved", "false_positive"]
    note: Optional[str] = Field(default=None, max_length=4000)


class AlertFeedback(BaseModel):
    verdict: Literal["false_positive", "confirmed"]
    note: Optional[str] = Field(default=None, max_length=4000)


class InvestigationCreate(BaseModel):
    alert_id: int
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)


class InvestigationStatusUpdate(BaseModel):
    status: Optional[Literal["open", "in_progress", "resolved"]] = None
    note: Optional[str] = Field(default=None, max_length=4000)
    analyst_note: Optional[str] = Field(default=None, min_length=1, max_length=10000)


class InvestigationNoteCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)


class SandboxCaseCreate(BaseModel):
    scenario: Literal["low", "medium", "high", "critical", "custom"] = "high"
    agent_id: str = Field(default="sandbox-endpoint", min_length=1, max_length=50)
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    risk_score: Optional[float] = Field(default=None, ge=0, le=1)
    is_threat: Optional[bool] = None
    rules_triggered: Optional[list[str]] = None


class SandboxAlertStatusUpdate(BaseModel):
    status: Optional[Literal["open", "acknowledged", "investigating", "resolved", "false_positive"]] = None
    note: Optional[str] = Field(default=None, max_length=4000)
    false_positive: Optional[bool] = None


class SandboxAlertFeedback(BaseModel):
    verdict: Literal["false_positive", "confirmed"]
    note: Optional[str] = Field(default=None, max_length=4000)


class SandboxInvestigationCreate(BaseModel):
    alert_id: int
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)


class SandboxInvestigationStatusUpdate(BaseModel):
    status: Optional[Literal["open", "in_progress", "resolved"]] = None
    note: Optional[str] = Field(default=None, max_length=4000)
    analyst_note: Optional[str] = Field(default=None, min_length=1, max_length=10000)


class SandboxInvestigationNoteCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)


SANDBOX_SCENARIOS = {
    "low": (0.25, False, []),
    "medium": (0.55, False, ["unusual_activity"]),
    "high": (0.82, True, ["suspicious_process", "unusual_network_connection"]),
    "critical": (0.97, True, ["credential_theft", "command_and_control"]),
}


def _sandbox_audit(db, entity_type, entity_id, action, details, actor=None):
    db.add(SandboxAuditEvent(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        details={**details, "is_simulation": True},
        actor_user_id=actor.id if actor is not None else None,
        actor_email=actor.email if actor is not None else None,
        is_simulation=True,
    ))


def _sandbox_alert_response(alert):
    return {
        "id": alert.id,
        "case_id": alert.case_id,
        "title": alert.title,
        "severity": alert.severity,
        "risk_score": alert.risk_score,
        "status": alert.status,
        "false_positive": alert.false_positive,
        "feedback": alert.feedback,
        "is_simulation": True,
        "created_at": alert.created_at,
        "updated_at": alert.updated_at,
    }


def _sandbox_case_response(db, case):
    alert = db.query(SandboxAlert).filter(SandboxAlert.case_id == case.id).order_by(SandboxAlert.id.desc()).first()
    return {
        "id": case.id,
        "agent_id": case.agent_id,
        "title": case.title,
        "risk_score": case.risk_score,
        "is_threat": case.is_threat,
        "rules_triggered": case.rules_triggered or [],
        "evidence_refs": [],
        "timeline": [{
            "id": event.id,
            "entity_type": event.entity_type,
            "entity_id": event.entity_id,
            "action": event.action,
            "details": event.details or {},
            "actor_user_id": event.actor_user_id,
            "actor_email": event.actor_email,
            "is_simulation": True,
            "created_at": event.created_at,
        } for event in db.query(SandboxAuditEvent).filter(
            (SandboxAuditEvent.entity_type == "risk_case")
            & (SandboxAuditEvent.entity_id == case.id)
        ).order_by(SandboxAuditEvent.id.asc()).all()],
        "is_simulation": True,
        "created_at": case.created_at,
        "alert": _sandbox_alert_response(alert) if alert else None,
    }


def _sandbox_investigation_response(db, investigation):
    alert = db.get(SandboxAlert, investigation.alert_id)
    notes = db.query(SandboxInvestigationNote).filter(
        SandboxInvestigationNote.investigation_id == investigation.id
    ).order_by(SandboxInvestigationNote.id.asc()).all()
    audit_events = db.query(SandboxAuditEvent).filter(
        (SandboxAuditEvent.entity_type == "investigation")
        & (SandboxAuditEvent.entity_id == investigation.id)
    ).order_by(SandboxAuditEvent.id.asc()).all()
    if alert is not None:
        related_audit = db.query(SandboxAuditEvent).filter(
            ((SandboxAuditEvent.entity_type == "alert") & (SandboxAuditEvent.entity_id == alert.id))
            | ((SandboxAuditEvent.entity_type == "risk_case") & (SandboxAuditEvent.entity_id == alert.case_id))
        ).order_by(SandboxAuditEvent.id.asc()).all()
        audit_events.extend(related_audit)
    timeline = sorted(audit_events, key=lambda event: event.id)
    analyst_notes = [{
        "id": note.id,
        "body": note.body,
        "is_simulation": True,
        "created_at": note.created_at,
    } for note in notes]
    return {
        "id": investigation.id,
        "alert_id": investigation.alert_id,
        "title": investigation.title,
        "status": investigation.status,
        "is_simulation": True,
        "created_at": investigation.created_at,
        "updated_at": investigation.updated_at,
        "alert": _sandbox_alert_response(alert) if alert else None,
        "evidence_refs": [],
        "notes": analyst_notes,
        "analyst_notes": analyst_notes,
        "timeline": [{
            "id": event.id,
            "entity_type": event.entity_type,
            "entity_id": event.entity_id,
            "action": event.action,
            "details": event.details or {},
            "actor_user_id": event.actor_user_id,
            "actor_email": event.actor_email,
            "is_simulation": True,
            "created_at": event.created_at,
        } for event in timeline],
    }


@router.post("/sandbox/cases", status_code=201)
def generate_sandbox_case(
    payload: SandboxCaseCreate,
    db: Session = Depends(get_db),
    actor: Optional[User] = Depends(get_verified_actor),
):
    default_score, default_threat, default_rules = SANDBOX_SCENARIOS.get(
        payload.scenario, (0.78, False, [])
    )
    score = payload.risk_score if payload.risk_score is not None else default_score
    is_threat = payload.is_threat if payload.is_threat is not None else default_threat
    rules = payload.rules_triggered if payload.rules_triggered is not None else default_rules
    rules = [rule[:255] for rule in rules[:20]]
    now = _now()
    title = payload.title or f"Simulated {payload.scenario} risk case"
    case = SandboxRiskCase(
        agent_id=payload.agent_id,
        title=title,
        risk_score=score,
        is_threat=is_threat,
        rules_triggered=rules,
        is_simulation=True,
        created_at=now,
    )
    db.add(case)
    db.flush()
    _sandbox_audit(db, "risk_case", case.id, "generated", {
        "scenario": payload.scenario,
        "risk_score": score,
        "is_threat": is_threat,
        "rules_triggered": rules,
    }, actor)

    if _is_alertworthy(score, is_threat, rules):
        alert = SandboxAlert(
            case_id=case.id,
            title=title,
            severity=_severity(score, is_threat),
            risk_score=score,
            status="open",
            false_positive=False,
            is_simulation=True,
            created_at=now,
            updated_at=now,
        )
        db.add(alert)
        db.flush()
        _sandbox_audit(db, "alert", alert.id, "created", {
            "case_id": case.id,
            "risk_score": score,
            "severity": alert.severity,
        }, actor)
    db.commit()
    db.refresh(case)
    return _sandbox_case_response(db, case)


@router.get("/sandbox/cases")
def list_sandbox_cases(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    cases = db.query(SandboxRiskCase).order_by(
        SandboxRiskCase.created_at.desc(), SandboxRiskCase.id.desc()
    ).offset(offset).limit(limit).all()
    return {
        "cases": [_sandbox_case_response(db, case) for case in cases],
        "is_simulation": True,
        "limit": limit,
        "offset": offset,
    }


@router.get("/sandbox/overview")
def sandbox_overview(db: Session = Depends(get_db)):
    return {
        "is_simulation": True,
        "risk_cases": db.query(func.count(SandboxRiskCase.id)).scalar() or 0,
        "alerts": db.query(func.count(SandboxAlert.id)).scalar() or 0,
        "open_alerts": db.query(func.count(SandboxAlert.id)).filter(
            SandboxAlert.status.in_(ACTIVE_ALERT_STATUSES)
        ).scalar() or 0,
        "investigations": db.query(func.count(SandboxInvestigation.id)).scalar() or 0,
        "open_investigations": db.query(func.count(SandboxInvestigation.id)).filter(
            SandboxInvestigation.status != "resolved"
        ).scalar() or 0,
    }


@router.get("/sandbox/alerts")
def list_sandbox_alerts(
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(SandboxAlert)
    if status:
        if status not in ALERT_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid sandbox alert status")
        query = query.filter(SandboxAlert.status == status)
    alerts = query.order_by(SandboxAlert.updated_at.desc(), SandboxAlert.id.desc())\
        .offset(offset).limit(limit).all()
    return {
        "alerts": [_sandbox_alert_response(alert) for alert in alerts],
        "is_simulation": True,
        "limit": limit,
        "offset": offset,
    }


@router.patch("/sandbox/alerts/{alert_id}")
def update_sandbox_alert(
    alert_id: int,
    update: SandboxAlertStatusUpdate,
    db: Session = Depends(get_db),
    actor: Optional[User] = Depends(get_verified_actor),
):
    alert = db.get(SandboxAlert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Sandbox alert not found")
    if update.status is None and update.false_positive is None and update.note is None:
        raise HTTPException(status_code=422, detail="Provide status, false_positive, or note")
    previous = {"status": alert.status, "false_positive": alert.false_positive}
    if update.status is not None:
        alert.status = update.status
        alert.false_positive = update.status == "false_positive"
    elif update.false_positive is not None:
        alert.false_positive = update.false_positive
        alert.status = "false_positive" if update.false_positive else (
            "acknowledged" if alert.status == "false_positive" else alert.status
        )
    if update.note is not None:
        alert.feedback = update.note
    alert.updated_at = _now()
    _sandbox_audit(db, "alert", alert.id, "status_changed", {
        "from": previous,
        "to": {"status": alert.status, "false_positive": alert.false_positive},
        "note": update.note,
    }, actor)
    db.commit()
    db.refresh(alert)
    return _sandbox_alert_response(alert)


@router.post("/sandbox/alerts/{alert_id}/feedback")
def sandbox_alert_feedback(
    alert_id: int,
    feedback: SandboxAlertFeedback,
    db: Session = Depends(get_db),
    actor: Optional[User] = Depends(get_verified_actor),
):
    alert = db.get(SandboxAlert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Sandbox alert not found")
    previous = {"status": alert.status, "false_positive": alert.false_positive}
    alert.false_positive = feedback.verdict == "false_positive"
    alert.feedback = feedback.note
    alert.status = "false_positive" if alert.false_positive else "acknowledged"
    alert.updated_at = _now()
    _sandbox_audit(db, "alert", alert.id, "feedback_recorded", {
        "from": previous,
        "verdict": feedback.verdict,
        "note": feedback.note,
        "to_status": alert.status,
    }, actor)
    db.commit()
    db.refresh(alert)
    return _sandbox_alert_response(alert)


@router.post("/sandbox/investigations", status_code=201)
def create_sandbox_investigation(
    payload: SandboxInvestigationCreate,
    db: Session = Depends(get_db),
    actor: Optional[User] = Depends(get_verified_actor),
):
    alert = db.get(SandboxAlert, payload.alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Sandbox alert not found")
    now = _now()
    investigation = SandboxInvestigation(
        alert_id=alert.id,
        title=payload.title or alert.title,
        status="open",
        is_simulation=True,
        created_at=now,
        updated_at=now,
    )
    db.add(investigation)
    db.flush()
    _sandbox_audit(db, "investigation", investigation.id, "created", {"alert_id": alert.id}, actor)
    previous = alert.status
    alert.status = "investigating"
    alert.updated_at = now
    _sandbox_audit(db, "alert", alert.id, "status_changed", {
        "from": previous, "to": "investigating", "investigation_id": investigation.id,
    }, actor)
    db.commit()
    db.refresh(investigation)
    return _sandbox_investigation_response(db, investigation)


@router.get("/sandbox/investigations")
def list_sandbox_investigations(
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(SandboxInvestigation)
    if status:
        if status not in INVESTIGATION_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid sandbox investigation status")
        query = query.filter(SandboxInvestigation.status == status)
    investigations = query.order_by(SandboxInvestigation.updated_at.desc(), SandboxInvestigation.id.desc())\
        .offset(offset).limit(limit).all()
    return {
        "investigations": [_sandbox_investigation_response(db, item) for item in investigations],
        "is_simulation": True,
        "limit": limit,
        "offset": offset,
    }


@router.patch("/sandbox/investigations/{investigation_id}")
def update_sandbox_investigation(
    investigation_id: int,
    update: SandboxInvestigationStatusUpdate,
    db: Session = Depends(get_db),
    actor: Optional[User] = Depends(get_verified_actor),
):
    investigation = db.get(SandboxInvestigation, investigation_id)
    if investigation is None:
        raise HTTPException(status_code=404, detail="Sandbox investigation not found")
    if update.status is None and update.note is None and update.analyst_note is None:
        raise HTTPException(status_code=422, detail="Provide status, note, or analyst_note")
    previous = investigation.status
    if update.status is not None:
        investigation.status = update.status
    investigation.updated_at = _now()
    if update.status is not None:
        _sandbox_audit(db, "investigation", investigation.id, "status_changed", {
            "from": previous, "to": update.status, "note": update.note,
        }, actor)
    if update.analyst_note is not None:
        _append_sandbox_investigation_note(db, investigation, update.analyst_note, actor)
    elif update.note is not None and update.status is None:
        _append_sandbox_investigation_note(db, investigation, update.note, actor)
    db.commit()
    db.refresh(investigation)
    return _sandbox_investigation_response(db, investigation)


@router.post("/sandbox/investigations/{investigation_id}/notes", status_code=201)
def add_sandbox_investigation_note(
    investigation_id: int,
    payload: SandboxInvestigationNoteCreate,
    db: Session = Depends(get_db),
    actor: Optional[User] = Depends(get_verified_actor),
):
    investigation = db.get(SandboxInvestigation, investigation_id)
    if investigation is None:
        raise HTTPException(status_code=404, detail="Sandbox investigation not found")
    note = _append_sandbox_investigation_note(db, investigation, payload.body, actor)
    db.commit()
    db.refresh(note)
    return {
        "id": note.id,
        "investigation_id": note.investigation_id,
        "body": note.body,
        "is_simulation": True,
        "created_at": note.created_at,
    }


def _append_sandbox_investigation_note(db, investigation, body, actor=None):
    body = body.strip()
    if not body:
        raise HTTPException(status_code=422, detail="Note cannot be blank")
    note = SandboxInvestigationNote(
        investigation_id=investigation.id,
        body=body,
        is_simulation=True,
        created_at=_now(),
    )
    db.add(note)
    db.flush()
    investigation.updated_at = note.created_at
    _sandbox_audit(db, "investigation", investigation.id, "note_added", {
        "note_id": note.id,
        "body": note.body,
    }, actor)
    return note


@router.get("/sandbox/investigations/{investigation_id}")
def get_sandbox_investigation(investigation_id: int, db: Session = Depends(get_db)):
    investigation = db.get(SandboxInvestigation, investigation_id)
    if investigation is None:
        raise HTTPException(status_code=404, detail="Sandbox investigation not found")
    return _sandbox_investigation_response(db, investigation)


@router.get("/sandbox/audit")
def list_sandbox_audit_events(
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(SandboxAuditEvent)
    if entity_type:
        query = query.filter(SandboxAuditEvent.entity_type == entity_type)
    if entity_id is not None:
        query = query.filter(SandboxAuditEvent.entity_id == entity_id)
    events = query.order_by(SandboxAuditEvent.id.desc()).offset(offset).limit(limit).all()
    return {
        "events": [{
            "id": event.id,
            "entity_type": event.entity_type,
            "entity_id": event.entity_id,
            "action": event.action,
            "details": event.details or {},
            "actor_user_id": event.actor_user_id,
            "actor_email": event.actor_email,
            "is_simulation": True,
            "created_at": event.created_at,
        } for event in events],
        "is_simulation": True,
        "limit": limit,
        "offset": offset,
    }


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    return {
        "alerts": db.query(func.count(Alert.id)).scalar() or 0,
        "open_alerts": db.query(func.count(Alert.id)).filter(Alert.status.in_(ACTIVE_ALERT_STATUSES)).scalar() or 0,
        "investigations": db.query(func.count(Investigation.id)).filter(
            Investigation.status != "resolved"
        ).scalar() or 0,
        "risk_assessments": db.query(func.count(RiskAssessment.id)).scalar() or 0,
        "by_severity": {
            severity: db.query(func.count(Alert.id)).filter(Alert.severity == severity).scalar() or 0
            for severity in ("critical", "high", "medium", "low")
        },
    }


@router.get("/alerts")
def list_alerts(
    status: Optional[str] = Query(None),
    agent_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Alert)
    if status:
        if status not in ALERT_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid alert status")
        query = query.filter(Alert.status == status)
    if agent_id:
        query = query.filter(Alert.agent_id == agent_id)
    alerts = query.order_by(Alert.last_seen_at.desc(), Alert.id.desc()).offset(offset).limit(limit).all()
    return {"alerts": [_alert_response(alert) for alert in alerts], "limit": limit, "offset": offset}


@router.get("/alerts/{alert_id}")
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return _alert_response(alert)


@router.patch("/alerts/{alert_id}")
def update_alert(
    alert_id: int,
    update: AlertStatusUpdate,
    db: Session = Depends(get_db),
    actor: Optional[User] = Depends(get_verified_actor),
):
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    previous = alert.status
    alert.status = update.status
    alert.false_positive = update.status == "false_positive"
    if update.note is not None:
        alert.feedback = update.note
    alert.updated_at = _now()
    _audit(db, "alert", alert.id, "status_changed", {
        "from": previous, "to": alert.status, "note": update.note,
    }, actor)
    db.commit()
    db.refresh(alert)
    return _alert_response(alert)


@router.post("/alerts/{alert_id}/feedback")
def alert_feedback(
    alert_id: int,
    feedback: AlertFeedback,
    db: Session = Depends(get_db),
    actor: Optional[User] = Depends(get_verified_actor),
):
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    previous = {"false_positive": alert.false_positive, "status": alert.status}
    alert.false_positive = feedback.verdict == "false_positive"
    alert.feedback = feedback.note
    alert.status = "false_positive" if alert.false_positive else "acknowledged"
    alert.updated_at = _now()
    _audit(db, "alert", alert.id, "feedback_recorded", {
        "from": previous,
        "verdict": feedback.verdict,
        "note": feedback.note,
        "to_status": alert.status,
    }, actor)
    db.commit()
    db.refresh(alert)
    return _alert_response(alert)


@router.get("/risk-assessments")
def list_risk_assessments(
    agent_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(RiskAssessment)
    if agent_id:
        query = query.filter(RiskAssessment.agent_id == agent_id)
    assessments = query.order_by(RiskAssessment.created_at.desc(), RiskAssessment.id.desc())\
        .offset(offset).limit(limit).all()
    return {"risk_assessments": [{
        "id": item.id,
        "agent_id": item.agent_id,
        "risk_score": item.risk_score,
        "is_threat": item.is_threat,
        "ml_score": item.ml_score,
        "rule_score": item.rule_score,
        "rules_triggered": item.rules_triggered or [],
        "evidence_refs": item.evidence_refs or [],
        "result": item.result,
        "created_at": item.created_at,
    } for item in assessments], "limit": limit, "offset": offset}


@router.post("/investigations", status_code=201)
def create_investigation(
    payload: InvestigationCreate,
    db: Session = Depends(get_db),
    actor: Optional[User] = Depends(get_verified_actor),
):
    alert = db.get(Alert, payload.alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    now = _now()
    investigation = Investigation(
        alert_id=alert.id,
        title=payload.title or alert.title,
        status="open",
        created_at=now,
        updated_at=now,
    )
    db.add(investigation)
    db.flush()
    _audit(db, "investigation", investigation.id, "created", {"alert_id": alert.id}, actor)
    previous = alert.status
    alert.status = "investigating"
    alert.updated_at = now
    _audit(db, "alert", alert.id, "status_changed", {
        "from": previous, "to": "investigating", "investigation_id": investigation.id,
    }, actor)
    db.commit()
    db.refresh(investigation)
    return _investigation_response(db, investigation)


def _investigation_response(db, investigation):
    alert = db.get(Alert, investigation.alert_id)
    notes = db.query(InvestigationNote).filter(
        InvestigationNote.investigation_id == investigation.id
    ).order_by(InvestigationNote.id.asc()).all()
    analyst_notes = [{
        "id": note.id,
        "body": note.body,
        "created_at": note.created_at,
    } for note in notes]
    audit_query = db.query(AuditEvent).filter(
        (AuditEvent.entity_type == "investigation")
        & (AuditEvent.entity_id == investigation.id)
    )
    if alert is not None:
        audit_query = db.query(AuditEvent).filter(
            ((AuditEvent.entity_type == "investigation") & (AuditEvent.entity_id == investigation.id))
            | ((AuditEvent.entity_type == "alert") & (AuditEvent.entity_id == alert.id))
        )
    events = audit_query.order_by(AuditEvent.id.asc()).all()
    return {
        "id": investigation.id,
        "alert_id": investigation.alert_id,
        "title": investigation.title,
        "status": investigation.status,
        "created_at": investigation.created_at,
        "updated_at": investigation.updated_at,
        "alert": _alert_response(alert) if alert else None,
        "evidence_refs": alert.evidence_refs or [] if alert else [],
        "notes": analyst_notes,
        "analyst_notes": analyst_notes,
        "timeline": [{
            "id": event.id,
            "entity_type": event.entity_type,
            "entity_id": event.entity_id,
            "action": event.action,
            "details": event.details or {},
            "actor_user_id": event.actor_user_id,
            "actor_email": event.actor_email,
            "created_at": event.created_at,
        } for event in events],
    }


@router.get("/investigations")
def list_investigations(
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Investigation)
    if status:
        if status not in INVESTIGATION_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid investigation status")
        query = query.filter(Investigation.status == status)
    results = query.order_by(Investigation.updated_at.desc(), Investigation.id.desc())\
        .offset(offset).limit(limit).all()
    return {
        "investigations": [_investigation_response(db, item) for item in results],
        "limit": limit,
        "offset": offset,
    }


@router.get("/investigations/{investigation_id}")
def get_investigation(investigation_id: int, db: Session = Depends(get_db)):
    investigation = db.get(Investigation, investigation_id)
    if investigation is None:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return _investigation_response(db, investigation)


@router.get("/investigations/{investigation_id}/timeline")
def get_investigation_timeline(investigation_id: int, db: Session = Depends(get_db)):
    investigation = db.get(Investigation, investigation_id)
    if investigation is None:
        raise HTTPException(status_code=404, detail="Investigation not found")
    response = _investigation_response(db, investigation)
    return {
        "investigation_id": investigation.id,
        "timeline": response["timeline"],
        "evidence_refs": response["evidence_refs"],
    }


@router.patch("/investigations/{investigation_id}")
def update_investigation(
    investigation_id: int,
    update: InvestigationStatusUpdate,
    db: Session = Depends(get_db),
    actor: Optional[User] = Depends(get_verified_actor),
):
    investigation = db.get(Investigation, investigation_id)
    if investigation is None:
        raise HTTPException(status_code=404, detail="Investigation not found")
    if update.status is None and update.note is None and update.analyst_note is None:
        raise HTTPException(status_code=422, detail="Provide status, note, or analyst_note")
    previous = investigation.status
    if update.status is not None:
        investigation.status = update.status
    investigation.updated_at = _now()
    if update.status is not None:
        _audit(db, "investigation", investigation.id, "status_changed", {
            "from": previous, "to": update.status, "note": update.note,
        }, actor)
    if update.analyst_note is not None:
        _append_investigation_note(db, investigation, update.analyst_note, actor)
    elif update.note is not None and update.status is None:
        _append_investigation_note(db, investigation, update.note, actor)
    db.commit()
    db.refresh(investigation)
    return _investigation_response(db, investigation)


@router.post("/investigations/{investigation_id}/notes", status_code=201)
def add_investigation_note(
    investigation_id: int,
    payload: InvestigationNoteCreate,
    db: Session = Depends(get_db),
    actor: Optional[User] = Depends(get_verified_actor),
):
    investigation = db.get(Investigation, investigation_id)
    if investigation is None:
        raise HTTPException(status_code=404, detail="Investigation not found")
    note = _append_investigation_note(db, investigation, payload.body, actor)
    db.commit()
    db.refresh(note)
    return {"id": note.id, "investigation_id": note.investigation_id, "body": note.body, "created_at": note.created_at}


def _append_investigation_note(db, investigation, body, actor=None):
    body = body.strip()
    if not body:
        raise HTTPException(status_code=422, detail="Note cannot be blank")
    note = InvestigationNote(
        investigation_id=investigation.id,
        body=body,
        created_at=_now(),
    )
    db.add(note)
    db.flush()
    investigation.updated_at = note.created_at
    _audit(db, "investigation", investigation.id, "note_added", {
        "note_id": note.id,
        "body": note.body,
    }, actor)
    return note


@router.get("/audit")
def list_audit_events(
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(AuditEvent)
    if entity_type:
        query = query.filter(AuditEvent.entity_type == entity_type)
    if entity_id is not None:
        query = query.filter(AuditEvent.entity_id == entity_id)
    events = query.order_by(AuditEvent.id.desc()).offset(offset).limit(limit).all()
    return {"events": [{
        "id": event.id,
        "entity_type": event.entity_type,
        "entity_id": event.entity_id,
        "action": event.action,
        "details": event.details or {},
        "actor_user_id": event.actor_user_id,
        "actor_email": event.actor_email,
        "created_at": event.created_at,
    } for event in events], "limit": limit, "offset": offset}
