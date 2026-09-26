from sqlalchemy import Boolean, Column, Integer, String, DateTime, Float, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship, declared_attr
from database import Base
from datetime import datetime, timezone


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AgentSession(Base):
    __tablename__ = "agent_sessions"

    session_id = Column(String(36), primary_key=True)
    agent_id = Column(String(50), nullable=False, index=True)
    hostname = Column(String(255), nullable=True)
    mac_address = Column(String(17), nullable=True)
    started_at = Column(DateTime, nullable=False)

    file_events = relationship("FileEvent", back_populates="session")
    process_events = relationship("ProcessEvent", back_populates="session")
    system_events = relationship("SystemEvent", back_populates="session")
    usb_events = relationship("USBEvent", back_populates="session")
    email_events = relationship("EmailEvent", back_populates="session")
    network_events = relationship("NetworkEvent", back_populates="session")

class SessionMixin:

    @declared_attr
    def session_id(cls): 
        return Column(
            String(36),
            ForeignKey("agent_sessions.session_id", ondelete="CASCADE"),
            nullable=False,
            index=True
        )
    
    @declared_attr
    def agent_id(cls):
        return Column(String(50), nullable=False, index=True)

class FileEvent(SessionMixin, Base):
    __tablename__ = "file_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # agent_id = Column(String(255), index=True)
    event_type = Column(String(100))
    timestamp = Column(DateTime)
    file_path = Column(String(1000))
    action = Column(String(100))
    extra_data = Column(JSON)
    session = relationship("AgentSession", back_populates="file_events")


class ProcessEvent(SessionMixin, Base):
    __tablename__ = "process_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # agent_id = Column(String(255), index=True)
    event_type = Column(String(100))
    timestamp = Column(DateTime)
    process_name = Column(String(255))
    exe_path = Column(String(1000))
    parent_name = Column(String(255), nullable = True)
    parent_pid = Column(Integer, nullable = True)
    suspicious_spawn = Column(Boolean, nullable = True)
    session = relationship("AgentSession", back_populates="process_events")


class SystemEvent(SessionMixin, Base):
    __tablename__ = "system_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # agent_id = Column(String(255), index=True)
    timestamp = Column(DateTime)
    cpu_usage = Column(Float)
    memory_usage = Column(Float)
    session = relationship("AgentSession", back_populates="system_events")


class EmailEvent(SessionMixin, Base):
    __tablename__ = "email_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # agent_id = Column(String(255), index=True)
    timestamp = Column(DateTime)
    sender = Column(String(500))
    subject = Column(String(1000))
    snippet_length = Column(Integer)
    body = Column(Text, nullable=True)
    has_links = Column(Boolean)
    classified = Column(String(100), nullable=True)
    session = relationship("AgentSession", back_populates="email_events")

class USBEvent(SessionMixin, Base):
    __tablename__ = "usb_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # agent_id = Column(String(255), index=True)
    event_type = Column(String(100))
    timestamp = Column(DateTime)
    mountpoint = Column(String(255))
    session = relationship("AgentSession", back_populates="usb_events")

class NetworkEvent(SessionMixin, Base):
    __tablename__ = "network_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, index=True)
    local_ip_hash = Column(String(64))
    local_port = Column(Integer)
    remote_ip_hash = Column(String(64))
    remote_port = Column(Integer)
    status = Column(String(50))
    pid = Column(Integer, nullable=True)
    process_name = Column(String(255), nullable=True)
    session = relationship("AgentSession", back_populates="network_events")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="user") # 'admin' or 'user'
    created_at = Column(DateTime, default=datetime.now(timezone.utc))


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(String(50), nullable=False, index=True)
    risk_score = Column(Float, nullable=False, default=0)
    is_threat = Column(Boolean, nullable=False, default=False)
    ml_score = Column(Float, nullable=True)
    rule_score = Column(Float, nullable=True)
    rules_triggered = Column(JSON, nullable=False, default=list)
    evidence_refs = Column(JSON, nullable=False, default=list)
    result = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, nullable=False, default=_utcnow, index=True)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    fingerprint = Column(String(64), nullable=False, index=True)
    agent_id = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    severity = Column(String(20), nullable=False, default="medium")
    risk_score = Column(Float, nullable=False, default=0)
    status = Column(String(30), nullable=False, default="open", index=True)
    false_positive = Column(Boolean, nullable=False, default=False)
    feedback = Column(Text, nullable=True)
    evidence_refs = Column(JSON, nullable=False, default=list)
    latest_assessment_id = Column(Integer, ForeignKey("risk_assessments.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow, index=True)
    updated_at = Column(DateTime, nullable=False, default=_utcnow)
    last_seen_at = Column(DateTime, nullable=False, default=_utcnow)


class Investigation(Base):
    __tablename__ = "investigations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    status = Column(String(30), nullable=False, default="open", index=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow, index=True)
    updated_at = Column(DateTime, nullable=False, default=_utcnow)


class InvestigationNote(Base):
    __tablename__ = "investigation_notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    investigation_id = Column(Integer, ForeignKey("investigations.id"), nullable=False, index=True)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=_utcnow, index=True)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String(40), nullable=False, index=True)
    entity_id = Column(Integer, nullable=False, index=True)
    action = Column(String(80), nullable=False)
    details = Column(JSON, nullable=False, default=dict)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_email = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow, index=True)


class SandboxRiskCase(Base):
    __tablename__ = "sandbox_risk_cases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    risk_score = Column(Float, nullable=False)
    is_threat = Column(Boolean, nullable=False, default=False)
    rules_triggered = Column(JSON, nullable=False, default=list)
    is_simulation = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow, index=True)


class SandboxAlert(Base):
    __tablename__ = "sandbox_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(Integer, ForeignKey("sandbox_risk_cases.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    severity = Column(String(20), nullable=False)
    risk_score = Column(Float, nullable=False)
    status = Column(String(30), nullable=False, default="open", index=True)
    false_positive = Column(Boolean, nullable=False, default=False)
    feedback = Column(Text, nullable=True)
    is_simulation = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow, index=True)
    updated_at = Column(DateTime, nullable=False, default=_utcnow)


class SandboxInvestigation(Base):
    __tablename__ = "sandbox_investigations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(Integer, ForeignKey("sandbox_alerts.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    status = Column(String(30), nullable=False, default="open", index=True)
    is_simulation = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow, index=True)
    updated_at = Column(DateTime, nullable=False, default=_utcnow)


class SandboxInvestigationNote(Base):
    __tablename__ = "sandbox_investigation_notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    investigation_id = Column(Integer, ForeignKey("sandbox_investigations.id"), nullable=False, index=True)
    body = Column(Text, nullable=False)
    is_simulation = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow, index=True)


class SandboxAuditEvent(Base):
    __tablename__ = "sandbox_audit_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String(40), nullable=False, index=True)
    entity_id = Column(Integer, nullable=False, index=True)
    action = Column(String(80), nullable=False)
    details = Column(JSON, nullable=False, default=dict)
    actor_user_id = Column(Integer, nullable=True)
    actor_email = Column(String(255), nullable=True)
    is_simulation = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow, index=True)



# NOTE (Very Important): Implement a mechanism to implement keys to recognize
# and map events to user.
# Suppose agent is run on two machines, A and B. Both will be stored in same database,
# however, there should be a way to differentiate which events came from which machine.
# Also, if the agent is restarted on the same machine, the machine should also have previous ID.