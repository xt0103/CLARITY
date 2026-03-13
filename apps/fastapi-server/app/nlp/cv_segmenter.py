"""
CV (Resume) segmenter with robust fallback strategies.
"""
from __future__ import annotations

import json
import re
from typing import Dict, Optional


def segment_cv(parsed_text: str, sections_json: Optional[str] = None) -> Dict:
    """
    Segment CV text into skills, experience, projects, and other sections.
    
    Args:
        parsed_text: Full parsed text from resume
        sections_json: Optional pre-segmented JSON string (high confidence)
    
    Returns:
        {
            "sections": {
                "skills": str,
                "experience": str,
                "projects": str,
                "other": str
            },
            "confidence": {
                "skills": float (0.0-1.0),
                "experience": float (0.0-1.0),
                "projects": float (0.0-1.0),
                "other": float (0.0-1.0)
            }
        }
    """
    # Priority 1: Use provided sections_json (highest confidence)
    if sections_json:
        try:
            sections_dict = json.loads(sections_json) if isinstance(sections_json, str) else sections_json
            if isinstance(sections_dict, dict) and "sections" in sections_dict:
                sections = sections_dict["sections"]
                confidence = sections_dict.get("confidence", {})
                # Ensure all sections exist
                result_sections = {
                    "skills": sections.get("skills", ""),
                    "experience": sections.get("experience", ""),
                    "projects": sections.get("projects", ""),
                    "other": sections.get("other", "")
                }
                result_confidence = {
                    "skills": confidence.get("skills", 1.0),
                    "experience": confidence.get("experience", 1.0),
                    "projects": confidence.get("projects", 1.0),
                    "other": confidence.get("other", 1.0)
                }
                return {"sections": result_sections, "confidence": result_confidence}
        except Exception:
            pass  # Fall through to other strategies
    
    if not parsed_text or not parsed_text.strip():
        return {
            "sections": {"skills": "", "experience": "", "projects": "", "other": ""},
            "confidence": {"skills": 0.0, "experience": 0.0, "projects": 0.0, "other": 0.0}
        }
    
    text = parsed_text.strip()
    
    # Strategy 2: Heading-based segmentation
    result = _segment_by_headings(text)
    if result and any(result["sections"].values()):
        return result
    
    # Strategy 3: Feature-based classification
    result = _segment_by_features(text)
    if result and any(result["sections"].values()):
        return result
    
    # Strategy 4: Fallback
    return _segment_fallback(text)


def _segment_by_headings(text: str) -> Optional[Dict]:
    """
    Strategy 2: Identify sections by headings.
    """
    # Heading patterns
    skills_patterns = [
        r"(?:^|\n)\s*(?:skills?|technologies?|technical skills?|技术|技能|专业技能)",
        r"(?:^|\n)\s*(?:proficiencies?|competencies?|能力)",
    ]
    exp_patterns = [
        r"(?:^|\n)\s*(?:experience|work experience|employment|工作经历|工作经验|职业经历)",
        r"(?:^|\n)\s*(?:career|professional experience|职业)",
    ]
    proj_patterns = [
        r"(?:^|\n)\s*(?:projects?|portfolio|项目|作品)",
        r"(?:^|\n)\s*(?:key projects?|notable projects?)",
    ]
    edu_patterns = [
        r"(?:^|\n)\s*(?:education|academic|教育|学历)",
    ]
    
    sections = {"skills": "", "experience": "", "projects": "", "other": ""}
    confidence = {"skills": 0.0, "experience": 0.0, "projects": 0.0, "other": 0.0}
    
    heading_positions = []
    
    for pattern in skills_patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE):
            heading_positions.append((match.start(), "skills"))
    for pattern in exp_patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE):
            heading_positions.append((match.start(), "experience"))
    for pattern in proj_patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE):
            heading_positions.append((match.start(), "projects"))
    for pattern in edu_patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE):
            heading_positions.append((match.start(), "other"))  # Education goes to "other"
    
    if not heading_positions:
        return None
    
    heading_positions.sort(key=lambda x: x[0])
    
    for i, (pos, section_name) in enumerate(heading_positions):
        if i + 1 < len(heading_positions):
            end_pos = heading_positions[i + 1][0]
        else:
            end_pos = len(text)
        
        content = text[pos:end_pos]
        lines = content.split("\n")
        if len(lines) > 1:
            content = "\n".join(lines[1:]).strip()
        else:
            content = content.strip()
        
        sections[section_name] = content
        confidence[section_name] = 1.0
    
    return {"sections": sections, "confidence": confidence}


def _segment_by_features(text: str) -> Optional[Dict]:
    """
    Strategy 3: Classify by content features.
    """
    sections = {"skills": "", "experience": "", "projects": "", "other": ""}
    confidence = {"skills": 0.0, "experience": 0.0, "projects": 0.0, "other": 0.0}
    
    # Split into paragraphs
    paragraphs = [p.strip() for p in re.split(r'\n\s*\n', text) if p.strip()]
    
    if not paragraphs:
        return None
    
    skills_paras = []
    exp_paras = []
    proj_paras = []
    other_paras = []
    
    for para in paragraphs:
        para_lower = para.lower()
        
        # Skills features: comma/semicolon separated, high tech word density
        tech_words = ["python", "java", "react", "sql", "aws", "docker", "kubernetes", "javascript", "typescript"]
        tech_density = sum(1 for word in tech_words if word in para_lower) / max(1, len(para.split()))
        has_separators = ("," in para or ";" in para) and len(para.split()) < 50
        
        # Experience features: date ranges, company/job titles, bullet points
        has_dates = bool(re.search(r'\d{4}[-–—]\d{4}|\d{4}\s*(?:to|–|—|-)\s*\d{4}|present|current', para_lower))
        has_company = bool(re.search(r'(?:at|@|company|corp|inc|ltd|llc|公司|企业)', para_lower))
        has_bullets = para.count("•") > 0 or para.count("-") > 2 or para.count("·") > 0
        
        # Project features: project keywords
        has_project_keywords = bool(re.search(r'project|built|developed|created|implemented|项目|开发|构建', para_lower))
        
        # Classification
        if (tech_density > 0.1 or has_separators) and tech_density > 0.05:
            skills_paras.append(para)
        elif has_dates or (has_company and has_bullets):
            exp_paras.append(para)
        elif has_project_keywords:
            proj_paras.append(para)
        else:
            other_paras.append(para)
    
    sections["skills"] = "\n\n".join(skills_paras)
    sections["experience"] = "\n\n".join(exp_paras)
    sections["projects"] = "\n\n".join(proj_paras)
    sections["other"] = "\n\n".join(other_paras)
    
    # Confidence: 0.6 if we found meaningful segments
    has_skills = bool(skills_paras)
    has_exp = bool(exp_paras)
    has_proj = bool(proj_paras)
    
    confidence = {
        "skills": 0.6 if has_skills else 0.0,
        "experience": 0.6 if has_exp else 0.0,
        "projects": 0.6 if has_proj else 0.0,
        "other": 0.6 if other_paras else 0.0
    }
    
    if has_skills or has_exp or has_proj:
        return {"sections": sections, "confidence": confidence}
    
    return None


def _segment_fallback(text: str) -> Dict:
    """
    Strategy 4: Fallback - put everything in experience.
    """
    sections = {
        "skills": "",
        "experience": text.strip(),
        "projects": "",
        "other": ""
    }
    
    confidence = {
        "skills": 0.0,
        "experience": 0.3,
        "projects": 0.0,
        "other": 0.0
    }
    
    return {"sections": sections, "confidence": confidence}
