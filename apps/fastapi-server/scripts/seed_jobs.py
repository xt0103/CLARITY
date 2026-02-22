import json
import sys
import uuid
import hashlib
from pathlib import Path

from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.time import utcnow
from app.models.job import Job
from app.nlp.keyword_extractor import extract_keywords


def _find_repo_root(start: Path) -> Path:
    cur = start
    for _ in range(8):
        if (cur / "data" / "seed_jobs.json").exists():
            return cur
        cur = cur.parent
    raise RuntimeError("Could not locate repo root containing data/seed_jobs.json")


def _load_seed_jobs() -> list[dict]:
    here = Path(__file__).resolve()
    repo_root = _find_repo_root(here)
    path = repo_root / "data" / "seed_jobs.json"
    return json.loads(path.read_text(encoding="utf-8"))

def _stable_source_id(job: dict) -> str:
    """
    Create a deterministic sourceId for seed jobs when not provided.

    This ensures the seed script is idempotent across DB backends without
    relying on dialect-specific upsert SQL.
    """
    title = str(job.get("title") or "")
    company = str(job.get("company") or "")
    location = str(job.get("location") or "")
    external_url = str(job.get("externalUrl") or "")
    payload = "|".join([title.strip(), company.strip(), location.strip(), external_url.strip()]).encode("utf-8")
    return f"seed-{hashlib.sha1(payload).hexdigest()}"


def main() -> int:
    jobs = _load_seed_jobs()
    inserted = 0
    updated = 0

    # Reads DATABASE_URL from environment (or apps/fastapi-server/.env via Settings),
    # and uses the same SQLAlchemy SessionLocal across SQLite/Postgres.
    db = SessionLocal()
    try:
        for j in jobs:
            source = str(j.get("source") or "seed")
            # Must be stable across re-runs for idempotent upsert by (source, sourceId).
            source_id = str(j.get("sourceId") or _stable_source_id(j))

            existing = db.scalar(select(Job).where(Job.source == source, Job.source_id == source_id))
            desc = j.get("descriptionText") or ""
            kws = extract_keywords(desc)
            kws_json = json.dumps(kws, ensure_ascii=False)
            if existing is None:
                row = Job(
                    title=j["title"],
                    company=j["company"],
                    location=j.get("location"),
                    job_type=j.get("jobType"),
                    tags_json=j.get("tags") or [],
                    description_text=desc,
                    external_url=j.get("externalUrl"),
                    apply_url=j.get("applyUrl") or j.get("externalUrl"),
                    is_active=True,
                    job_keywords_json=kws_json,
                    job_keywords_updated_at=utcnow(),
                    source=source,
                    source_id=source_id,
                )
                db.add(row)
                inserted += 1
            else:
                existing.title = j["title"]
                existing.company = j["company"]
                existing.location = j.get("location")
                existing.job_type = j.get("jobType")
                existing.tags_json = j.get("tags") or []
                existing.description_text = desc
                existing.external_url = j.get("externalUrl")
                existing.apply_url = j.get("applyUrl") or j.get("externalUrl")
                existing.is_active = True
                existing.job_keywords_json = kws_json
                existing.job_keywords_updated_at = utcnow()
                updated += 1

        db.commit()
    finally:
        db.close()

    print(f"Seed complete: inserted={inserted} updated={updated}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

