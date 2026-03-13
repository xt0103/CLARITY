from __future__ import annotations

from typing import Optional

from app.schemas.base import APIModel


class ResumeItem(APIModel):
    id: str
    fileName: str
    createdAt: str
    isDefault: bool


class ResumeCreateResponse(APIModel):
    resume: ResumeItem


class ResumeListResponse(APIModel):
    resumes: list[ResumeItem]


class ResumePatchRequest(APIModel):
    setAsDefault: Optional[bool] = None
    fileName: Optional[str] = None


class ResumePatchResponse(APIModel):
    resume: ResumeItem
    user: dict[str, Optional[str]]


class ResumeParseResponse(APIModel):
    resumeId: str
    keywords: dict
    updatedAt: str


class ResumeDetailResponse(APIModel):
    resume: ResumeItem
    textContent: Optional[str] = None
    keywords: Optional[dict] = None  # 添加关键词字段

