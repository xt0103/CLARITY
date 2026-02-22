from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import Optional


def extract_text_from_bytes_best_effort(*, filename: str, raw: bytes) -> Optional[str]:
    """
    Best-effort text extraction. Never raises (returns None on failure).

    - PDF: uses pypdf (extract_text)
    - DOCX: uses python-docx (paragraph text)
    """
    name = (filename or "").lower()
    try:
        if name.endswith(".pdf"):
            try:
                from pypdf import PdfReader  # type: ignore
            except Exception:
                return None
            reader = PdfReader(BytesIO(raw))
            parts: list[str] = []
            for p in reader.pages:
                t = p.extract_text() or ""
                if t.strip():
                    parts.append(t)
            text = "\n".join(parts).strip()
            return text or None

        if name.endswith(".docx"):
            try:
                from docx import Document  # type: ignore
            except Exception:
                return None
            doc = Document(BytesIO(raw))
            parts = [para.text for para in doc.paragraphs if (para.text or "").strip()]
            text = "\n".join(parts).strip()
            return text or None
    except Exception:
        return None
    return None


def extract_text_from_path_best_effort(*, filename: str, path: Path) -> Optional[str]:
    try:
        raw = path.read_bytes()
    except Exception:
        return None
    return extract_text_from_bytes_best_effort(filename=filename, raw=raw)

