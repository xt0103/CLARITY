import argparse

from app.core.db import SessionLocal
from app.ingest.service import run_ingest_for_source


def main() -> int:
    p = argparse.ArgumentParser(description="Run Greenhouse/Lever ingestion into jobs table.")
    p.add_argument("--all", action="store_true", help="Run ingest for all enabled job_sources")
    p.add_argument("--type", choices=["greenhouse", "lever"], help="Run ingest for enabled sources of this type")
    p.add_argument("--source-id", help="Run ingest for a specific job_sources.id")
    args = p.parse_args()

    db = SessionLocal()
    try:
        summary = run_ingest_for_source(
            db,
            source_id=args.source_id,
            type=args.type,
            all=bool(args.all),
        )
    finally:
        db.close()

    print(
        "Ingest summary: "
        f"sources_run={summary.get('sources_run')} "
        f"fetched={summary.get('fetched')} "
        f"upserted={summary.get('upserted')} "
        f"deactivated={summary.get('deactivated')}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

