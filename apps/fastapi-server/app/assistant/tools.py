"""
Tool definitions and executors for AI assistant.
"""
import json
from typing import Any, Optional
from datetime import date

from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.time import to_iso_z, utcnow
from app.models.job import Job
from app.models.job_favorite import JobFavorite
from app.models.user import User
from app.models.resume import Resume
from app.models.resume_profile import ResumeProfile
from app.models.application import Application
from app.api.routes.jobs import (
    _ensure_job_keywords,
    _get_resume_keywords_for_user,
    _parse_keywords_json,
)
from app.match.match_engine import compute_match
from app.schemas.job import JobListItem, JobDetail, KeywordsJson, JobMatchExplain
from sqlalchemy import and_, func, or_, select


# Tool schemas for OpenAI
TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "search_jobs",
            "description": "Search for jobs from the database. Use this when user asks to find, search, filter, or recommend jobs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "queryText": {
                        "type": "string",
                        "description": "Search query text (keywords, job title, skills, etc.)"
                    },
                    "filters": {
                        "type": "object",
                        "properties": {
                            "location": {"type": "string", "description": "Filter by location (e.g., 'Singapore', 'Remote')"},
                            "jobType": {"type": "string", "description": "Filter by job type (e.g., 'Full-time', 'Part-time', 'Intern')"},
                            "company": {"type": "string", "description": "Filter by company name"},
                            "tags": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Filter by tags/skills"
                            }
                        }
                    },
                    "limit": {"type": "integer", "description": "Maximum number of results (default: 20, max: 50)", "default": 20},
                    "offset": {"type": "integer", "description": "Offset for pagination (default: 0)", "default": 0},
                    "sortBy": {
                        "type": "string",
                        "enum": ["relevance", "recent", "match"],
                        "description": "Sort order: relevance (default), recent (by posted date), match (by match score if available)",
                        "default": "relevance"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_job_detail",
            "description": "Get detailed information about a specific job by ID. Use this when user asks about a specific job or wants to see full job description.",
            "parameters": {
                "type": "object",
                "properties": {
                    "jobId": {
                        "type": "string",
                        "description": "The job ID"
                    }
                },
                "required": ["jobId"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_application",
            "description": "Create a job application record in the tracker. Use this when user confirms they want to apply to a job.",
            "parameters": {
                "type": "object",
                "properties": {
                    "jobId": {
                        "type": "string",
                        "description": "The job ID (optional if jobSnapshot is provided)"
                    },
                    "jobSnapshot": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "company": {"type": "string"},
                            "location": {"type": "string"},
                            "externalUrl": {"type": "string"}
                        },
                        "required": ["title", "company"]
                    },
                    "platformSource": {
                        "type": "string",
                        "enum": ["OFFICIAL", "LINKEDIN", "REFERRAL", "OTHER"],
                        "default": "OFFICIAL"
                    },
                    "dateApplied": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format (defaults to today)"
                    },
                    "status": {
                        "type": "string",
                        "enum": ["APPLIED", "UNDER_REVIEW", "INTERVIEW", "OFFER", "REJECTED"],
                        "default": "APPLIED"
                    }
                },
                "required": ["jobSnapshot"]
            }
        }
    }
]


