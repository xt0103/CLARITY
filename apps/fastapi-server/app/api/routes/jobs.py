import re
import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import db_session, get_current_user_id
from app.core.config import settings
from app.core.errors import ApiError
from app.core.resume_text import extract_text_from_path_best_effort
from app.core.time import to_iso_z, utcnow
from app.match.match_engine import compute_match
from app.match.match_engine_v2 import compute_match_v2, MatchResultV2
from app.nlp.keyword_extractor import extract_keywords
from app.nlp.skill_taxonomy import is_known_term
from app.models.job import Job
from app.models.job_favorite import JobFavorite
from app.models.resume import Resume
from app.models.resume_profile import ResumeProfile
from app.models.user import User
from app.models.unknown_term import UnknownTerm
from app.schemas.job import JobDetail, JobDetailResponse, JobListItem, JobListResponse, JobMatchExplain, KeywordsJson, SectionBreakdown


router = APIRouter(tags=["jobs"])

def _parse_keywords_json(raw: Optional[str]) -> Optional[dict]:
    if not raw:
        return None
    try:
        v = json.loads(raw)
        return v if isinstance(v, dict) else None
    except Exception:
        return None


def _ensure_job_keywords(db: Session, job: Job) -> Optional[dict]:
    """
    Prefer offline-cached job keywords. If missing, compute once and persist.
    """
    existing = _parse_keywords_json(job.job_keywords_json)
    if existing:
        return existing
    kws = extract_keywords(job.description_text or "")
    job.job_keywords_json = json.dumps(kws, ensure_ascii=False)
    job.job_keywords_updated_at = utcnow()
    db.add(job)
    db.commit()
    return kws


def _record_unknown_terms(db: Session, *, terms: list[str]) -> None:
    """
    Best-effort unknown term collector (SQLite-safe).
    Stores canonical terms not covered by alias_map or clusters.
    """
    now = utcnow()
    uniq = []
    seen = set()
    for t in terms:
        tt = (t or "").strip().lower()
        if not tt or len(tt) < 3:
            continue
        if tt in seen:
            continue
        seen.add(tt)
        uniq.append(tt)
    # limit per request to avoid heavy writes
    uniq = uniq[:60]
    try:
        for t in uniq:
            if is_known_term(t):
                continue
            row = db.get(UnknownTerm, t)
            if row is None:
                db.add(UnknownTerm(term=t, count=1, last_seen_at=now))
            else:
                row.count = int(row.count or 0) + 1
                row.last_seen_at = now
        db.commit()
    except Exception:
        # never break main API path
        db.rollback()


def _get_resume_profile_data(db: Session, *, user_id: str, resume_id: Optional[str]) -> Optional[dict]:
    """
    Get resume profile data including keywords, sections, and embeddings.
    
    Returns:
        {
            "keywords": dict,
            "cv_sections_json": str or None,
            "cv_sections_conf_json": str or None,
            "cv_embeddings_json": str or None
        } or None
    """
    if not resume_id:
        return None
    
    prof = db.scalar(select(ResumeProfile).where(ResumeProfile.user_id == user_id, ResumeProfile.resume_id == resume_id))
    if prof:
        keywords = _parse_keywords_json(prof.keywords_json)
        return {
            "keywords": keywords,
            "cv_sections_json": prof.cv_sections_json,
            "cv_sections_conf_json": prof.cv_sections_conf_json,
            "cv_embeddings_json": prof.cv_embeddings_json,
        }
    
    # Fallback: extract from resume text (legacy path)
    resume = db.scalar(select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id, Resume.is_deleted == False))
    if resume is None:
        return None
    
    text = (resume.text_content or "").strip()
    if (not text) and resume.storage_key:
        upload_dir = Path(settings.UPLOAD_DIR)
        extracted = extract_text_from_path_best_effort(filename=resume.file_name, path=upload_dir / resume.storage_key)
        if extracted:
            text = extracted[:100_000]
            resume.text_content = text
            db.add(resume)
            db.commit()
    
    if not text:
        return None
    
    kws = extract_keywords(text)
    kws_json = json.dumps(kws, ensure_ascii=False)
    
    if prof is None:
        db.add(ResumeProfile(user_id=user_id, resume_id=resume.id, parsed_text=text, keywords_json=kws_json, updated_at=utcnow()))
    else:
        prof.parsed_text = text
        prof.keywords_json = kws_json
        prof.updated_at = utcnow()
    db.commit()
    
    return {
        "keywords": kws,
        "cv_sections_json": None,
        "cv_sections_conf_json": None,
        "cv_embeddings_json": None,
    }


