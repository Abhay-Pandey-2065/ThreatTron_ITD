import os
from sqlalchemy import create_engine
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

# Aiven MySQL requires SSL. Detect Aiven host automatically.
_is_aiven = "aivencloud.com" in DATABASE_URL
_connect_args = {"ssl": {"ssl_mode": "REQUIRED"}} if _is_aiven else {}

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args=_connect_args,
)

SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()