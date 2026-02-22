from __future__ import annotations

from app.schemas.base import APIModel


class DashboardTotals(APIModel):
    totalApplications: int
    interviews: int
    offers: int
    responseRate: int


class DashboardMetricsResponse(APIModel):
    totals: DashboardTotals
    statusBreakdown: dict[str, int]
    dailyMatches: list = []