def _get_resume_keywords_for_user(db: Session, *, user_id: str, resume_id: Optional[str]) -> Optional[dict]:
    if not resume_id:
        return None
    prof = db.scalar(select(ResumeProfile).where(ResumeProfile.user_id == user_id, ResumeProfile.resume_id == resume_id))
    if prof and prof.keywords_json:
        parsed = _parse_keywords_json(prof.keywords_json)
        if parsed:
            return parsed
    # Fallback: best-effort extract from stored resume text (and persist to profile)
    resume = db.scalar(select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id, Resume.is_deleted == False))
    if resume is None:
        return None
    text = (resume.text_content or "").strip()
    if (not text) and resume.storage_key:
        upload_dir = Path(settings.UPLOAD_DIR)
        extracted = extract_text_from_path_best_effort(filename=resume.file_name, path=upload_dir / resume.storage_key)
        if extracted:
            text = extracted[:100_000]
            resume.text_content = text
            db.add(resume)
            db.commit()
    if not text:
        return None
    kws = extract_keywords(text)
    kws_json = json.dumps(kws, ensure_ascii=False)
    if prof is None:
        db.add(ResumeProfile(user_id=user_id, resume_id=resume.id, parsed_text=text, keywords_json=kws_json, updated_at=utcnow()))
    else:
        prof.parsed_text = text
        prof.keywords_json = kws_json
        prof.updated_at = utcnow()
    db.commit()
    return kws


