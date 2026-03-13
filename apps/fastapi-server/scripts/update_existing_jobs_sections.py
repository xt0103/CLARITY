"""
Script to update existing jobs with sections and embeddings.
This allows us to process existing jobs without re-fetching them.
"""
import sys
import os
from pathlib import Path

# Add the fastapi-server directory to the sys.path
script_dir = Path(__file__).resolve().parent
fastapi_server_dir = script_dir.parent
sys.path.insert(0, str(fastapi_server_dir))

# Change working directory to fastapi-server for relative imports
os.chdir(fastapi_server_dir)

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from tqdm import tqdm
import json

from app.core.config import settings
from app.core.time import utcnow
from app.models.job import Job
from app.nlp.jd_segmenter import segment_jd
from app.nlp.keyword_extractor import extract_keywords
from app.nlp.embeddings import generate_section_embeddings, embeddings_to_json


def update_existing_jobs_sections():
    """
    Update all existing jobs with sections and embeddings.
    Only processes jobs that don't have sections yet or have outdated sections.
    """
    print("=" * 60)
    print("Updating existing jobs with sections and embeddings")
    print("=" * 60)

    # Setup database connection
    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # Find jobs that need updating
        # Update if: no sections_json OR description_text changed (simplified: update all without sections)
        jobs_to_update = db.scalars(
            select(Job).where(
                Job.is_active == True,
                (Job.jd_sections_json.is_(None)) | (Job.jd_sections_json == "")
            )
        ).all()

        if not jobs_to_update:
            print("No jobs found that need updating.")
            return

        print(f"Found {len(jobs_to_update)} jobs to update")

        updated_count = 0
        failed_count = 0
        skipped_count = 0

        # Use tqdm for progress bar
        for i, job in enumerate(tqdm(jobs_to_update, desc="Processing jobs")):
            try:
                # Skip if no description
                if not job.description_text or not job.description_text.strip():
                    skipped_count += 1
                    continue

                # Segment JD
                segments_result = segment_jd(job.description_text)
                jd_sections_json = json.dumps(segments_result["sections"], ensure_ascii=False)
                jd_sections_conf_json = json.dumps(segments_result["confidence"], ensure_ascii=False)

                # Extract keywords for each section
                section_keywords = {}
                for section_name, section_text in segments_result["sections"].items():
                    if section_text and section_text.strip():
                        section_kws = extract_keywords(section_text)
                        section_keywords[section_name] = section_kws
                jd_section_keywords_json = json.dumps(section_keywords, ensure_ascii=False)

                # Generate embeddings for each section
                section_embeddings = generate_section_embeddings(segments_result["sections"])
                jd_embeddings_json = embeddings_to_json(section_embeddings)

                # Update job
                job.jd_sections_json = jd_sections_json
                job.jd_sections_conf_json = jd_sections_conf_json
                job.jd_section_keywords_json = jd_section_keywords_json
                job.jd_embeddings_json = jd_embeddings_json
                job.jd_sections_updated_at = utcnow()

                db.add(job)
                updated_count += 1

                # Commit in batches to avoid large transactions
                if (i + 1) % 10 == 0:
                    db.commit()
                    tqdm.write(f"Progress: {i+1}/{len(jobs_to_update)} (updated: {updated_count}, failed: {failed_count}, skipped: {skipped_count})")

            except Exception as e:
                failed_count += 1
                tqdm.write(f"Error updating job {job.id} ({job.company} - {job.title}): {e}")
                # Continue with next job

        # Final commit
        db.commit()

        print("\n" + "=" * 60)
        print("Summary:")
        print(f"  Total jobs processed: {len(jobs_to_update)}")
        print(f"  Successfully updated: {updated_count}")
        print(f"  Failed: {failed_count}")
        print(f"  Skipped (no description): {skipped_count}")
        print("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    update_existing_jobs_sections()
