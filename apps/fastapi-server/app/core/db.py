from urllib.parse import urlparse

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


def _is_sqlite(url: str) -> bool:
    try:
        return urlparse(url).scheme.startswith("sqlite")
    except Exception:
        return url.startswith("sqlite")


_connect_args = {"check_same_thread": False} if _is_sqlite(settings.DATABASE_URL) else {}
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

