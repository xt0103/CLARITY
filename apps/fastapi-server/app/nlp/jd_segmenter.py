"""
JD (Job Description) segmenter with robust fallback strategies.
"""
from __future__ import annotations

import re
from typing import Dict, Optional, Tuple


def segment_jd(text: str) -> Dict:
    """
    Segment JD text into requirements, responsibilities, nice_to_have, and other sections.
    
    Returns:
        {
            "sections": {
                "requirements": str,
                "responsibilities": str,
                "nice_to_have": str,
                "other": str
            },
            "confidence": {
                "requirements": float (0.0-1.0),
                "responsibilities": float (0.0-1.0),
                "nice_to_have": float (0.0-1.0),
                "other": float (0.0-1.0)
            }
        }
    """
    if not text or not text.strip():
        return {
            "sections": {"requirements": "", "responsibilities": "", "nice_to_have": "", "other": ""},
            "confidence": {"requirements": 0.0, "responsibilities": 0.0, "nice_to_have": 0.0, "other": 0.0}
        }
    
    text = text.strip()
    
    # Strategy 1: Heading-based segmentation (high confidence)
    result = _segment_by_headings(text)
    if result:
        return result
    
    # Strategy 2: Rule-based sentence classification (medium confidence)
    result = _segment_by_rules(text)
    if result:
        return result
    
    # Strategy 3: Fallback (low confidence)
    return _segment_fallback(text)


def _segment_by_headings(text: str) -> Optional[Dict]:
    """
    Strategy 1: Identify sections by headings.
    Returns None if no headings found.
    """
    # Heading patterns (case-insensitive, multilingual)
    req_patterns = [
        r"(?:^|\n)\s*(?:requirements?|qualifications?|what you (?:bring|need|have)|you have|要求|资格|必备条件|任职要求)",
        r"(?:^|\n)\s*(?:must have|required|essential|必备|必须)",
    ]
    resp_patterns = [
        r"(?:^|\n)\s*(?:responsibilities?|what you will do|what you'll do|role|duties|职责|工作内容|岗位职责)",
        r"(?:^|\n)\s*(?:you will|you'll|你将|负责)",
    ]
    nice_patterns = [
        r"(?:^|\n)\s*(?:nice to have|preferred|bonus|plus|加分项|优先|优先考虑)",
        r"(?:^|\n)\s*(?:optional|desirable|理想条件)",
    ]
    
    sections = {"requirements": "", "responsibilities": "", "nice_to_have": "", "other": ""}
    confidence = {"requirements": 0.0, "responsibilities": 0.0, "nice_to_have": 0.0, "other": 0.0}
    
    found_any = False
    
    # Find all heading positions
    heading_positions = []
    for pattern in req_patterns + resp_patterns + nice_patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE):
            heading_positions.append((match.start(), match.group().strip().lower(), "req" if pattern in req_patterns else ("nice" if pattern in nice_patterns else "resp")))
    
    if not heading_positions:
        return None
    
    # Sort by position
    heading_positions.sort(key=lambda x: x[0])
    found_any = True
    
    # Extract sections based on headings
    for i, (pos, heading_text, section_type) in enumerate(heading_positions):
        # Determine section name
        if section_type == "req":
            section_name = "requirements"
        elif section_type == "nice":
            section_name = "nice_to_have"
        else:
            section_name = "responsibilities"
        
        # Find end position (next heading or end of text)
        if i + 1 < len(heading_positions):
            end_pos = heading_positions[i + 1][0]
        else:
            end_pos = len(text)
        
        # Extract content (skip the heading line)
        content = text[pos:end_pos]
        # Remove the heading line itself
        lines = content.split("\n")
        if len(lines) > 1:
            content = "\n".join(lines[1:]).strip()
        else:
            content = content.strip()
        
        sections[section_name] = content
        confidence[section_name] = 1.0
    
    if not found_any:
        return None
    
    # Collect remaining text as "other"
    used_positions = set()
    for pos, _, _ in heading_positions:
        used_positions.add(pos)
    
    # If we found headings, return the result
    return {"sections": sections, "confidence": confidence}


def _segment_by_rules(text: str) -> Optional[Dict]:
    """
    Strategy 2: Classify sentences by keywords/rules.
    Returns None if no clear patterns found.
    """
    sections = {"requirements": "", "responsibilities": "", "nice_to_have": "", "other": ""}
    confidence = {"requirements": 0.0, "responsibilities": 0.0, "nice_to_have": 0.0, "other": 0.0}
    
    # Split into sentences (simple approach)
    sentences = re.split(r'[.!?。！？]\s+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    
    if not sentences:
        return None
    
    req_keywords = ["must", "required", "need", "should", "要求", "必须", "需要", "具备", "掌握"]
    resp_keywords = ["you will", "you'll", "负责", "你将", "工作内容", "develop", "build", "create", "implement"]
    nice_keywords = ["preferred", "bonus", "nice to have", "加分", "优先", "plus", "ideal"]
    
    req_sentences = []
    resp_sentences = []
    nice_sentences = []
    other_sentences = []
    
    for sent in sentences:
        sent_lower = sent.lower()
        req_score = sum(1 for kw in req_keywords if kw in sent_lower)
        resp_score = sum(1 for kw in resp_keywords if kw in sent_lower)
        nice_score = sum(1 for kw in nice_keywords if kw in sent_lower)
        
        if req_score > 0 and req_score >= resp_score and req_score >= nice_score:
            req_sentences.append(sent)
        elif resp_score > 0 and resp_score >= nice_score:
            resp_sentences.append(sent)
        elif nice_score > 0:
            nice_sentences.append(sent)
        else:
            other_sentences.append(sent)
    
    # Calculate confidence based on rule hits
    total_sentences = len(sentences)
    if total_sentences == 0:
        return None
    
    sections["requirements"] = " ".join(req_sentences)
    sections["responsibilities"] = " ".join(resp_sentences)
    sections["nice_to_have"] = " ".join(nice_sentences)
    sections["other"] = " ".join(other_sentences)
    
    # Confidence: 0.6 base, adjusted by hit ratio
    req_conf = 0.6 if req_sentences else 0.0
    resp_conf = 0.6 if resp_sentences else 0.0
    nice_conf = 0.6 if nice_sentences else 0.0
    other_conf = 0.6 if other_sentences else 0.0
    
    confidence = {
        "requirements": req_conf,
        "responsibilities": resp_conf,
        "nice_to_have": nice_conf,
        "other": other_conf
    }
    
    # Only return if we found meaningful segments
    if req_sentences or resp_sentences or nice_sentences:
        return {"sections": sections, "confidence": confidence}
    
    return None


def _segment_fallback(text: str) -> Dict:
    """
    Strategy 3: Fallback - simple split by position.
    """
    text_len = len(text)
    split_point = int(text_len * 0.4)
    
    sections = {
        "requirements": text[:split_point].strip(),
        "responsibilities": text[split_point:].strip(),
        "nice_to_have": "",
        "other": ""
    }
    
    confidence = {
        "requirements": 0.3,
        "responsibilities": 0.3,
        "nice_to_have": 0.0,
        "other": 0.0
    }
    
    return {"sections": sections, "confidence": confidence}
