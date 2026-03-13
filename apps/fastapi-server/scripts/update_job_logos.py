#!/usr/bin/env python3
"""
Script to update company logos for existing jobs in the database.
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.core.config import settings
from app.models.job import Job
from app.ingest.company_logo import get_company_logo_url
import time


def update_job_logos(db: Session, batch_size: int = 50, delay: float = 0.1) -> dict:
    """
    Update company logos for jobs that don't have a logo URL yet.
    
    Args:
        db: Database session
        batch_size: Number of jobs to process in each batch
        delay: Delay between batches (seconds) to avoid rate limiting
    
    Returns:
        Summary dict with counts
    """
    # Find jobs without logo URLs
    jobs_without_logo = db.scalars(
        select(Job)
        .where(Job.company_logo_url.is_(None))
        .where(Job.company.is_not(None))
        .where(Job.is_active == True)  # noqa: E712
        .limit(1000)  # Limit to avoid processing too many at once
    ).all()
    
    total = len(jobs_without_logo)
    updated = 0
    failed = 0
    
    print(f"Found {total} jobs without logo URLs")
    
    for i, job in enumerate(jobs_without_logo, 1):
        try:
            if not job.company or not job.company.strip():
                continue
            
            # Get logo URL
            logo_url = get_company_logo_url(job.company)
            
            if logo_url:
                # Update the job
                db.execute(
                    update(Job)
                    .where(Job.id == job.id)
                    .values(company_logo_url=logo_url)
                )
                updated += 1
                
                if i % 10 == 0:
                    db.commit()
                    print(f"Progress: {i}/{total} (updated: {updated}, failed: {failed})")
            else:
                failed += 1
                
        except Exception as e:
            print(f"Error updating job {job.id} ({job.company}): {e}")
            failed += 1
            continue
        
        # Small delay to avoid rate limiting
        if i % batch_size == 0:
            time.sleep(delay)
            db.commit()
    
    # Final commit
    db.commit()
    
    return {
        "total": total,
        "updated": updated,
        "failed": failed
    }


def main():
    """Main entry point."""
    print("=" * 60)
    print("Updating company logos for existing jobs")
    print("=" * 60)
    print()
    
    db = SessionLocal()
    try:
        result = update_job_logos(db, batch_size=50, delay=0.1)
        
        print()
        print("=" * 60)
        print("Summary:")
        print(f"  Total jobs processed: {result['total']}")
        print(f"  Successfully updated: {result['updated']}")
        print(f"  Failed: {result['failed']}")
        print("=" * 60)
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