def execute_search_jobs(
    db: Session,
    user_id: str,
    query_text: Optional[str] = None,
    filters: Optional[dict] = None,
    limit: int = 20,
    offset: int = 0,
    sort_by: str = "relevance",
) -> dict[str, Any]:
    """
    Execute search_jobs tool.
    Returns jobs list compatible with JobListResponse format.
    """
    filters = filters or {}
    
    # Build query filters
    where_clauses = [Job.is_active == True]  # noqa: E712
    
    q = (query_text or "").strip().lower()
    if q:
        like = f"%{q}%"
        where_clauses.append(
            or_(
                func.lower(Job.title).like(like),
                func.lower(Job.company).like(like),
                func.lower(func.coalesce(Job.location, "")).like(like),
                func.lower(Job.description_text).like(like),
            )
        )
    
    loc = (filters.get("location") or "").strip().lower()
    if loc:
        where_clauses.append(func.lower(func.coalesce(Job.location, "")).like(f"%{loc}%"))
    
    comp = (filters.get("company") or "").strip().lower()
    if comp:
        where_clauses.append(func.lower(Job.company).like(f"%{comp}%"))
    
    where_clause = and_(*where_clauses)
    
    # Get user's default resume for matching
    user = db.scalar(select(User).where(User.id == user_id))
    resume_id = user.default_resume_id if user else None
    resume_kws = _get_resume_keywords_for_user(db, user_id=user_id, resume_id=resume_id)
    
    # Get favorite job IDs
    favorite_job_ids = set(
        db.scalars(select(JobFavorite.job_id).where(JobFavorite.user_id == user_id)).all()
    )
    
    # Query jobs
    total = db.scalar(select(func.count()).select_from(Job).where(where_clause)) or 0
    
    # Order by
    if sort_by == "recent":
        order_by = (Job.posted_at.is_(None), Job.posted_at.desc(), Job.last_seen_at.is_(None), Job.last_seen_at.desc())
    elif sort_by == "match" and resume_kws:
        # For match sorting, we'll compute match scores and sort client-side (simplified)
        order_by = (Job.posted_at.is_(None), Job.posted_at.desc(), Job.last_seen_at.is_(None), Job.last_seen_at.desc())
    else:
        order_by = (Job.posted_at.is_(None), Job.posted_at.desc(), Job.last_seen_at.is_(None), Job.last_seen_at.desc())
    
    rows = list(
        db.scalars(
            select(Job)
            .where(where_clause)
            .order_by(*order_by)
            .offset(offset)
            .limit(min(limit, 50))
        ).all()
    )
    
    # Build response
    jobs = []
    for j in rows:
        item = {
            "id": j.id,
            "title": j.title,
            "company": j.company,
            "location": j.location,
            "descriptionText": j.description_text[:500] if j.description_text else "",  # Truncate for list
            "applyUrl": j.apply_url or j.external_url,
            "postedAt": to_iso_z(j.posted_at) if j.posted_at else None,
            "source": j.source,
            "sourceId": j.source_id,
            "isActive": bool(j.is_active),
            "isFavorite": j.id in favorite_job_ids,
        }
        
        # Add keywords and match if resume available
        if resume_kws:
            job_kws = _ensure_job_keywords(db, j) or {}
            item["jobKeywords"] = job_kws if isinstance(job_kws, dict) else {}
            
            m = compute_match(resume_keywords=resume_kws, job_keywords=job_kws)
            item["match"] = {
                "matchScore": m.match_score,
                "keywordScore": m.keyword_score,
                "clusterScore": m.cluster_score,
                "matchedClusters": m.matched_clusters,
                "matchedKeywordsByGroup": m.matched_by_group,
                "missingKeywordsByGroup": m.missing_by_group,
            }
        
        jobs.append(item)
    
    # Sort by match if requested
    if sort_by == "match" and resume_kws:
        jobs.sort(key=lambda x: x.get("match", {}).get("matchScore", 0), reverse=True)
    
    return {
        "jobs": jobs,
        "total": int(total),
        "limit": limit,
        "offset": offset
    }


