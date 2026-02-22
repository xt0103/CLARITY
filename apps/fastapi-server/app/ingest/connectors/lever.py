from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.ingest.types import NormalizedJob
from app.ingest.utils import html_to_text
from app.models.job_source import JobSource


def _ms_to_dt(ms: Optional[int]) -> Optional[datetime]:
    if not ms:
        return None
    try:
        return datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc)
    except Exception:
        return None


def _board_source_key(source: JobSource) -> str:
    return f"{source.type}:{source.base_key}"


def fetch_jobs(source: JobSource) -> list[NormalizedJob]:
    """
    Lever public postings API.
    base_key == site handle.
    """
    site = source.base_key
    url = f"https://api.lever.co/v0/postings/{site}"
    params = {"mode": "json"}

    timeout = httpx.Timeout(15.0, connect=10.0)
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
        data: list[dict[str, Any]] = resp.json()

    out: list[NormalizedJob] = []
    src_key = _board_source_key(source)
    company = source.company_name or source.name

    for j in data[: max(0, int(source.max_items or 500))]:
        source_id = str(j.get("id") or "").strip()
        if not source_id:
            continue

        title = (j.get("text") or "").strip()
        if not title:
            continue

        loc = None
        cats = j.get("categories") or {}
        if isinstance(cats, dict):
            loc = cats.get("location") or None

        # Prefer descriptionPlain; fallback to description HTML-ish
        desc_plain = j.get("descriptionPlain")
        if isinstance(desc_plain, str) and desc_plain.strip():
            desc_text = desc_plain.strip()
        else:
            desc_html = j.get("description") if isinstance(j.get("description"), str) else ""
            desc_text = html_to_text(desc_html)

        apply_url = None
        if isinstance(j.get("hostedUrl"), str):
            apply_url = j.get("hostedUrl")

        posted_at = _ms_to_dt(j.get("createdAt")) if isinstance(j.get("createdAt"), int) else None

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

