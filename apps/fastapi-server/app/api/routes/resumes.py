import os
import uuid
from pathlib import Path
import json

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import db_session, get_current_user_id
from app.core.config import settings
from app.core.errors import ApiError
from app.core.resume_text import extract_text_from_bytes_best_effort, extract_text_from_path_best_effort
from app.core.time import to_iso_z, utcnow
from app.models.resume import Resume
from app.models.resume_profile import ResumeProfile
from app.models.user import User
from app.nlp.keyword_extractor import extract_keywords
from app.nlp.cv_segmenter import segment_cv
from app.nlp.embeddings import generate_section_embeddings, embeddings_to_json
from app.schemas.resume import (
    ResumeCreateResponse,
    ResumeDetailResponse,
    ResumeItem,
    ResumeListResponse,
    ResumeParseResponse,
    ResumePatchRequest,
    ResumePatchResponse,
)
from app.api.routes.jobs import _parse_keywords_json


router = APIRouter(tags=["resumes"])


def _ensure_upload_dir() -> Path:
    p = Path(settings.UPLOAD_DIR)
    p.mkdir(parents=True, exist_ok=True)
    return p


def _is_allowed_resume(file: UploadFile) -> bool:
    filename = (file.filename or "").lower()
    return filename.endswith(".pdf") or filename.endswith(".docx")


async def _read_limited(file: UploadFile, max_bytes: int) -> bytes:
    buf = bytearray()
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        buf.extend(chunk)
        if len(buf) > max_bytes:
            raise ApiError(status_code=413, code="VALIDATION_ERROR", message="File too large")
    return bytes(buf)


@router.post("/api/resumes", response_model=ResumeCreateResponse, status_code=201)
async def upload_resume(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(db_session),
) -> ResumeCreateResponse:
    if not _is_allowed_resume(file):
        raise ApiError(status_code=422, code="VALIDATION_ERROR", message="Unsupported file type")

    upload_dir = _ensure_upload_dir()
    raw = await _read_limited(file, settings.MAX_UPLOAD_BYTES)

    safe_name = os.path.basename(file.filename or "resume")
    storage_name = f"{uuid.uuid4()}_{safe_name}"
    storage_path = upload_dir / storage_name
    storage_path.write_bytes(raw)

    extracted = extract_text_from_bytes_best_effort(filename=safe_name, raw=raw)
    if extracted:
        # Keep it bounded to avoid huge rows (and keep SQLite snappy).
        extracted = extracted[:100_000]

    resume = Resume(user_id=user_id, file_name=safe_name, storage_key=str(storage_name), text_content=extracted)
    db.add(resume)
    db.commit()
    db.refresh(resume)

    # Auto-generate resume keywords, segments, and embeddings when we have extracted text.
    if extracted and extracted.strip():
        kws = extract_keywords(extracted)
        
        # Segment CV and generate embeddings
        cv_sections_json = None
        cv_sections_conf_json = None
        cv_embeddings_json = None
        cv_sections_updated_at = None
        
        try:
            segments_result = segment_cv(extracted, sections_json=None)
            cv_sections_json = json.dumps(segments_result["sections"], ensure_ascii=False)
            cv_sections_conf_json = json.dumps(segments_result["confidence"], ensure_ascii=False)
            
            section_embeddings = generate_section_embeddings(segments_result["sections"])
            cv_embeddings_json = embeddings_to_json(section_embeddings)
            
            cv_sections_updated_at = utcnow()
        except Exception:
            # Silently fail - not critical
            pass
        
        existing_profile = db.scalar(select(ResumeProfile).where(ResumeProfile.resume_id == resume.id))
        if existing_profile is None:
            db.add(
                ResumeProfile(
                    user_id=user_id,
                    resume_id=resume.id,
                    parsed_text=extracted,
                    keywords_json=json.dumps(kws, ensure_ascii=False),
                    cv_sections_json=cv_sections_json,
                    cv_sections_conf_json=cv_sections_conf_json,
                    cv_embeddings_json=cv_embeddings_json,
                    cv_sections_updated_at=cv_sections_updated_at,
                    updated_at=utcnow(),
                )
            )
        else:
            existing_profile.parsed_text = extracted
            existing_profile.keywords_json = json.dumps(kws, ensure_ascii=False)
            # Update sections/embeddings if text changed or missing
            if extracted != existing_profile.parsed_text or not existing_profile.cv_sections_json:
                existing_profile.cv_sections_json = cv_sections_json
                existing_profile.cv_sections_conf_json = cv_sections_conf_json
                existing_profile.cv_embeddings_json = cv_embeddings_json
                existing_profile.cv_sections_updated_at = cv_sections_updated_at
            existing_profile.updated_at = utcnow()
        db.commit()

    user = db.scalar(select(User).where(User.id == user_id))
    # UX: if user has no default resume yet, set the first uploaded resume as default.
    if user is not None and user.default_resume_id is None:
        user.default_resume_id = resume.id
        db.commit()
        db.refresh(user)

    is_default = user is not None and user.default_resume_id == resume.id

    return ResumeCreateResponse(
        resume=ResumeItem(
            id=resume.id,
            fileName=resume.file_name,
            createdAt=to_iso_z(resume.created_at),
            isDefault=is_default,
        )
    )