def execute_get_job_detail(
    db: Session,
    user_id: str,
    job_id: str,
) -> dict[str, Any]:
    """
    Execute get_job_detail tool.
    Returns job detail compatible with JobDetailResponse format.
    """
    job = db.scalar(select(Job).where(Job.id == job_id))
    if job is None:
        raise ApiError(status_code=404, code="NOT_FOUND", message=f"Job {job_id} not found")
    
    job_kws = _ensure_job_keywords(db, job) or {}
    
    # Get user's default resume for matching
    user = db.scalar(select(User).where(User.id == user_id))
    resume_id = user.default_resume_id if user else None
    resume_kws = _get_resume_keywords_for_user(db, user_id=user_id, resume_id=resume_id)
    
    # Check if favorited
    is_favorite = db.scalar(
        select(JobFavorite).where(JobFavorite.user_id == user_id, JobFavorite.job_id == job_id)
    ) is not None
    
    result = {
        "id": job.id,
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "jobType": job.job_type,
        "tags": job.tags_json or [],
        "descriptionText": job.description_text,
        "externalUrl": job.external_url,
        "applyUrl": job.apply_url or job.external_url,
        "postedAt": to_iso_z(job.posted_at) if job.posted_at else None,
        "source": job.source,
        "sourceId": job.source_id,
        "isActive": bool(job.is_active),
        "jobKeywords": job_kws if isinstance(job_kws, dict) else {},
        "createdAt": to_iso_z(job.created_at),
        "isFavorite": is_favorite,
    }
    
    # Add match if resume available
    if resume_kws:
        m = compute_match(resume_keywords=resume_kws, job_keywords=job_kws)
        result["match"] = {
            "matchScore": m.match_score,
            "keywordScore": m.keyword_score,
            "clusterScore": m.cluster_score,
            "matchedClusters": m.matched_clusters,
            "matchedKeywordsByGroup": m.matched_by_group,
            "missingKeywordsByGroup": m.missing_by_group,
        }
    
    return result


def execute_create_application(
    db: Session,
    user_id: str,
    job_id: Optional[str] = None,
    job_snapshot: Optional[dict] = None,
    platform_source: str = "OFFICIAL",
    date_applied: Optional[str] = None,
    status: str = "APPLIED",
) -> dict[str, Any]:
    """
    Execute create_application tool.
    Returns created application info.
    """
    if not job_snapshot or not job_snapshot.get("title") or not job_snapshot.get("company"):
        raise ApiError(status_code=422, code="VALIDATION_ERROR", message="Missing required jobSnapshot fields")
    
    # Parse date
    if date_applied:
        try:
            applied_date = date.fromisoformat(date_applied)
        except Exception:
            raise ApiError(status_code=422, code="VALIDATION_ERROR", message="Invalid date format (YYYY-MM-DD expected)")
    else:
        applied_date = date.today()
    
    app_row = Application(
        user_id=user_id,
        job_id=job_id,
        snapshot_title=job_snapshot["title"],
        snapshot_company=job_snapshot["company"],
        snapshot_location=job_snapshot.get("location"),
        snapshot_external_url=job_snapshot.get("externalUrl"),
        platform_source=platform_source,
        date_applied=applied_date,
        status=status,
        priority="MEDIUM",
        notes="Applied via AI assistant",
    )
    db.add(app_row)
    db.commit()
    db.refresh(app_row)
    
    return {
        "id": app_row.id,
        "jobId": app_row.job_id,
        "snapshotTitle": app_row.snapshot_title,
        "snapshotCompany": app_row.snapshot_company,
        "status": app_row.status,
        "dateApplied": app_row.date_applied.isoformat(),
    }


def execute_tool(tool_name: str, arguments: dict[str, Any], db: Session, user_id: str) -> dict[str, Any]:
    """
    Execute a tool by name.
    """
    if tool_name == "search_jobs":
        return execute_search_jobs(
            db=db,
            user_id=user_id,
            query_text=arguments.get("queryText"),
            filters=arguments.get("filters"),
            limit=arguments.get("limit", 20),
            offset=arguments.get("offset", 0),
            sort_by=arguments.get("sortBy", "relevance"),
        )
    elif tool_name == "get_job_detail":
        return execute_get_job_detail(
            db=db,
            user_id=user_id,
            job_id=arguments["jobId"],
        )
    elif tool_name == "create_application":
        return execute_create_application(
            db=db,
            user_id=user_id,
            job_id=arguments.get("jobId"),
            job_snapshot=arguments.get("jobSnapshot"),
            platform_source=arguments.get("platformSource", "OFFICIAL"),
            date_applied=arguments.get("dateApplied"),
            status=arguments.get("status", "APPLIED"),
        )
    else:
        raise ApiError(status_code=400, code="INVALID_TOOL", message=f"Unknown tool: {tool_name}")
