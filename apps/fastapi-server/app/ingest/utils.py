from __future__ import annotations

import html as _html
import re


_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"[ \t\r\f\v]+")
_MULTI_NL_RE = re.compile(r"\n{3,}")
_SCRIPT_STYLE_RE = re.compile(r"(?is)<(script|style)[^>]*>.*?</\\1>")
_BREAKS_RE = re.compile(r"(?i)<br\\s*/?>")
_BLOCK_END_RE = re.compile(r"(?i)</(p|div|h1|h2|h3|h4|h5|h6|ul|ol|li)>")


def html_to_text(value: str) -> str:
    """
    MVP HTML -> plain text converter.
    - unescapes entities (Greenhouse often returns escaped HTML like &lt;h2&gt;...)
    - converts basic block tags to newlines
    - strips tags
    - collapses whitespace while preserving newlines
    """
    if not value:
        return ""
    # 1) Unescape first so we can strip tags even if HTML is entity-escaped.
    text = _html.unescape(value)
    # Sometimes content can be double-escaped; unescape twice is still safe.
    text = _html.unescape(text)

    # 2) Remove script/style blobs early.
    text = _SCRIPT_STYLE_RE.sub(" ", text)

    # 3) Convert some common blocks to newlines for readability.
    text = _BREAKS_RE.sub("\n", text)
    text = _BLOCK_END_RE.sub("\n", text)

    # 4) Strip remaining tags.
    text = _TAG_RE.sub(" ", text)

    # 5) Normalize whitespace but keep newlines.
    text = _WS_RE.sub(" ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = _MULTI_NL_RE.sub("\n\n", text)
    return text.strip()

