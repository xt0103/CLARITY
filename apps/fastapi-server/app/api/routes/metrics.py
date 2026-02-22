from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import db_session, get_current_user_id
from app.models.application import Application
from app.schemas.metrics import DashboardMetricsResponse, DashboardTotals


router = APIRouter(tags=["metrics"])

STATUSES = ["APPLIED", "UNDER_REVIEW", "INTERVIEW", "OFFER", "REJECTED"]


@router.get("/api/metrics/dashboard", response_model=DashboardMetricsResponse)
def dashboard_metrics(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(db_session),
) -> DashboardMetricsResponse:
    rows = db.execute(
        select(Application.status, func.count())
        .where(Application.user_id == user_id, Application.is_deleted == False)
        .group_by(Application.status)
    ).all()

    counts = {status: 0 for status in STATUSES}
    for status, c in rows:
        if status in counts:
            counts[status] = int(c)

    total = sum(counts.values())
    interviews = counts["INTERVIEW"]
    offers = counts["OFFER"]
    responded = counts["UNDER_REVIEW"] + counts["INTERVIEW"] + counts["OFFER"] + counts["REJECTED"]
    response_rate = int(round((responded / total) * 100)) if total > 0 else 0

    return DashboardMetricsResponse(
        totals=DashboardTotals(
            totalApplications=total,
            interviews=interviews,
            offers=offers,
            responseRate=response_rate,
        ),
        statusBreakdown=counts,
        dailyMatches=[],
    )

