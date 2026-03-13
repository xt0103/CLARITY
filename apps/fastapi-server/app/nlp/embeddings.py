"""
Embedding generation for semantic matching.
Uses sentence-transformers for local embedding generation.
"""
from __future__ import annotations

import json
from typing import Dict, List, Optional

# Lazy loading of model to avoid startup delay
_model = None
_model_name = "all-MiniLM-L6-v2"  # Lightweight, fast, good quality


def _get_model():
    """Lazy load the embedding model."""
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer(_model_name)
        except ImportError:
            # Fallback: return None if library not available
            _model = False  # Use False to indicate unavailable
    return _model if _model is not False else None


def generate_embeddings(text: str) -> Optional[List[float]]:
    """
    Generate embedding vector for a text.
    
    Args:
        text: Input text
    
    Returns:
        List of floats (embedding vector) or None if unavailable
    """
    if not text or not text.strip():
        return None
    
    model = _get_model()
    if model is None:
        return None
    
    try:
        embedding = model.encode(text, normalize_embeddings=True)
        return embedding.tolist()
    except Exception:
        return None


def generate_section_embeddings(sections: Dict[str, str]) -> Dict[str, Optional[List[float]]]:
    """
    Generate embeddings for each section.
    
    Args:
        sections: Dict of section_name -> section_text
    
    Returns:
        Dict of section_name -> embedding vector (or None)
    """
    result = {}
    for section_name, section_text in sections.items():
        if section_text and section_text.strip():
            result[section_name] = generate_embeddings(section_text)
        else:
            result[section_name] = None
    return result


def embeddings_to_json(embeddings: Dict[str, Optional[List[float]]]) -> str:
    """Convert embeddings dict to JSON string."""
    return json.dumps(embeddings, ensure_ascii=False)


def embeddings_from_json(json_str: Optional[str]) -> Optional[Dict[str, Optional[List[float]]]]:
    """Parse embeddings from JSON string."""
    if not json_str:
        return None
    try:
        return json.loads(json_str)
    except Exception:
        return None


def cosine_similarity(emb1: Optional[List[float]], emb2: Optional[List[float]]) -> float:
    """
    Compute cosine similarity between two embeddings.
    
    Args:
        emb1: First embedding vector
        emb2: Second embedding vector
    
    Returns:
        Cosine similarity (0.0 to 1.0), or 0.0 if either is None
    """
    if not emb1 or not emb2:
        return 0.0
    
    if len(emb1) != len(emb2):
        return 0.0
    
    # Dot product
    dot_product = sum(a * b for a, b in zip(emb1, emb2))
    
    # Magnitudes
    mag1 = sum(a * a for a in emb1) ** 0.5
    mag2 = sum(b * b for b in emb2) ** 0.5
    
    if mag1 == 0.0 or mag2 == 0.0:
        return 0.0
    
    return dot_product / (mag1 * mag2)


def semantic_score_from_cosine(cosine: float) -> int:
    """
    Map cosine similarity (typically -1 to 1, but normalized embeddings are 0 to 1)
    to a 0-100 semantic score.
    
    Uses formula: (cosine - 0.2) / 0.8, clamped to 0-100
    """
    if cosine < 0.2:
        return 0
    if cosine > 1.0:
        return 100
    score = int(round(((cosine - 0.2) / 0.8) * 100))
    return max(0, min(100, score))
