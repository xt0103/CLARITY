from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _uuid_str() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    job_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("jobs.id"), nullable=True)

    snapshot_title: Mapped[str] = mapped_column(String(255))
    snapshot_company: Mapped[str] = mapped_column(String(255))
    snapshot_location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    snapshot_external_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    platform_source: Mapped[str] = mapped_column(String(20))
    date_applied: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), index=True)
    priority: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