@router.post("/api/resumes/{resumeId}/parse", response_model=ResumeParseResponse)
def parse_resume(
    resumeId: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(db_session),
) -> ResumeParseResponse:
    resume = db.scalar(select(Resume).where(Resume.id == resumeId, Resume.user_id == user_id, Resume.is_deleted == False))
    if resume is None:
        raise ApiError(status_code=404, code="NOT_FOUND", message="Resume not found")

    text = (resume.text_content or "").strip()
    if not text and resume.storage_key:
        p = Path(settings.UPLOAD_DIR) / resume.storage_key
        extracted = extract_text_from_path_best_effort(filename=resume.file_name, path=p)
        if extracted:
            text = extracted[:100_000]
            resume.text_content = text
            db.add(resume)
            db.commit()

    if not text:
        raise ApiError(status_code=422, code="VALIDATION_ERROR", message="Resume text is empty or could not be extracted")

    kws = extract_keywords(text)
    
    # Segment CV and generate embeddings
    cv_sections_json = None
    cv_sections_conf_json = None
    cv_embeddings_json = None
    cv_sections_updated_at = None
    
    try:
        segments_result = segment_cv(text, sections_json=None)  # Could use profile.cv_sections_json if exists
        cv_sections_json = json.dumps(segments_result["sections"], ensure_ascii=False)
        cv_sections_conf_json = json.dumps(segments_result["confidence"], ensure_ascii=False)
        
        # Generate embeddings for each section
        section_embeddings = generate_section_embeddings(segments_result["sections"])
        cv_embeddings_json = embeddings_to_json(section_embeddings)
        
        cv_sections_updated_at = utcnow()
    except Exception:
        # Silently fail - not critical
        pass
    
    profile = db.scalar(select(ResumeProfile).where(ResumeProfile.resume_id == resume.id))
    if profile is None:
        profile = ResumeProfile(
            user_id=user_id,
            resume_id=resume.id,
            parsed_text=text,
            keywords_json=json.dumps(kws, ensure_ascii=False),
            updated_at=utcnow(),
        )
        db.add(profile)
    else:
        profile.parsed_text = text
        profile.keywords_json = json.dumps(kws, ensure_ascii=False)
        profile.updated_at = utcnow()

    db.commit()
    db.refresh(profile)
    return ResumeParseResponse(resumeId=resume.id, keywords=kws, updatedAt=to_iso_z(profile.updated_at))


@router.get("/api/resumes", response_model=ResumeListResponse)
def list_resumes(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(db_session),
) -> ResumeListResponse:
    user = db.scalar(select(User).where(User.id == user_id))
    default_id = user.default_resume_id if user else None

    resumes = db.scalars(
        select(Resume).where(Resume.user_id == user_id, Resume.is_deleted == False).order_by(Resume.created_at.desc())
    ).all()

    return ResumeListResponse(
        resumes=[
            ResumeItem(
                id=r.id,
                fileName=r.file_name,
                createdAt=to_iso_z(r.created_at),
                isDefault=(r.id == default_id),
            )
            for r in resumes
        ]
    )


@router.patch("/api/resumes/{resumeId}", response_model=ResumePatchResponse)
def patch_resume(
    resumeId: str,
    payload: ResumePatchRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(db_session),
) -> ResumePatchResponse:
    resume = db.scalar(
        select(Resume).where(Resume.id == resumeId, Resume.user_id == user_id, Resume.is_deleted == False)
    )
    if resume is None:
        raise ApiError(status_code=404, code="NOT_FOUND", message="Resume not found")

    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise ApiError(status_code=401, code="UNAUTHORIZED", message="Unauthorized")

    if payload.fileName is not None:
        resume.file_name = payload.fileName

    if payload.setAsDefault:
        user.default_resume_id = resume.id

    db.commit()
    db.refresh(resume)

    is_default = user.default_resume_id == resume.id
    return ResumePatchResponse(
        resume=ResumeItem(
            id=resume.id,
            fileName=resume.file_name,
            createdAt=to_iso_z(resume.created_at),
            isDefault=is_default,
        ),
        user={"defaultResumeId": user.default_resume_id},
    )


@router.get("/api/resumes/{resumeId}", response_model=ResumeDetailResponse)
def get_resume_detail(
    resumeId: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(db_session),
) -> ResumeDetailResponse:
    resume = db.scalar(select(Resume).where(Resume.id == resumeId, Resume.user_id == user_id, Resume.is_deleted == False))
    if resume is None:
        raise ApiError(status_code=404, code="NOT_FOUND", message="Resume not found")

    text_content = resume.text_content
    if not text_content and resume.storage_key:
        p = Path(settings.UPLOAD_DIR) / resume.storage_key
        extracted = extract_text_from_path_best_effort(filename=resume.file_name, path=p)
        if extracted:
            text_content = extracted[:100_000]
            resume.text_content = text_content
            db.add(resume)
            db.commit()

    user = db.scalar(select(User).where(User.id == user_id))
    is_default = user is not None and user.default_resume_id == resume.id

    # 获取关键词（如果已解析）
    keywords = None
    profile = db.scalar(select(ResumeProfile).where(ResumeProfile.resume_id == resume.id))
    if profile and profile.keywords_json:
        keywords = _parse_keywords_json(profile.keywords_json)

    return ResumeDetailResponse(
        resume=ResumeItem(
            id=resume.id,
            fileName=resume.file_name,
            createdAt=to_iso_z(resume.created_at),
            isDefault=is_default,
        ),
        textContent=text_content,
        keywords=keywords,
    )


@router.delete("/api/resumes/{resumeId}", status_code=204)
def delete_resume(
    resumeId: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(db_session),
):
    resume = db.scalar(select(Resume).where(Resume.id == resumeId, Resume.user_id == user_id, Resume.is_deleted == False))
    if resume is None:
        raise ApiError(status_code=404, code="NOT_FOUND", message="Resume not found")

    user = db.scalar(select(User).where(User.id == user_id))
    if user and user.default_resume_id == resume.id:
        user.default_resume_id = None

    resume.is_deleted = True
    db.commit()
    return None

