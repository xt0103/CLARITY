from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Literal, Optional, Set

from app.nlp.skill_taxonomy import canonicalize_term, clusters_for_terms, sort_clusters

KeywordGroup = Literal["skills", "tools", "domain", "titles", "methods"]
KeywordsJson = Dict[KeywordGroup, List[str]]


DEFAULT_WEIGHTS: Dict[KeywordGroup, float] = {
    "skills": 0.50,
    "tools": 0.20,
    "titles": 0.15,
    "domain": 0.10,
    "methods": 0.05,
}


@dataclass(frozen=True)
class MatchResult:
    keyword_score: Optional[int]
    cluster_score: Optional[int]
    match_score: Optional[int]
    matched_clusters: List[str]
    matched_by_group: Dict[KeywordGroup, List[str]]
    missing_by_group: Dict[KeywordGroup, List[str]]
    soft_matched_by_group: Dict[KeywordGroup, List[str]]
    note: Optional[str] = None


def _to_set(xs: Optional[List[str]]) -> Set[str]:
    return {canonicalize_term(str(x)) for x in (xs or []) if canonicalize_term(str(x))}


def _empty_groups() -> Dict[KeywordGroup, List[str]]:
    return {k: [] for k in DEFAULT_WEIGHTS.keys()}


def compute_match(
    *,
    resume_keywords: Optional[KeywordsJson],
    job_keywords: Optional[KeywordsJson],
    weights: Optional[Dict[KeywordGroup, float]] = None,
    per_group_limit: int = 10,
) -> MatchResult:
    if not resume_keywords:
        empty = _empty_groups()
        return MatchResult(
            keyword_score=None,
            cluster_score=None,
            match_score=None,
            matched_clusters=[],
            matched_by_group=empty,
            missing_by_group=empty,
            soft_matched_by_group=empty,
            note="Upload/parse resume to see match",
        )
    if not job_keywords:
        empty = _empty_groups()
        return MatchResult(
            keyword_score=0,
            cluster_score=0,
            match_score=0,
            matched_clusters=[],
            matched_by_group=empty,
            missing_by_group=empty,
            soft_matched_by_group=empty,
            note="Job keywords not ready yet",
        )

    w = weights or DEFAULT_WEIGHTS
    keyword_score_f = 0.0
    matched: Dict[KeywordGroup, List[str]] = {}
    missing: Dict[KeywordGroup, List[str]] = {}
    soft: Dict[KeywordGroup, List[str]] = {}
    matched_exact_all: Set[str] = set()
    job_all: Set[str] = set()
    resume_all: Set[str] = set()

    for group in DEFAULT_WEIGHTS.keys():
        r = _to_set(resume_keywords.get(group, []))
        j = _to_set(job_keywords.get(group, []))
        resume_all |= r
        job_all |= j
        if not j:
            matched[group] = []
            missing[group] = []
            soft[group] = []
            continue

        inter = sorted(list(r & j))
        diff = sorted(list(j - r))

        matched[group] = inter[:per_group_limit]
        missing[group] = diff[:per_group_limit]
        matched_exact_all |= set(inter)

        overlap = len(inter) / max(1, len(j))
        keyword_score_f += float(w.get(group, 0.0)) * overlap

    keyword_score = int(max(0, min(100, round(keyword_score_f * 100))))

    # Cluster coverage (transferable capability areas)
    job_needed_clusters = clusters_for_terms(job_all)
    resume_clusters = clusters_for_terms(resume_all)
    hit_clusters = set(job_needed_clusters) & set(resume_clusters)
    cov = len(hit_clusters) / max(1, len(job_needed_clusters))
    cluster_score = int(max(0, min(100, round(cov * 100))))
    matched_clusters = sort_clusters(hit_clusters)[:3]

    # Soft matches by group: job terms not exact-matched but share a cluster that is hit.
    for group in DEFAULT_WEIGHTS.keys():
        j_terms = _to_set(job_keywords.get(group, []))
        soft_hits: List[str] = []
        for t in sorted(list(j_terms)):
            if t in matched_exact_all:
                continue
            # cluster match if term belongs to any hit cluster
            if clusters_for_terms([t]) & hit_clusters:
                soft_hits.append(t)
        soft[group] = soft_hits[:per_group_limit]

    match_score = int(max(0, min(100, round(0.6 * keyword_score + 0.4 * cluster_score))))
    return MatchResult(
        keyword_score=keyword_score,
        cluster_score=cluster_score,
        match_score=match_score,
        matched_clusters=matched_clusters,
        matched_by_group=matched,
        missing_by_group=missing,
        soft_matched_by_group=soft,
    )

