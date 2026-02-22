from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class ApiError(Exception):
    status_code: int
    code: str
    message: str
    details: Optional[dict[str, Any]] = None


def error_payload(*, code: str, message: str, details: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"error": {"code": code, "message": message}}
    if details is not None:
        payload["error"]["details"] = details
    return payload

