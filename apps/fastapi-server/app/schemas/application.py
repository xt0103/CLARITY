from __future__ import annotations

from typing import Literal, Optional

from app.schemas.base import APIModel


ApplicationStatus = Literal["APPLIED", "UNDER_REVIEW", "INTERVIEW", "OFFER", "REJECTED"]
Priority = Literal["HIGH", "MEDIUM", "LOW"]
PlatformSource = Literal["LINKEDIN", "OFFICIAL", "REFERRAL", "OTHER"]


class JobSnapshot(APIModel):
    title: str
    company: str
    location: Optional[str] = None
    externalUrl: Optional[str] = None


class ApplicationCreateRequest(APIModel):
    jobId: Optional[str] = None
    jobSnapshot: JobSnapshot
    platformSource: PlatformSource
    dateApplied: str
    status: ApplicationStatus
    priority: Optional[Priority] = None
    notes: Optional[str] = None


class ApplicationCreateItem(APIModel):
    id: str
    jobId: Optional[str] = None
    snapshotTitle: str
    snapshotCompany: str
    snapshotLocation: Optional[str] = None
    snapshotExternalUrl: Optional[str] = None
    platformSource: PlatformSource
    dateApplied: str
    status: ApplicationStatus
    priority: Optional[Priority] = None
    notes: Optional[str] = None
    createdAt: str
    updatedAt: str


class ApplicationCreateResponse(APIModel):
    application: ApplicationCreateItem


class ApplicationListItem(APIModel):
    id: str
    snapshotTitle: str
    snapshotCompany: str
    snapshotLocation: Optional[str] = None
    snapshotExternalUrl: Optional[str] = None
    platformSource: PlatformSource
    dateApplied: str
    status: ApplicationStatus
    priority: Optional[Priority] = None
    notes: Optional[str] = None
    createdAt: str
    updatedAt: str
    isFavorite: Optional[bool] = None


class ApplicationListResponse(APIModel):
    applications: list[ApplicationListItem]
    total: int
    page: int
    pageSize: int


class ApplicationPatchRequest(APIModel):
    status: Optional[ApplicationStatus] = None
    priority: Optional[Priority] = None
    notes: Optional[str] = None
    dateApplied: Optional[str] = None
    platformSource: Optional[PlatformSource] = None


class ApplicationPatchItem(APIModel):
    id: str
    status: Optional[ApplicationStatus] = None
    priority: Optional[Priority] = None
    notes: Optional[str] = None
    updatedAt: str


class ApplicationPatchResponse(APIModel):
    application: ApplicationPatchItem

