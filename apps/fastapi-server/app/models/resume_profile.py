from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _uuid_str() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ResumeProfile(Base):
    __tablename__ = "resume_profiles"
    __table_args__ = (UniqueConstraint("resume_id", name="uq_resume_profiles_resume_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    resume_id: Mapped[str] = mapped_column(String(36), ForeignKey("resumes.id"), index=True, unique=True)

    parsed_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    keywords_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

