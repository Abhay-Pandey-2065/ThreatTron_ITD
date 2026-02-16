from sqlalchemy import Column, Integer, String, DateTime, Float, JSON
from database import Base

class FileEvent(Base):
    __tablename__ = "file_events"

    id = Column(Integer, primary_key=True)
    agent_id = Column(String(255), index=True)
    event_type = Column(String(100))
    timestamp = Column(DateTime)
    file_path = Column(String(1000))
    action = Column(String(100))
    extra_data = Column(JSON)


class ProcessEvent(Base):
    __tablename__ = "process_events"

    id = Column(Integer, primary_key=True)
    agent_id = Column(String(255), index=True)
    event_type = Column(String(100))
    timestamp = Column(DateTime)
    process_name = Column(String(255))
    exe_path = Column(String(1000))


class SystemEvent(Base):
    __tablename__ = "system_events"

    id = Column(Integer, primary_key=True)
    agent_id = Column(String(255), index=True)
    timestamp = Column(DateTime)
    cpu_usage = Column(Float)
    memory_usage = Column(Float)


class EmailEvent(Base):
    __tablename__ = "email_events"

    id = Column(Integer, primary_key=True)
    agent_id = Column(String(255), index=True)
    timestamp = Column(DateTime)
    sender = Column(String(500))
    subject = Column(String(1000))
    snippet_length = Column(Integer)
    has_links = Column(String(10))

class USBEvent(Base):
    __tablename__ = "usb_events"

    id = Column(Integer, primary_key=True)
    agent_id = Column(String(255), index=True)
    event_type = Column(String(100))
    timestamp = Column(DateTime)
    mountpoint = Column(String(255))

