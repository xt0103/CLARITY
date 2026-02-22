from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _uuid_str() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class JobSource(Base):
    __tablename__ = "job_sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # enum-ish: "greenhouse" | "lever"
    type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)

    company_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # greenhouse: board_token; lever: site_handle
    base_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    fetch_interval_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=360)
    max_items: Mapped[int] = mapped_column(Integer, nullable=False, default=500)

    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_success_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

