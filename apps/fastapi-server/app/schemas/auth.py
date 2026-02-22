from __future__ import annotations

from typing import Optional

from app.schemas.base import APIModel


class RegisterRequest(APIModel):
    email: str
    password: str
    name: str


class LoginRequest(APIModel):
    email: str
    password: str


class UserPublic(APIModel):
    id: str
    email: str
    name: Optional[str] = None


class RegisterResponse(APIModel):
    user: UserPublic


class LoginResponse(APIModel):
    accessToken: str
    tokenType: str
    expiresIn: int


class MeUser(APIModel):
    id: str
    email: str
    name: Optional[str] = None
    defaultResumeId: Optional[str] = None
    createdAt: str


class MeResponse(APIModel):
    user: MeUser

