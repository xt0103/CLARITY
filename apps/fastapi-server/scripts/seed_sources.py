import json
from pathlib import Path

from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.time import utcnow
from app.models.job_source import JobSource


def _find_repo_root(start: Path) -> Path:
    cur = start
    for _ in range(8):
        if (cur / "data" / "seed_sources_sg_cn.json").exists():
            return cur
        cur = cur.parent
    raise RuntimeError("Could not locate repo root containing data/seed_sources_sg_cn.json")


def _load_seed_sources() -> list[dict]:
    here = Path(__file__).resolve()
    repo_root = _find_repo_root(here)
    path = repo_root / "data" / "seed_sources_sg_cn.json"
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    sources = _load_seed_sources()
    inserted = 0
    updated = 0

    db = SessionLocal()
    try:
        for s in sources:
            stype = str(s.get("type") or "").strip()
            base_key = str(s.get("baseKey") or "").strip()
            if stype not in ("greenhouse", "lever"):
                raise RuntimeError(f"Invalid source type in seed: {stype!r}")
            if not base_key:
                raise RuntimeError("Missing baseKey in seed_sources entry")

            existing = db.scalar(select(JobSource).where(JobSource.type == stype, JobSource.base_key == base_key))
            if existing is None:
                row = JobSource(
                    name=str(s.get("name") or f"{stype}:{base_key}"),
                    type=stype,
                    company_name=str(s.get("companyName") or "") or None,
                    base_key=base_key,
                    is_enabled=bool(s.get("isEnabled", True)),
                    fetch_interval_minutes=int(s.get("fetchIntervalMinutes", 360)),
                    max_items=int(s.get("maxItems", 500)),
                    created_at=utcnow(),
                    updated_at=utcnow(),
                )
                db.add(row)
                inserted += 1
            else:
                existing.name = str(s.get("name") or existing.name)
                existing.company_name = str(s.get("companyName") or "") or None
                existing.is_enabled = bool(s.get("isEnabled", existing.is_enabled))
                existing.fetch_interval_minutes = int(s.get("fetchIntervalMinutes", existing.fetch_interval_minutes))
                existing.max_items = int(s.get("maxItems", existing.max_items))
                existing.updated_at = utcnow()
                updated += 1

        db.commit()
    finally:
        db.close()

    print(f"Seed job_sources complete: inserted={inserted} updated={updated}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

