from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass(frozen=True)
class NormalizedJob:
    source: str
    source_id: str

    title: str
    company: str
    location: Optional[str]

    description_text: str
    apply_url: Optional[str]

    posted_at: Optional[datetime]
    raw_json: Optional[str]

