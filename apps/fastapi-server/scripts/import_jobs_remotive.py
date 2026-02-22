"""
Import jobs from Remotive public API into the local DB.

This is a "real jobs" starter source that:
- does NOT scrape HTML pages
- uses a structured public endpoint
- upserts by (source, sourceId) using ORM (DB-agnostic)

Ref:
- Remotive API: https://remotive.com/api/remote-jobs
"""

import argparse
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests
from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.time import utcnow
from app.models.job import Job
from app.nlp.keyword_extractor import extract_keywords


_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(s: str) -> str:
    s = s or ""
    return _TAG_RE.sub(" ", s).replace("\xa0", " ").strip()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def fetch_remotive(*, search: Optional[str], limit: int) -> List[Dict[str, Any]]:
    params = {}
    if search:
        params["search"] = search
    r = requests.get("https://remotive.com/api/remote-jobs", params=params, timeout=30)
    r.raise_for_status()
    data = r.json()
    jobs = data.get("jobs") or []
    if not isinstance(jobs, list):
        return []
    return jobs[:limit]


def upsert_jobs(*, rows: List[Dict[str, Any]], source: str) -> tuple[int, int]:
    inserted = 0
    updated = 0
    db = SessionLocal()
    try:
        for j in rows:
            source_id = str(j.get("id") or "").strip()
            if not source_id:
                # Skip unidentifiable rows
                continue

            title = str(j.get("title") or "").strip()
            company = str(j.get("company_name") or "").strip()
            location = str(j.get("candidate_required_location") or "").strip() or None
            job_type = str(j.get("job_type") or "").strip() or None
            tags = j.get("tags") or []
            if not isinstance(tags, list):
                tags = []
            category = str(j.get("category") or "").strip()
            tags_norm = [t for t in ([category] if category else []) + [str(x).strip() for x in tags] if t]

            external_url = str(j.get("url") or "").strip() or None
            description = _strip_html(str(j.get("description") or ""))
            if not description:
                description = title
            kws_json = None
            try:
                kws_json = json.dumps(extract_keywords(description), ensure_ascii=False)
            except Exception:
                kws_json = None

            existing = db.scalar(select(Job).where(Job.source == source, Job.source_id == source_id))
            if existing is None:
                row = Job(
                    title=title or "Untitled",
                    company=company or "Unknown",
                    location=location,
                    job_type=job_type,
                    tags_json=tags_norm,
                    description_text=description,
                    external_url=external_url,
                    apply_url=external_url,
                    is_active=True,
                    job_keywords_json=kws_json,
                    job_keywords_updated_at=utcnow(),
                    source=source,
                    source_id=source_id,
                )
                db.add(row)
                inserted += 1
            else:
                existing.title = title or existing.title
                existing.company = company or existing.company
                existing.location = location
                existing.job_type = job_type
                existing.tags_json = tags_norm
                existing.description_text = description
                existing.external_url = external_url
                existing.apply_url = external_url
                existing.is_active = True
                existing.job_keywords_json = kws_json
                existing.job_keywords_updated_at = utcnow()
                existing.updated_at = _utcnow()
                updated += 1

        db.commit()
    finally:
        db.close()
    return inserted, updated


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--search", default=None, help="Search keyword, e.g. 'software engineer'")
    ap.add_argument("--limit", type=int, default=200, help="Max jobs to import (default 200)")
    ap.add_argument("--source", default="remotive", help="Value to store in jobs.source (default 'remotive')")
    args = ap.parse_args()

    rows = fetch_remotive(search=args.search, limit=args.limit)
    inserted, updated = upsert_jobs(rows=rows, source=args.source)
    print(f"Import complete: source={args.source} fetched={len(rows)} inserted={inserted} updated={updated}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

