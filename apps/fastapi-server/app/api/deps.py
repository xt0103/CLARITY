from __future__ import annotations

from typing import Optional

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose.exceptions import JWTError
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import ApiError
from app.core.security import decode_token


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user_id(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> str:
    if creds is None or not creds.credentials:
        raise ApiError(status_code=401, code="UNAUTHORIZED", message="Unauthorized")
    try:
        payload = decode_token(creds.credentials)
        user_id = payload.get("sub")
        if not user_id:
            raise ApiError(status_code=401, code="UNAUTHORIZED", message="Unauthorized")
        return str(user_id)
    except JWTError:
        raise ApiError(status_code=401, code="UNAUTHORIZED", message="Unauthorized")


def db_session(db: Session = Depends(get_db)) -> Session:
    return db

