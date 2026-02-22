import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from pathlib import Path
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import db_session, get_current_user_id
from app.core.config import settings
from app.core.errors import ApiError
from app.core.resume_text import extract_text_from_path_best_effort
from app.models.job import Job
from app.models.resume import Resume
from app.models.user import User
from app.schemas.match import MatchJobCard, MatchSearchRequest, MatchSearchResponse


router = APIRouter(tags=["match"])


_WORD_RE = re.compile(r"[a-zA-Z0-9]+")


def _tokens(text: str) -> set[str]:
    return {t.lower() for t in _WORD_RE.findall(text or "") if len(t) >= 3}


def _match_score_and_rationale(*, query: str, resume_text: Optional[str], job: Job) -> tuple[int, list[str]]:
    q_tokens = _tokens(query)
    r_tokens = _tokens(resume_text or "") if resume_text else set()

    job_text = " ".join(
        [
            job.title or "",
            job.company or "",
            job.location or "",
            job.job_type or "",
            " ".join(job.tags_json or []),
            job.description_text or "",
        ]
    )
    job_tokens = _tokens(job_text)

    if not q_tokens and not r_tokens:
        return 0, ["No keywords available for matching", "Provide a query or upload a resume to improve matching"]

    q_overlap = sorted(list(q_tokens & job_tokens))[:8]
    r_overlap = sorted(list(r_tokens & job_tokens))[:8]

    # Weighted score: query is primary; resume boosts the score when available.
    q_den = max(1, min(len(q_tokens), 10))
    r_den = max(1, min(len(r_tokens), 40))
    q_part = (len(q_overlap) / q_den) * 70
    r_part = (len(r_overlap) / r_den) * 30 if r_tokens else 0
    score = int(min(100, round(q_part + r_part)))

    rationale: list[str] = []
    if q_overlap:
        rationale.append(f"Query matches: {', '.join(q_overlap)}")
    else:
        rationale.append("Query has limited overlap with this JD")

    if r_tokens:
        if r_overlap:
            rationale.append(f"Resume matches: {', '.join(r_overlap)}")
        else:
            rationale.append("Resume has limited overlap with this JD")
    else:
        rationale.append("No resume text used (query-only matching)")

    rationale.append("Score is computed using a weighted keyword overlap heuristic (MVP)")
    return score, rationale[:4]


@router.post("/api/match/search", response_model=MatchSearchResponse)
def search(
    payload: MatchSearchRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(db_session),
) -> MatchSearchResponse:
    if not payload.queryText or not payload.queryText.strip():
        raise ApiError(status_code=400, code="VALIDATION_ERROR", message="queryText is required")

    resume_id = payload.resumeId
    if resume_id is None:
        user = db.scalar(select(User).where(User.id == user_id))
        resume_id = user.default_resume_id if user else None

    resume_text: Optional[str] = None
    if resume_id:
        resume = db.scalar(
            select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id, Resume.is_deleted == False)
        )
        if resume is not None:
            resume_text = resume.text_content
            if (not resume_text or not resume_text.strip()) and resume.storage_key:
                # Lazy extract for older resumes uploaded before extraction existed.
                upload_dir = Path(settings.UPLOAD_DIR)
                text = extract_text_from_path_best_effort(filename=resume.file_name, path=upload_dir / resume.storage_key)
                if text:
                    resume.text_content = text[:100_000]
                    db.commit()
                    resume_text = resume.text_content

    q = payload.queryText.strip()
    tokens = list(_tokens(q))[:5]

    conditions = []
    for t in tokens:
        like = f"%{t}%"
        conditions.append(Job.title.ilike(like))
        conditions.append(Job.company.ilike(like))
        conditions.append(Job.description_text.ilike(like))

    stmt = select(Job)
    if conditions:
        stmt = stmt.where(or_(*conditions))

    if payload.filters:
        if payload.filters.location:
            stmt = stmt.where(Job.location.ilike(f"%{payload.filters.location}%"))
        if payload.filters.jobType:
            stmt = stmt.where(Job.job_type == payload.filters.jobType)

    fetch_limit = max(payload.limit * 5, payload.limit)
    jobs = db.scalars(stmt.limit(fetch_limit)).all()

    if payload.filters and payload.filters.tags:
        want = {t.lower() for t in payload.filters.tags}
        jobs = [j for j in jobs if want.intersection({t.lower() for t in (j.tags_json or [])})]

    jobs = jobs[: payload.limit]

    cards: list[MatchJobCard] = []
    for job in jobs:
        score, rationale = _match_score_and_rationale(query=q, resume_text=resume_text, job=job)
        cards.append(
            MatchJobCard(
                jobId=job.id,
                title=job.title,
                company=job.company,
                location=job.location,
                jobType=job.job_type,
                tags=job.tags_json or [],
                externalUrl=job.external_url,
                source=job.source,
                matchScore=score,
                matchRationale=rationale,
            )
        )

    return MatchSearchResponse(sessionId=str(uuid.uuid4()), jobs=cards)

