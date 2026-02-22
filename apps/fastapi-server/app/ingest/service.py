from __future__ import annotations

from datetime import timedelta
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.time import utcnow
from app.ingest.connectors.greenhouse import fetch_jobs as fetch_greenhouse
from app.ingest.connectors.lever import fetch_jobs as fetch_lever
from app.ingest.types import NormalizedJob
from app.nlp.keyword_extractor import extract_keywords
from app.models.job import Job
from app.models.job_source import JobSource
import json


def run_ingest_for_source(
    db: Session,
    *,
    source_id: Optional[str] = None,
    type: Optional[str] = None,
    all: bool = False,
) -> dict:
    """
    Returns a summary dict for scripts.
    """
    now = utcnow()

    q = select(JobSource).where(JobSource.is_enabled == True)  # noqa: E712
    if source_id:
        q = q.where(JobSource.id == source_id)
    elif type:
        q = q.where(JobSource.type == type)
    elif not all:
        # default: nothing unless explicitly requested
        return {"sources_run": 0, "fetched": 0, "upserted": 0, "deactivated": 0}

    sources = list(db.scalars(q).all())

    sources_run = 0
    fetched_total = 0
    upserted_total = 0
    deactivated_total = 0

    for src in sources:
        sources_run += 1
        src.last_run_at = now
        src.last_error = None
        db.add(src)
        db.commit()
        db.refresh(src)

        try:
            if src.type == "greenhouse":
                jobs = fetch_greenhouse(src)
            elif src.type == "lever":
                jobs = fetch_lever(src)
            else:
                raise ValueError(f"Unsupported source type: {src.type}")

            fetched_total += len(jobs)
            upserted_total += upsert_jobs(db, jobs)
            deactivated_total += deactivate_stale_jobs(db, src=src, days=14)

            src.last_success_at = utcnow()
            src.last_error = None
            db.add(src)
            db.commit()
        except Exception as e:
            src.last_error = str(e)
            db.add(src)
            db.commit()

    return {
        "sources_run": sources_run,
        "fetched": fetched_total,
        "upserted": upserted_total,
        "deactivated": deactivated_total,
    }


def upsert_jobs(db: Session, jobs: list[NormalizedJob]) -> int:
    now = utcnow()
    upserted = 0

    for j in jobs:
        job_kws = extract_keywords(j.description_text or "")
        job_kws_json = json.dumps(job_kws, ensure_ascii=False)
        existing = db.scalar(select(Job).where(Job.source == j.source, Job.source_id == j.source_id))
        if existing is None:
            row = Job(
                title=j.title,
                company=j.company,
                location=j.location,
                job_type=None,
                tags_json=None,
                description_text=j.description_text,
                external_url=None,  # legacy
                apply_url=j.apply_url,
                posted_at=j.posted_at,
                last_seen_at=now,
                is_active=True,
                raw_json=j.raw_json,
                job_keywords_json=job_kws_json,
                job_keywords_updated_at=now,
                source=j.source,
                source_id=j.source_id,
                created_at=now,
                updated_at=now,
            )
            db.add(row)
            upserted += 1
        else:
            existing.title = j.title
            existing.company = j.company
            existing.location = j.location
            existing.description_text = j.description_text
            existing.apply_url = j.apply_url
            existing.posted_at = j.posted_at
            existing.raw_json = j.raw_json
            existing.last_seen_at = now
            existing.is_active = True
            existing.job_keywords_json = job_kws_json
            existing.job_keywords_updated_at = now
            existing.updated_at = now
            upserted += 1

    db.commit()
    return upserted


def deactivate_stale_jobs(db: Session, *, src: JobSource, days: int = 14) -> int:
    cutoff = utcnow() - timedelta(days=days)
    stmt = (
        update(Job)
        .where(Job.source == f"{src.type}:{src.base_key}")
        .where(Job.last_seen_at.is_not(None))
        .where(Job.last_seen_at < cutoff)
        .values(is_active=False, updated_at=utcnow())
    )
    res = db.execute(stmt)
    db.commit()
    return int(res.rowcount or 0)

