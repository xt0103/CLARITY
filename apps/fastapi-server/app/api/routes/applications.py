from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from typing import Optional

from app.api.deps import db_session, get_current_user_id
from app.core.errors import ApiError
from app.core.time import to_iso_z, utcnow
from app.models.application import Application
from app.models.job_favorite import JobFavorite
from app.schemas.application import (
    ApplicationCreateRequest,
    ApplicationCreateResponse,
    ApplicationCreateItem,
    ApplicationListItem,
    ApplicationListResponse,
    ApplicationPatchRequest,
    ApplicationPatchResponse,
    ApplicationPatchItem,
)


router = APIRouter(tags=["applications"])


def _parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except Exception:
        raise ApiError(status_code=422, code="VALIDATION_ERROR", message="Invalid date format (YYYY-MM-DD expected)")


@router.post("/api/applications", response_model=ApplicationCreateResponse, status_code=201)
def create_application(
    payload: ApplicationCreateRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(db_session),
) -> ApplicationCreateResponse:
    if not payload.jobSnapshot.title or not payload.jobSnapshot.company:
        raise ApiError(status_code=422, code="VALIDATION_ERROR", message="Missing required jobSnapshot fields")

    applied_date = _parse_date(payload.dateApplied)

    app_row = Application(
        user_id=user_id,
        job_id=payload.jobId,
        snapshot_title=payload.jobSnapshot.title,
        snapshot_company=payload.jobSnapshot.company,
        snapshot_location=payload.jobSnapshot.location,
        snapshot_external_url=payload.jobSnapshot.externalUrl,
        platform_source=payload.platformSource,
        date_applied=applied_date,
        status=payload.status,
        priority=payload.priority,
        notes=payload.notes,
    )
    db.add(app_row)
    db.commit()
    db.refresh(app_row)

    return ApplicationCreateResponse(
        application=ApplicationCreateItem(
            id=app_row.id,
            jobId=app_row.job_id,
            snapshotTitle=app_row.snapshot_title,
            snapshotCompany=app_row.snapshot_company,
            snapshotLocation=app_row.snapshot_location,
            snapshotExternalUrl=app_row.snapshot_external_url,
            platformSource=payload.platformSource,
            dateApplied=app_row.date_applied.isoformat(),
            status=payload.status,
            priority=payload.priority,
            notes=payload.notes,
            createdAt=to_iso_z(app_row.created_at),
            updatedAt=to_iso_z(app_row.updated_at),
        )
    )


@router.get("/api/applications", response_model=ApplicationListResponse)
def list_applications(
    status: Optional[str] = None,
    from_: Optional[str] = Query(default=None, alias="from"),
    to: Optional[str] = None,
    page: int = 1,
    pageSize: int = 20,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(db_session),
) -> ApplicationListResponse:
    # NOTE: "from" is a reserved keyword in Python; FastAPI can map query param via alias.
    from_date = _parse_date(from_) if from_ else None
    to_date = _parse_date(to) if to else None

    stmt = select(Application).where(Application.user_id == user_id, Application.is_deleted == False)
    if status:
        stmt = stmt.where(Application.status == status)
    if from_date:
        stmt = stmt.where(Application.date_applied >= from_date)
    if to_date:
        stmt = stmt.where(Application.date_applied <= to_date)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    offset = max(page - 1, 0) * pageSize
    rows = db.scalars(stmt.order_by(Application.created_at.desc()).offset(offset).limit(pageSize)).all()

    # Get user's favorite job IDs
    favorite_job_ids = set(
        db.scalars(select(JobFavorite.job_id).where(JobFavorite.user_id == user_id)).all()
    )

    return ApplicationListResponse(
        applications=[
            ApplicationListItem(
                id=r.id,
                snapshotTitle=r.snapshot_title,
                snapshotCompany=r.snapshot_company,
                snapshotLocation=r.snapshot_location,
                snapshotExternalUrl=r.snapshot_external_url,
                platformSource=r.platform_source,  # type: ignore
                dateApplied=r.date_applied.isoformat(),
                status=r.status,  # type: ignore
                priority=r.priority,  # type: ignore
                notes=r.notes,
                createdAt=to_iso_z(r.created_at),
                updatedAt=to_iso_z(r.updated_at),
                isFavorite=r.job_id in favorite_job_ids if r.job_id else None,
            )
            for r in rows
        ],
        total=int(total),
        page=page,
        pageSize=pageSize,
    )


@router.patch("/api/applications/{applicationId}", response_model=ApplicationPatchResponse)
def patch_application(
    applicationId: str,
    payload: ApplicationPatchRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(db_session),
) -> ApplicationPatchResponse:
    row = db.scalar(
        select(Application).where(
            Application.id == applicationId,
            Application.user_id == user_id,
            Application.is_deleted == False,
        )
    )
    if row is None:
        raise ApiError(status_code=404, code="NOT_FOUND", message="Application not found")

    if payload.status is not None:
        row.status = payload.status
    if payload.priority is not None:
        row.priority = payload.priority
    if payload.notes is not None:
        row.notes = payload.notes
    if payload.dateApplied is not None:
        row.date_applied = _parse_date(payload.dateApplied)
    if payload.platformSource is not None:
        row.platform_source = payload.platformSource

    row.updated_at = utcnow()
    db.commit()
    db.refresh(row)

    return ApplicationPatchResponse(
        application=ApplicationPatchItem(
            id=row.id,
            status=row.status,  # type: ignore
            priority=row.priority,  # type: ignore
            notes=row.notes,
            updatedAt=to_iso_z(row.updated_at),
        )
    )


@router.delete("/api/applications/{applicationId}", status_code=204)
def delete_application(
    applicationId: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(db_session),
):
    row = db.scalar(
        select(Application).where(
            Application.id == applicationId,
            Application.user_id == user_id,
            Application.is_deleted == False,
        )
    )
    if row is None:
        raise ApiError(status_code=404, code="NOT_FOUND", message="Application not found")

    row.is_deleted = True
    db.commit()
    return None

