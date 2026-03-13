from __future__ import annotations

from typing import Optional

from app.schemas.base import APIModel


class KeywordsJson(APIModel):
    skills: list[str] = []
    tools: list[str] = []
    domain: list[str] = []
    titles: list[str] = []
    methods: list[str] = []


class JobDetail(APIModel):
    id: str
    title: str
    company: str
    companyLogoUrl: Optional[str] = None
    location: Optional[str] = None
    jobType: Optional[str] = None
    tags: list[str] = []
    descriptionText: str
    externalUrl: Optional[str] = None  # legacy (older UI flows)
    applyUrl: Optional[str] = None
    postedAt: Optional[str] = None
    source: str
    sourceId: Optional[str] = None
    isActive: Optional[bool] = None
    jobKeywords: Optional[KeywordsJson] = None
    createdAt: str
    isFavorite: Optional[bool] = None


class SectionBreakdown(APIModel):
    """Breakdown for a single JD section."""
    sectionName: str
    lexicalScore: Optional[int] = None
    semanticScore: Optional[int] = None
    sectionScore: Optional[int] = None
    confidence: float
    matchedKeywords: KeywordsJson = KeywordsJson()
    missingKeywords: KeywordsJson = KeywordsJson()


class JobMatchExplain(APIModel):
    matchScore: Optional[int] = None
    keywordScore: Optional[int] = None
    clusterScore: Optional[int] = None
    semanticScore: Optional[int] = None  # Overall semantic score
    matchedClusters: list[str] = []
    matchedKeywordsByGroup: KeywordsJson = KeywordsJson()
    missingKeywordsByGroup: KeywordsJson = KeywordsJson()
    softMatchedKeywordsByGroup: Optional[KeywordsJson] = None
    breakdown: Optional[dict[str, SectionBreakdown]] = None  # section_name -> breakdown
    note: Optional[str] = None


class JobDetailResponse(APIModel):
    job: JobDetail
    match: Optional[JobMatchExplain] = None


class JobListItem(APIModel):
    id: str
    title: str
    company: str
    companyLogoUrl: Optional[str] = None
    location: Optional[str] = None
    descriptionText: str
    applyUrl: Optional[str] = None
    postedAt: Optional[str] = None
    source: str
    sourceId: Optional[str] = None
    isActive: bool
    jobKeywords: Optional[KeywordsJson] = None
    match: Optional[JobMatchExplain] = None
    isFavorite: Optional[bool] = None


class JobListResponse(APIModel):
    jobs: list[JobListItem]
    total: int
    limit: int
    offset: int