@router.get("/api/jobs", response_model=JobListResponse)
def list_jobs(
    query: str = Query("", alias="query"),
    location: str = Query("", alias="location"),
    company: str = Query("", alias="company"),
    withMatch: bool = Query(False, alias="withMatch"),
    favorites: bool = Query(False, alias="favorites"),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(db_session),
) -> JobListResponse:
    """
    Simplify-style local job search.
    - SQLite-friendly LIKE search across title/company/location/description_text
    - only returns active jobs
    - if favorites=true, only returns user's favorited jobs
    """
    filters = [Job.is_active == True]  # noqa: E712

    # If favorites=true, filter to only user's favorited jobs
    if favorites:
        favorite_job_ids = set(
            db.scalars(select(JobFavorite.job_id).where(JobFavorite.user_id == user_id)).all()
        )
        if not favorite_job_ids:
            return JobListResponse(jobs=[], total=0, limit=limit, offset=offset)
        filters.append(Job.id.in_(favorite_job_ids))

    q = (query or "").strip().lower()
    if q:
        like = f"%{q}%"
        filters.append(
            or_(
                func.lower(Job.title).like(like),
                func.lower(Job.company).like(like),
                func.lower(func.coalesce(Job.location, "")).like(like),
                func.lower(Job.description_text).like(like),
            )
        )

    loc = (location or "").strip().lower()
    if loc:
        filters.append(func.lower(func.coalesce(Job.location, "")).like(f"%{loc}%"))

    comp = (company or "").strip().lower()
    if comp:
        filters.append(func.lower(Job.company).like(f"%{comp}%"))

    where_clause = and_(*filters)

    total = db.scalar(select(func.count()).select_from(Job).where(where_clause)) or 0

    # SQLite doesn't support "NULLS LAST" in ORDER BY consistently; emulate with IS NULL.
    rows = list(
        db.scalars(
            select(Job)
            .where(where_clause)
            .order_by(
                Job.posted_at.is_(None),
                Job.posted_at.desc(),
                Job.last_seen_at.is_(None),
                Job.last_seen_at.desc(),
            )
            .offset(offset)
            .limit(limit)
        ).all()
    )

    # If withMatch=true, compute match using user's default resume keywords (if available).
    resume_id: Optional[str] = None
    resume_profile_data = None
    if withMatch:
        user = db.scalar(select(User).where(User.id == user_id))
        resume_id = user.default_resume_id if user else None
        resume_profile_data = _get_resume_profile_data(db, user_id=user_id, resume_id=resume_id) if resume_id else None
    resume_kws = resume_profile_data["keywords"] if resume_profile_data else None

    # Get user's favorite job IDs
    favorite_job_ids = set(
        db.scalars(select(JobFavorite.job_id).where(JobFavorite.user_id == user_id)).all()
    )

    jobs = []
    for j in rows:
        item = JobListItem(
            id=j.id,
            title=j.title,
            company=j.company,
            companyLogoUrl=j.company_logo_url,
            location=j.location,
            descriptionText=j.description_text,
            applyUrl=j.apply_url or j.external_url,
            postedAt=to_iso_z(j.posted_at) if j.posted_at else None,
            source=j.source,
            sourceId=j.source_id,
            isActive=bool(j.is_active),
            isFavorite=j.id in favorite_job_ids,
        )
        if withMatch:
            job_kws = _ensure_job_keywords(db, j) or {}
            # collect unknown terms (job-side) for improving taxonomy over time
            if isinstance(job_kws, dict):
                all_terms = []
                for g in ("skills", "tools", "domain", "titles", "methods"):
                    v = job_kws.get(g) or []
                    if isinstance(v, list):
                        all_terms.extend([str(x) for x in v])
                _record_unknown_terms(db, terms=all_terms)
            item.jobKeywords = KeywordsJson(**job_kws) if isinstance(job_kws, dict) else None
            
            # Use enhanced matching with sections and embeddings
            m = compute_match_v2(
                resume_keywords=resume_kws,
                job_keywords=job_kws,
                jd_sections_json=j.jd_sections_json,
                jd_sections_conf_json=j.jd_sections_conf_json,
                jd_section_keywords_json=j.jd_section_keywords_json,
                jd_embeddings_json=j.jd_embeddings_json,
                cv_sections_json=resume_profile_data["cv_sections_json"] if resume_profile_data else None,
                cv_sections_conf_json=resume_profile_data["cv_sections_conf_json"] if resume_profile_data else None,
                cv_embeddings_json=resume_profile_data["cv_embeddings_json"] if resume_profile_data else None,
            )
            
            # Convert breakdown to API format
            breakdown_dict = None
            if m.breakdown:
                from app.schemas.job import SectionBreakdown
                breakdown_dict = {
                    section_name: SectionBreakdown(
                        sectionName=bd.section_name,
                        lexicalScore=bd.lexical_score,
                        semanticScore=bd.semantic_score,
                        sectionScore=bd.section_score,
                        confidence=bd.confidence,
                        matchedKeywords=KeywordsJson(**bd.matched_keywords),
                        missingKeywords=KeywordsJson(**bd.missing_keywords),
                    )
                    for section_name, bd in m.breakdown.items()
                }
            
            item.match = JobMatchExplain(
                matchScore=m.match_score,
                keywordScore=m.keyword_score,
                clusterScore=m.cluster_score,
                semanticScore=m.semantic_score,
                matchedClusters=m.matched_clusters,
                matchedKeywordsByGroup=KeywordsJson(**m.matched_keywords_by_group),
                missingKeywordsByGroup=KeywordsJson(**m.missing_keywords_by_group),
                softMatchedKeywordsByGroup=KeywordsJson(**m.soft_matched_keywords_by_group),
                breakdown=breakdown_dict,
                note=m.note,
            )
        jobs.append(item)

    return JobListResponse(jobs=jobs, total=int(total), limit=limit, offset=offset)


