from __future__ import annotations

import re
from collections import Counter
from typing import Dict, Iterable, List, Literal, Set

from app.nlp.skill_taxonomy import alias_map, canonicalize_term, normalize_term

KeywordGroup = Literal["skills", "tools", "domain", "titles", "methods"]
KeywordsJson = Dict[KeywordGroup, List[str]]


_WORD_RE = re.compile(r"[a-zA-Z0-9#+\.]+")
_SPACE_RE = re.compile(r"\s+")


# Minimal stopwords (English) for MVP n-gram extraction.
_STOPWORDS: Set[str] = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "but",
    "by",
    "for",
    "from",
    "has",
    "have",
    "in",
    "into",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "our",
    "that",
    "the",
    "their",
    "this",
    "to",
    "we",
    "will",
    "with",
    "you",
    "your",
}


# Dictionary phrases for deterministic extraction (MVP).
# Keep it short & high-signal; you can expand later.
_DICT: Dict[KeywordGroup, List[str]] = {
    "skills": [
        "sql",
        "python",
        "java",
        "javascript",
        "typescript",
        "react",
        "next.js",
        "node.js",
        "go",
        "rust",
        "c++",
        "c#",
        "kotlin",
        "swift",
        "graphql",
        "rest",
        "microservices",
        "distributed systems",
        "system design",
        "data analysis",
        "machine learning",
        "deep learning",
        "nlp",
    ],
    "tools": [
        "aws",
        "gcp",
        "azure",
        "docker",
        "kubernetes",
        "terraform",
        "git",
        "linux",
        "postgresql",
        "mysql",
        "sqlite",
        "redis",
        "spark",
        "kafka",
        "airflow",
        "tableau",
        "power bi",
        "figma",
    ],
    "titles": [
        "software engineer",
        "frontend engineer",
        "backend engineer",
        "full stack engineer",
        "data scientist",
        "data analyst",
        "product manager",
        "ux designer",
        "ui designer",
        "product designer",
        "research scientist",
    ],
    # domain/methods mostly from n-grams; keep a small list for disambiguation
    "domain": [
        "fintech",
        "saas",
        "e-commerce",
        "payments",
        "cloud",
        "security",
        "healthcare",
        "ads",
        "growth",
    ],
    "methods": [
        "a/b testing",
        "experimentation",
        "user research",
        "agile",
        "scrum",
        "kanban",
        "ci/cd",
        "code review",
        "incident response",
        "observability",
    ],
}


def _norm_token(s: str) -> str:
    # Use shared taxonomy normalization + alias mapping.
    return canonicalize_term(s)


def _contains_phrase(text_lc: str, phrase: str) -> bool:
    # Word-boundary-ish match for multiword phrases; avoid regex heavy.
    p = phrase.lower()
    if " " in p:
        return p in text_lc
    # single token
    return re.search(rf"(^|[^a-z0-9]){re.escape(p)}([^a-z0-9]|$)", text_lc) is not None


def _extract_from_dict(text: str, group: KeywordGroup) -> List[str]:
    text_lc = (text or "").lower()
    out: List[str] = []
    for phrase in _DICT.get(group, []):
        if _contains_phrase(text_lc, phrase):
            out.append(_norm_token(phrase))
    return out


# canonical term -> group (best-effort) so alias hits can be placed into a group
_CANON_TO_GROUP: Dict[str, KeywordGroup] = {}
for g, phrases in _DICT.items():
    for p in phrases:
        cp = canonicalize_term(p)
        if cp and cp not in _CANON_TO_GROUP:
            _CANON_TO_GROUP[cp] = g  # first group wins


def _extract_alias_hits(text: str) -> Dict[KeywordGroup, List[str]]:
    """
    If an alias appears in the text (e.g. pm, k8s, cicd), emit the canonical term
    and attach it to the most likely group based on our dictionary.
    """
    text_lc = (text or "").lower()
    out: Dict[KeywordGroup, List[str]] = {k: [] for k in ["skills", "tools", "domain", "titles", "methods"]}
    for a, canon in alias_map.items():
        if not a:
            continue
        if _contains_phrase(text_lc, a):
            c = canonicalize_term(canon)
            if not c:
                continue
            g = _CANON_TO_GROUP.get(c, "skills")
            out[g].append(c)
    return out


def _ngrams(tokens: List[str], n: int) -> Iterable[str]:
    if n <= 0:
        return []
    for i in range(0, max(0, len(tokens) - n + 1)):
        yield " ".join(tokens[i : i + n])


def _extract_ngrams(text: str, *, top_n: int) -> List[str]:
    """
    Simple phrase mining: 2-3 grams with stopword filtering.
    This is intentionally MVP-grade and deterministic.
    """
    words = [normalize_term(w) for w in _WORD_RE.findall(text or "")]
    words = [_norm_token(w) for w in words if w]
    # filter
    words = [w for w in words if w not in _STOPWORDS and len(w) >= 3]
    if len(words) < 4:
        return []

    cand: List[str] = []
    for n in (2, 3):
        for g in _ngrams(words, n):
            parts = g.split()
            if not parts:
                continue
            if any(p in _STOPWORDS for p in parts):
                continue
            if all(len(p) < 3 for p in parts):
                continue
            cand.append(g)

    cnt = Counter(cand)
    # remove ultra-rare noise
    ranked = [k for (k, v) in cnt.most_common() if v >= 2]
    # de-duplicate similar phrases
    seen: Set[str] = set()
    out: List[str] = []
    for k in ranked:
        nk = _norm_token(k)
        if nk in seen:
            continue
        seen.add(nk)
        out.append(nk)
        if len(out) >= top_n:
            break
    return out


def extract_keywords(text: str, *, per_group_limit: int = 20) -> KeywordsJson:
    """
    Input: any free text (resume or JD)
    Output: grouped keyword lists (normalized, deduped)
    """
    base = text or ""

    alias_hits = _extract_alias_hits(base)

    skills = _extract_from_dict(base, "skills") + alias_hits["skills"]
    tools = _extract_from_dict(base, "tools") + alias_hits["tools"]
    titles = _extract_from_dict(base, "titles") + alias_hits["titles"]
    domain = _extract_from_dict(base, "domain") + alias_hits["domain"]
    methods = _extract_from_dict(base, "methods") + alias_hits["methods"]

    # Add n-gram candidates for domain/methods (but keep dict hits first)
    ngram = _extract_ngrams(base, top_n=30)

    # Heuristic split: if it looks like a method word, go to methods, else domain.
    method_hints = {"testing", "experiment", "experimentation", "research", "scrum", "agile", "kanban", "cicd", "ci/cd", "review", "incident", "observability"}
    for g in ngram:
        if any(h in g for h in method_hints):
            methods.append(g)
        else:
            domain.append(g)

    def _final(xs: List[str]) -> List[str]:
        out: List[str] = []
        seen: Set[str] = set()
        for x in xs:
            nx = _norm_token(x)
            if not nx or nx in seen:
                continue
            seen.add(nx)
            out.append(nx)
            if len(out) >= per_group_limit:
                break
        return out

    return {
        "skills": _final(skills),
        "tools": _final(tools),
        "domain": _final(domain),
        "titles": _final(titles),
        "methods": _final(methods),
    }

