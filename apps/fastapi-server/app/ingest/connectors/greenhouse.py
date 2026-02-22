from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

import httpx

from app.ingest.types import NormalizedJob
from app.ingest.utils import html_to_text
from app.models.job_source import JobSource


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    # Greenhouse often returns ISO strings like "2024-01-02T03:04:05Z"
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def _board_source_key(source: JobSource) -> str:
    # Scope jobs.source per board so dedupe + stale policy is correct.
    return f"{source.type}:{source.base_key}"


def fetch_jobs(source: JobSource) -> list[NormalizedJob]:
    """
    Greenhouse job board API (public).
    base_key == board_token.
    """
    board_token = source.base_key
    url = f"https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs"
    params = {"content": "true"}

    timeout = httpx.Timeout(15.0, connect=10.0)
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()

    jobs = data.get("jobs") or []
    out: list[NormalizedJob] = []
    src_key = _board_source_key(source)
    company = source.company_name or source.name

    for j in jobs[: max(0, int(source.max_items or 500))]:
        source_id = str(j.get("id") or "").strip()
        if not source_id:
            continue

        title = (j.get("title") or "").strip()
        if not title:
            continue

        loc = None
        loc_obj = j.get("location") or {}
        if isinstance(loc_obj, dict):
            loc = (loc_obj.get("name") or None)  # type: ignore[assignment]

        # `content` may contain HTML when content=true
        desc_html = (j.get("content") or "") if isinstance(j.get("content"), str) else ""
        desc_text = html_to_text(desc_html)

        apply_url = (j.get("absolute_url") or None) if isinstance(j.get("absolute_url"), str) else None
        posted_at = _parse_dt(j.get("updated_at") or j.get("created_at"))

        out.append(
            NormalizedJob(
                source=src_key,
                source_id=source_id,
                title=title,
                company=company,
                location=loc,
                description_text=desc_text or title,
                apply_url=apply_url,
                posted_at=posted_at,
                raw_json=json.dumps(j, ensure_ascii=False),
            )
        )

    return out