@router.get("/api/jobs/{jobId}", response_model=JobDetailResponse)
def get_job(
    jobId: str,
    resumeId: Optional[str] = None,
    withMatch: bool = Query(True, alias="withMatch"),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(db_session),
) -> JobDetailResponse:
    job = db.scalar(select(Job).where(Job.id == jobId))
    if job is None:
        raise ApiError(status_code=404, code="NOT_FOUND", message="Job not found")

    job_kws = _ensure_job_keywords(db, job) or {}

    rid = resumeId
    if rid is None:
        user = db.scalar(select(User).where(User.id == user_id))
        rid = user.default_resume_id if user else None
    
    resume_profile_data = _get_resume_profile_data(db, user_id=user_id, resume_id=rid) if (withMatch and rid) else None
    resume_kws = resume_profile_data["keywords"] if resume_profile_data else None
    
    m = None
    if withMatch:
        m = compute_match_v2(
            resume_keywords=resume_kws,
            job_keywords=job_kws,
            jd_sections_json=job.jd_sections_json,
            jd_sections_conf_json=job.jd_sections_conf_json,
            jd_section_keywords_json=job.jd_section_keywords_json,
            jd_embeddings_json=job.jd_embeddings_json,
            cv_sections_json=resume_profile_data["cv_sections_json"] if resume_profile_data else None,
            cv_sections_conf_json=resume_profile_data["cv_sections_conf_json"] if resume_profile_data else None,
            cv_embeddings_json=resume_profile_data["cv_embeddings_json"] if resume_profile_data else None,
        )

    # Check if job is favorited
    is_favorite = db.scalar(
        select(JobFavorite).where(JobFavorite.user_id == user_id, JobFavorite.job_id == jobId)
    ) is not None

    return JobDetailResponse(
        job=JobDetail(
            id=job.id,
            title=job.title,
            company=job.company,
            companyLogoUrl=job.company_logo_url,
            location=job.location,
            jobType=job.job_type,
            tags=job.tags_json or [],
            descriptionText=job.description_text,
            externalUrl=job.external_url,
            applyUrl=job.apply_url or job.external_url,
            postedAt=to_iso_z(job.posted_at) if job.posted_at else None,
            source=job.source,
            sourceId=job.source_id,
            isActive=bool(job.is_active),
            jobKeywords=KeywordsJson(**job_kws) if isinstance(job_kws, dict) else None,
            createdAt=to_iso_z(job.created_at),
            isFavorite=is_favorite,
        ),
        match=(
            JobMatchExplain(
                matchScore=m.match_score,
                keywordScore=m.keyword_score,
                clusterScore=m.cluster_score,
                semanticScore=m.semantic_score,
                matchedClusters=m.matched_clusters,
                matchedKeywordsByGroup=KeywordsJson(**m.matched_keywords_by_group),
                missingKeywordsByGroup=KeywordsJson(**m.missing_keywords_by_group),
                softMatchedKeywordsByGroup=KeywordsJson(**m.soft_matched_keywords_by_group),
                breakdown={
                    section_name: SectionBreakdown(
                        sectionName=bd.section_name,
                        lexicalScore=bd.lexical_score,
                        semanticScore=bd.semantic_score,
                        sectionScore=bd.section_score,
                        confidence=bd.confidence,
                        matchedKeywords=KeywordsJson(**bd.matched_keywords),
                        missingKeywords=KeywordsJson(**bd.missing_keywords),
                    )
                    for section_name, bd in (m.breakdown or {}).items()
                } if m.breakdown else None,
                note=m.note,
            )
            if m is not None
            else None
        ),
    )


@router.post("/api/jobs/{jobId}/favorite", status_code=201)
def favorite_job(
    jobId: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(db_session),
):
    """Add job to favorites."""
    job = db.scalar(select(Job).where(Job.id == jobId))
    if job is None:
        raise ApiError(status_code=404, code="NOT_FOUND", message="Job not found")

    existing = db.scalar(
        select(JobFavorite).where(JobFavorite.user_id == user_id, JobFavorite.job_id == jobId)
    )
    if existing is not None:
        return {"message": "Job already favorited"}

    favorite = JobFavorite(user_id=user_id, job_id=jobId)
    db.add(favorite)
    db.commit()
    return {"message": "Job favorited"}


@router.delete("/api/jobs/{jobId}/favorite", status_code=200)
def unfavorite_job(
    jobId: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(db_session),
):
    """Remove job from favorites."""
    favorite = db.scalar(
        select(JobFavorite).where(JobFavorite.user_id == user_id, JobFavorite.job_id == jobId)
    )
    if favorite is None:
        raise ApiError(status_code=404, code="NOT_FOUND", message="Favorite not found")

    db.delete(favorite)
    db.commit()
    return {"message": "Job unfavorited"}

