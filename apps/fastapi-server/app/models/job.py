from __future__ import annotations

import uuid
from datetime import datetime, timezone

from typing import List, Optional

from sqlalchemy import Boolean, DateTime, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _uuid_str() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (UniqueConstraint("source", "source_id", name="uq_jobs_source_source_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    title: Mapped[str] = mapped_column(String(255), index=True)
    company: Mapped[str] = mapped_column(String(255), index=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    job_type: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    tags_json: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    description_text: Mapped[str] = mapped_column(Text)
    # legacy field (used by previous MVP flows)
    external_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    # ingestion/search fields (Simplify-style)
    apply_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    posted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    raw_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    job_keywords_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    job_keywords_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    source: Mapped[str] = mapped_column(String(50), index=True)
    source_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

