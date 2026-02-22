from __future__ import annotations

import re
from typing import Dict, Iterable, List, Optional, Set


_SPACE_RE = re.compile(r"\s+")
_PUNCT_RE = re.compile(r"[^\w#+\.\/\- ]+", flags=re.UNICODE)


def normalize_term(term: str) -> str:
    """
    Normalization used across the system (resume + job keywords).
    - lowercase
    - remove most punctuation
    - collapse whitespace
    """
    s = (term or "").strip().lower()
    s = s.replace("–", "-").replace("—", "-")
    s = s.replace("nodejs", "node.js")
    s = _PUNCT_RE.sub(" ", s)
    s = _SPACE_RE.sub(" ", s).strip()
    return s


# Alias map: abbreviation/synonym -> canonical term
# Keep keys + values normalized (we normalize again at runtime, safe).
alias_map: Dict[str, str] = {
    "pm": "product manager",
    "pmm": "product marketing manager",
    "swe": "software engineer",
    "frontend dev": "frontend engineer",
    "backend dev": "backend engineer",
    "fullstack": "full stack engineer",
    "ml": "machine learning",
    "ai": "artificial intelligence",
    "nlp": "nlp",
    "ds": "data science",
    "de": "data engineering",
    "ux": "user experience",
    "ui": "user interface",
    "js": "javascript",
    "ts": "typescript",
    "py": "python",
    "k8s": "kubernetes",
    "eks": "kubernetes",
    "gke": "kubernetes",
    "aks": "kubernetes",
    "node": "node.js",
    "postgres": "postgresql",
    "postgre": "postgresql",
    "cicd": "ci/cd",
    "ab testing": "a/b testing",
}


# Capability clusters (transferable skills).
# cluster_name -> terms
clusters: Dict[str, Set[str]] = {
    "cloud_devops": {
        "aws",
        "gcp",
        "azure",
        "docker",
        "kubernetes",
        "terraform",
        "ci/cd",
        "linux",
        "observability",
    },
    "backend_platform": {
        "rest",
        "graphql",
        "microservices",
        "distributed systems",
        "system design",
        "java",
        "go",
        "node.js",
        "python",
    },
    "data_analytics": {
        "sql",
        "data analysis",
        "data science",
        "tableau",
        "power bi",
        "etl",
        "data pipeline",
        "airflow",
        "spark",
        "kafka",
    },
    "ml_ai": {
        "machine learning",
        "deep learning",
        "nlp",
        "artificial intelligence",
        "feature engineering",
        "model training",
    },
    "product_experimentation": {
        "a/b testing",
        "experimentation",
        "user research",
        "metrics",
        "analytics",
        "growth",
    },
    "uiux_design": {
        "figma",
        "user experience",
        "user interface",
        "ux designer",
        "ui designer",
        "product designer",
        "design system",
        "wireframing",
        "prototyping",
    },
    "fintech_payments": {
        "fintech",
        "payments",
        "risk",
        "fraud",
        "kyc",
        "aml",
    },
}


# Optional: prioritize which clusters to show first in matchedClusters.
cluster_priority: Dict[str, int] = {
    "cloud_devops": 100,
    "backend_platform": 95,
    "data_analytics": 90,
    "ml_ai": 85,
    "product_experimentation": 80,
    "uiux_design": 70,
    "fintech_payments": 60,
}


def canonicalize_term(term: str) -> str:
    """
    Apply normalize + alias mapping.
    """
    t = normalize_term(term)
    if not t:
        return ""
    # Try direct alias
    if t in alias_map:
        return normalize_term(alias_map[t])
    return t


def _build_term_to_clusters() -> Dict[str, Set[str]]:
    m: Dict[str, Set[str]] = {}
    for c, terms in clusters.items():
        for t in terms:
            ct = canonicalize_term(t)
            if not ct:
                continue
            m.setdefault(ct, set()).add(c)
    return m


_TERM_TO_CLUSTERS = _build_term_to_clusters()


def clusters_for_term(term: str) -> Set[str]:
    return set(_TERM_TO_CLUSTERS.get(canonicalize_term(term), set()))


def clusters_for_terms(terms: Iterable[str]) -> Set[str]:
    out: Set[str] = set()
    for t in terms:
        out |= clusters_for_term(t)
    return out


def is_known_term(term: str) -> bool:
    ct = canonicalize_term(term)
    if not ct:
        return False
    if ct in _TERM_TO_CLUSTERS:
        return True
    # Known if it appears as an alias key or alias value
    if ct in {canonicalize_term(k) for k in alias_map.keys()}:
        return True
    if ct in {canonicalize_term(v) for v in alias_map.values()}:
        return True
    return False


def sort_clusters(cs: Iterable[str]) -> List[str]:
    return sorted(list(set(cs)), key=lambda c: (-int(cluster_priority.get(c, 0)), c))

