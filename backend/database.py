import os
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
from urllib.parse import quote_plus
from pathlib import Path

# Load env from backend/.env first, then repo-root .env (if present).
CURRENT_DIR = Path(__file__).resolve().parent
load_dotenv(CURRENT_DIR / ".env")
load_dotenv(CURRENT_DIR.parent / ".env")

DB_USER = os.getenv("DB_USER", "avnadmin")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_NAME = os.getenv("DB_NAME", "defaultdb")
DB_PORT = os.getenv("DB_PORT", "3306")

encoded_password = quote_plus(DB_PASSWORD)

DATABASE_URL = os.getenv("DATABASE_URL") or (
    f"mysql+pymysql://{DB_USER}:{encoded_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

database_url = make_url(DATABASE_URL)
if database_url.drivername == "mysql":
    database_url = database_url.set(drivername="mysql+pymysql")

ssl_mode = database_url.query.get("ssl-mode")
if ssl_mode:
    query = dict(database_url.query)
    query.pop("ssl-mode", None)
    database_url = database_url.set(query=query)

    mode = ssl_mode.upper()
    if mode not in {"DISABLED", "PREFERRED", "REQUIRED", "VERIFY_CA", "VERIFY_IDENTITY"}:
        raise ValueError("Unsupported MySQL ssl-mode")
    _connect_args = {}
    if mode != "DISABLED":
        _connect_args = {"ssl": {
            "ssl_verify_cert": mode in {"VERIFY_CA", "VERIFY_IDENTITY"},
            "ssl_verify_identity": mode == "VERIFY_IDENTITY",
        }}
else:
    _is_aiven = "aivencloud.com" in (database_url.host or "")
    _connect_args = {"ssl": {"ssl_verify_cert": False}} if _is_aiven else {}

engine = create_engine(
    database_url,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args=_connect_args,
)

SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()