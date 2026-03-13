"""
Enhanced match engine with section-based matching (lexical + semantic) and confidence weighting.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Dict, List, Literal, Optional, Set

from app.nlp.skill_taxonomy import canonicalize_term, clusters_for_terms, sort_clusters
from app.nlp.embeddings import (
    embeddings_from_json,
    cosine_similarity,
    semantic_score_from_cosine,
)
from app.nlp.keyword_extractor import extract_keywords

KeywordGroup = Literal["skills", "tools", "domain", "titles", "methods"]
KeywordsJson = Dict[KeywordGroup, List[str]]

# Base weights for JD sections
JD_SECTION_BASE_WEIGHTS = {
    "requirements": 0.55,
    "responsibilities": 0.30,
    "nice_to_have": 0.15,
    "other": 0.0,  # Not used in final score
}

# Keyword group weights (for lexical matching)
DEFAULT_KEYWORD_WEIGHTS: Dict[KeywordGroup, float] = {
    "skills": 0.50,
    "tools": 0.20,
    "titles": 0.15,
    "domain": 0.10,
    "methods": 0.05,
}

# Lexical vs semantic weights within each section
SECTION_LEXICAL_WEIGHT = 0.6
SECTION_SEMANTIC_WEIGHT = 0.4


@dataclass(frozen=True)
class SectionBreakdown:
    """Breakdown for a single JD section."""
    section_name: str
    lexical_score: Optional[int]  # 0-100
    semantic_score: Optional[int]  # 0-100
    section_score: Optional[int]  # 0-100 (weighted combination)
    confidence: float  # 0.0-1.0
    matched_keywords: Dict[KeywordGroup, List[str]]
    missing_keywords: Dict[KeywordGroup, List[str]]


@dataclass(frozen=True)
class MatchResultV2:
    """Enhanced match result with section breakdown."""
    match_score: Optional[int]  # 0-100 (final weighted score)
    keyword_score: Optional[int]  # Overall lexical score (for compatibility)
    cluster_score: Optional[int]  # Overall cluster score (for compatibility)
    semantic_score: Optional[int]  # Overall semantic score (optional)
    matched_clusters: List[str]
    matched_keywords_by_group: Dict[KeywordGroup, List[str]]
    missing_keywords_by_group: Dict[KeywordGroup, List[str]]
    soft_matched_keywords_by_group: Dict[KeywordGroup, List[str]]
    breakdown: Dict[str, SectionBreakdown]  # section_name -> breakdown
    note: Optional[str] = None


def _to_set(xs: Optional[List[str]]) -> Set[str]:
    """Convert keyword list to normalized set."""
    return {canonicalize_term(str(x)) for x in (xs or []) if canonicalize_term(str(x))}


def _empty_groups() -> Dict[KeywordGroup, List[str]]:
    """Create empty keyword groups dict."""
    return {k: [] for k in DEFAULT_KEYWORD_WEIGHTS.keys()}


def _compute_lexical_match(
    resume_keywords: KeywordsJson,
    job_keywords: KeywordsJson,
    weights: Optional[Dict[KeywordGroup, float]] = None,
    per_group_limit: int = 10,
) -> tuple[int, Dict[KeywordGroup, List[str]], Dict[KeywordGroup, List[str]]]:
    """
    Compute lexical match score and matched/missing keywords.
    
    Returns:
        (score, matched, missing)
    """
    w = weights or DEFAULT_KEYWORD_WEIGHTS
    score_f = 0.0
    matched: Dict[KeywordGroup, List[str]] = _empty_groups()
    missing: Dict[KeywordGroup, List[str]] = _empty_groups()
    
    for group in DEFAULT_KEYWORD_WEIGHTS.keys():
        r = _to_set(resume_keywords.get(group, []))
        j = _to_set(job_keywords.get(group, []))
        
        if not j:
            continue
        
        inter = sorted(list(r & j))
        diff = sorted(list(j - r))
        
        matched[group] = inter[:per_group_limit]
        missing[group] = diff[:per_group_limit]
        
        overlap = len(inter) / max(1, len(j))
        score_f += float(w.get(group, 0.0)) * overlap
    
    score = int(max(0, min(100, round(score_f * 100))))
    return score, matched, missing


def _compute_semantic_match(
    jd_embeddings: Dict[str, Optional[List[float]]],
    cv_embeddings: Dict[str, Optional[List[float]]],
    jd_section: str,
    cv_sections: List[str],
) -> Optional[int]:
    """
    Compute semantic match between JD section and CV sections.
    
    Args:
        jd_embeddings: JD section embeddings
        cv_embeddings: CV section embeddings
        jd_section: JD section name (e.g., "requirements")
        cv_sections: List of CV section names to compare against
    
    Returns:
        Semantic score (0-100) or None
    """
    jd_emb = jd_embeddings.get(jd_section)
    if not jd_emb:
        return None
    
    # Try each CV section and take the best match
    best_cosine = 0.0
    for cv_section in cv_sections:
        cv_emb = cv_embeddings.get(cv_section)
        if cv_emb:
            cosine = cosine_similarity(jd_emb, cv_emb)
            best_cosine = max(best_cosine, cosine)
    
    # If no match found, try concatenated CV sections
    if best_cosine == 0.0:
        # Concatenate CV sections and compute embedding
        # For simplicity, we'll use the first available CV embedding
        for cv_section in cv_sections:
            cv_emb = cv_embeddings.get(cv_section)
            if cv_emb:
                cosine = cosine_similarity(jd_emb, cv_emb)
                best_cosine = max(best_cosine, cosine)
    
    if best_cosine == 0.0:
        return None
    
    return semantic_score_from_cosine(best_cosine)


def compute_match_v2(
    *,
    resume_keywords: Optional[KeywordsJson],
    job_keywords: Optional[KeywordsJson],
    jd_sections_json: Optional[str] = None,
    jd_sections_conf_json: Optional[str] = None,
    jd_section_keywords_json: Optional[str] = None,
    jd_embeddings_json: Optional[str] = None,
    cv_sections_json: Optional[str] = None,
    cv_sections_conf_json: Optional[str] = None,
    cv_embeddings_json: Optional[str] = None,
    per_group_limit: int = 10,
) -> MatchResultV2:
    """
    Enhanced match computation with section-based matching.
    
    Falls back to simple keyword matching if sections/embeddings are not available.
    """
    if not resume_keywords:
        empty = _empty_groups()
        return MatchResultV2(
            match_score=None,
            keyword_score=None,
            cluster_score=None,
            semantic_score=None,
            matched_clusters=[],
            matched_keywords_by_group=empty,
            missing_keywords_by_group=empty,
            soft_matched_keywords_by_group=empty,
            breakdown={},
            note="Upload/parse resume to see match",
        )
    
    if not job_keywords:
        empty = _empty_groups()
        return MatchResultV2(
            match_score=0,
            keyword_score=0,
            cluster_score=0,
            semantic_score=0,
            matched_clusters=[],
            matched_keywords_by_group=empty,
            missing_keywords_by_group=empty,
            soft_matched_keywords_by_group=empty,
            breakdown={},
            note="Job keywords not ready yet",
        )
    
    # Parse sections and embeddings
    jd_sections = {}
    jd_confidence = {}
    jd_section_keywords = {}
    jd_embeddings = {}
    cv_sections = {}
    cv_confidence = {}
    cv_embeddings = {}
    
    try:
        if jd_sections_json:
            jd_sections = json.loads(jd_sections_json) if isinstance(jd_sections_json, str) else jd_sections_json
        if jd_sections_conf_json:
            jd_confidence = json.loads(jd_sections_conf_json) if isinstance(jd_sections_conf_json, str) else jd_sections_conf_json
        if jd_section_keywords_json:
            jd_section_keywords = json.loads(jd_section_keywords_json) if isinstance(jd_section_keywords_json, str) else jd_section_keywords_json
        if jd_embeddings_json:
            jd_embeddings = embeddings_from_json(jd_embeddings_json)
        if cv_sections_json:
            cv_sections = json.loads(cv_sections_json) if isinstance(cv_sections_json, str) else cv_sections_json
        if cv_sections_conf_json:
            cv_confidence = json.loads(cv_sections_conf_json) if isinstance(cv_sections_conf_json, str) else cv_sections_conf_json
        if cv_embeddings_json:
            cv_embeddings = embeddings_from_json(cv_embeddings_json)
    except Exception:
        # Fall through to simple matching
        pass
    
    # Check if we have section data for enhanced matching
    has_sections = bool(jd_sections and cv_sections)
    
    if has_sections:
        # Section-based matching
        breakdown = {}
        section_scores = {}
        effective_weights = {}
        
        # Map JD sections to CV sections
        section_mapping = {
            "requirements": ["skills", "experience"],  # Compare requirements with skills + experience
            "responsibilities": ["experience", "projects"],  # Compare responsibilities with experience + projects
            "nice_to_have": ["skills", "projects"],  # Compare nice_to_have with skills + projects
        }
        
        for jd_section_name in ["requirements", "responsibilities", "nice_to_have"]:
            jd_section_text = jd_sections.get(jd_section_name, "")
            jd_conf = jd_confidence.get(jd_section_name, 0.0)
            
            if not jd_section_text or not jd_section_text.strip():
                continue
            
            # Get section-specific keywords (if available) or extract from section text
            section_kws = jd_section_keywords.get(jd_section_name) if jd_section_keywords else None
            if not section_kws:
                section_kws = extract_keywords(jd_section_text)
            
            # Lexical matching for this section
            lexical_score, matched_kws, missing_kws = _compute_lexical_match(
                resume_keywords=resume_keywords,
                job_keywords=section_kws,
                per_group_limit=per_group_limit,
            )
            
            # Semantic matching for this section
            cv_section_names = section_mapping.get(jd_section_name, ["experience"])
            semantic_score = _compute_semantic_match(
                jd_embeddings=jd_embeddings or {},
                cv_embeddings=cv_embeddings or {},
                jd_section=jd_section_name,
                cv_sections=cv_section_names,
            )
            
            # Combine lexical and semantic
            if semantic_score is not None:
                section_score = int(round(
                    SECTION_LEXICAL_WEIGHT * lexical_score +
                    SECTION_SEMANTIC_WEIGHT * semantic_score
                ))
            else:
                section_score = lexical_score
                semantic_score = None
            
            breakdown[jd_section_name] = SectionBreakdown(
                section_name=jd_section_name,
                lexical_score=lexical_score,
                semantic_score=semantic_score,
                section_score=section_score,
                confidence=jd_conf,
                matched_keywords=matched_kws,
                missing_keywords=missing_kws,
            )
            
            # Effective weight = base_weight * confidence
            # 但为了保持分数不会过低，我们使用一个平滑函数：
            # 当confidence >= 0.6时，权重衰减较小；当confidence < 0.6时，权重衰减较大
            base_weight = JD_SECTION_BASE_WEIGHTS.get(jd_section_name, 0.0)
            # 平滑函数：confidence >= 0.6 时，权重 = base_weight * (0.7 + 0.3 * confidence)
            # 这样即使confidence=0.6，权重也不会降得太低
            if jd_conf >= 0.6:
                effective_weight = base_weight * (0.7 + 0.3 * jd_conf)
            else:
                # confidence < 0.6 时，权重降低更多
                effective_weight = base_weight * jd_conf
            effective_weights[jd_section_name] = effective_weight
            section_scores[jd_section_name] = section_score
        
        # Compute overall lexical score first (for fallback)
        overall_lexical, _, _ = _compute_lexical_match(
            resume_keywords=resume_keywords,
            job_keywords=job_keywords,
            per_group_limit=per_group_limit,
        )
        
        # Normalize effective weights
        total_effective_weight = sum(effective_weights.values())
        if total_effective_weight > 0:
            normalized_weights = {k: v / total_effective_weight for k, v in effective_weights.items()}
        else:
            normalized_weights = effective_weights
        
        # Compute final score
        final_score = sum(
            normalized_weights.get(section_name, 0.0) * score
            for section_name, score in section_scores.items()
        )
        match_score = int(max(0, min(100, round(final_score))))
        
        # 如果分段匹配分数过低，回退到整体匹配分数（避免分数过低）
        # 先计算cluster_score用于fallback
        resume_all = set()
        job_all = set()
        for group in DEFAULT_KEYWORD_WEIGHTS.keys():
            resume_all |= _to_set(resume_keywords.get(group, []))
            job_all |= _to_set(job_keywords.get(group, []))
        job_clusters = clusters_for_terms(job_all)
        resume_clusters = clusters_for_terms(resume_all)
        hit_clusters = set(job_clusters) & set(resume_clusters)
        cluster_cov = len(hit_clusters) / max(1, len(job_clusters))
        fallback_cluster_score = int(max(0, min(100, round(cluster_cov * 100))))
        
        fallback_score = int(max(0, min(100, round(0.6 * overall_lexical + 0.4 * fallback_cluster_score))))
        
        # 如果分段匹配分数比整体匹配分数低太多（>20分），使用整体匹配分数
        if match_score < fallback_score - 20:
            match_score = fallback_score
        
        # Aggregate matched/missing keywords across sections (prioritize requirements)
        all_matched = _empty_groups()
        all_missing = _empty_groups()
        
        if "requirements" in breakdown:
            req_breakdown = breakdown["requirements"]
            for group in DEFAULT_KEYWORD_WEIGHTS.keys():
                all_matched[group] = req_breakdown.matched_keywords.get(group, [])[:per_group_limit]
                all_missing[group] = req_breakdown.missing_keywords.get(group, [])[:per_group_limit]
        
        # Compute overall scores for compatibility (使用整体job keywords，不是分段)
        overall_lexical, _, _ = _compute_lexical_match(
            resume_keywords=resume_keywords,
            job_keywords=job_keywords,  # 使用整体job keywords
            per_group_limit=per_group_limit,
        )
        
        # Cluster matching (overall)
        resume_all = set()
        job_all = set()
        for group in DEFAULT_KEYWORD_WEIGHTS.keys():
            resume_all |= _to_set(resume_keywords.get(group, []))
            job_all |= _to_set(job_keywords.get(group, []))
        
        job_clusters = clusters_for_terms(job_all)
        resume_clusters = clusters_for_terms(resume_all)
        hit_clusters = set(job_clusters) & set(resume_clusters)
        cluster_cov = len(hit_clusters) / max(1, len(job_clusters))
        cluster_score = int(max(0, min(100, round(cluster_cov * 100))))
        matched_clusters = sort_clusters(hit_clusters)[:3]
        
        # Soft matches
        soft_matched = _empty_groups()
        matched_exact_all = set()
        for group in DEFAULT_KEYWORD_WEIGHTS.keys():
            matched_list = all_matched.get(group, [])
            matched_exact_all |= _to_set(matched_list)
        
        for group in DEFAULT_KEYWORD_WEIGHTS.keys():
            j_terms = _to_set(job_keywords.get(group, []))
            soft_hits = []
            for t in sorted(list(j_terms)):
                if t in matched_exact_all:
                    continue
                if clusters_for_terms([t]) & hit_clusters:
                    soft_hits.append(t)
            soft_matched[group] = soft_hits[:per_group_limit]
        
        # Overall semantic score (weighted average of section semantic scores by effective weights)
        semantic_scores_list = []
        semantic_weights_list = []
        for section_name, bd in breakdown.items():
            if bd.semantic_score is not None:
                semantic_scores_list.append(bd.semantic_score)
                semantic_weights_list.append(normalized_weights.get(section_name, 0.0))
        
        if semantic_scores_list:
            # Weighted average
            total_weight = sum(semantic_weights_list)
            if total_weight > 0:
                overall_semantic = int(round(
                    sum(score * weight for score, weight in zip(semantic_scores_list, semantic_weights_list)) / total_weight
                ))
            else:
                overall_semantic = int(round(sum(semantic_scores_list) / len(semantic_scores_list)))
        else:
            overall_semantic = None
        
        return MatchResultV2(
            match_score=match_score,
            keyword_score=overall_lexical,
            cluster_score=cluster_score,
            semantic_score=overall_semantic,
            matched_clusters=matched_clusters,
            matched_keywords_by_group=all_matched,
            missing_keywords_by_group=all_missing,
            soft_matched_keywords_by_group=soft_matched,
            breakdown=breakdown,
        )
    
    else:
        # Fallback to simple matching (original logic)
        from app.match.match_engine import compute_match
        
        simple_result = compute_match(
            resume_keywords=resume_keywords,
            job_keywords=job_keywords,
            per_group_limit=per_group_limit,
        )
        
        return MatchResultV2(
            match_score=simple_result.match_score,
            keyword_score=simple_result.keyword_score,
            cluster_score=simple_result.cluster_score,
            semantic_score=None,
            matched_clusters=simple_result.matched_clusters,
            matched_keywords_by_group=simple_result.matched_by_group,
            missing_keywords_by_group=simple_result.missing_by_group,
            soft_matched_keywords_by_group=simple_result.soft_matched_by_group,
            breakdown={},
            note=simple_result.note,
        )
