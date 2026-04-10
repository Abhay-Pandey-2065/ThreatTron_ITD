from sqlalchemy import Boolean, Column, Integer, String, DateTime, Float, JSON, ForeignKey
from sqlalchemy.orm import relationship, declared_attr
from database import Base
from datetime import datetime, timezone


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
    has_links = Column(Boolean)
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



# NOTE (Very Important): Implement a mechanism to implement keys to recognize
# and map events to user.
# Suppose agent is run on two machines, A and B. Both will be stored in same database,
# however, there should be a way to differentiate which events came from which machine.
# Also, if the agent is restarted on the same machine, the machine should also have previous ID.