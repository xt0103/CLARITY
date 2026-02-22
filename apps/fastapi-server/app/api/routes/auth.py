from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import db_session, get_current_user_id
from app.core.errors import ApiError
from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.core.time import to_iso_z
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    MeResponse,
    MeUser,
    RegisterRequest,
    RegisterResponse,
    UserPublic,
)


router = APIRouter(tags=["auth"])


@router.post("/api/auth/register", response_model=RegisterResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(db_session)) -> RegisterResponse:
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing is not None:
        raise ApiError(status_code=409, code="CONFLICT", message="Email already exists")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        name=payload.name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return RegisterResponse(user=UserPublic(id=user.id, email=user.email, name=user.name))


@router.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(db_session)) -> LoginResponse:
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise ApiError(status_code=401, code="UNAUTHORIZED", message="Invalid credentials")

    token = create_access_token(subject=user.id, expires_in=settings.JWT_EXPIRES_IN)
    return LoginResponse(accessToken=token, tokenType="Bearer", expiresIn=settings.JWT_EXPIRES_IN)


@router.get("/api/me", response_model=MeResponse)
def me(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(db_session),
) -> MeResponse:
    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise ApiError(status_code=401, code="UNAUTHORIZED", message="Unauthorized")

    return MeResponse(
        user=MeUser(
            id=user.id,
            email=user.email,
            name=user.name,
            defaultResumeId=user.default_resume_id,
            createdAt=to_iso_z(user.created_at),
        )
    )

