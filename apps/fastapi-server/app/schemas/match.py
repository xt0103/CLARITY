from __future__ import annotations

from typing import Optional

from app.schemas.base import APIModel


class MatchFilters(APIModel):
    location: Optional[str] = None
    jobType: Optional[str] = None
    tags: Optional[list[str]] = None


class MatchSearchRequest(APIModel):
    queryText: str
    filters: Optional[MatchFilters] = None
    resumeId: Optional[str] = None
    limit: int = 20


class MatchJobCard(APIModel):
    jobId: str
    title: str
    company: str
    location: Optional[str] = None
    jobType: Optional[str] = None
    tags: list[str] = []
    externalUrl: Optional[str] = None
    source: str
    matchScore: int
    matchRationale: list[str]


class MatchSearchResponse(APIModel):
    sessionId: str
    jobs: list[MatchJobCard]

