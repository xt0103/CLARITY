"""
Utility functions for fetching company logos.
"""
import re
from typing import Optional
import httpx


def get_company_logo_url(company_name: str) -> Optional[str]:
    """
    Get company logo URL using Clearbit Logo API.
    
    Args:
        company_name: Company name (e.g., "SHEIN", "Google")
    
    Returns:
        Logo URL or None if unavailable
    """
    if not company_name or not company_name.strip():
        return None
    
    # Clean company name: remove common suffixes and normalize
    cleaned = company_name.strip().lower()
    # Remove common suffixes
    cleaned = re.sub(r'\s+(inc|llc|ltd|corp|corporation|limited|co\.|company)$', '', cleaned, flags=re.IGNORECASE)
    # Remove non-alphanumeric characters
    cleaned = re.sub(r'[^a-z0-9]', '', cleaned)
    
    if not cleaned:
        return None
    
    # Try multiple domain formats (most common first)
    domains = [
        f"{cleaned}.com",
        f"{cleaned}.io",
        f"{cleaned}.ai",
        f"www.{cleaned}.com",
    ]
    
    # Use Clearbit Logo API (free, no API key required)
    # Format: https://logo.clearbit.com/{domain}
    # We'll try the first domain format (most common)
    logo_url = f"https://logo.clearbit.com/{domains[0]}"
    
    # Optionally verify the logo exists (but this adds latency)
    # For now, we'll just return the URL and let the frontend handle 404s
    return logo_url


def verify_logo_url(url: str, timeout: float = 2.0) -> bool:
    """
    Verify if a logo URL is accessible.
    
    Args:
        url: Logo URL to verify
        timeout: Request timeout in seconds
    
    Returns:
        True if URL is accessible, False otherwise
    """
    try:
        response = httpx.head(url, timeout=timeout, follow_redirects=True)
        return response.status_code == 200
    except Exception:
        return False


def get_company_logo_url_with_verification(company_name: str, verify: bool = False) -> Optional[str]:
    """
    Get company logo URL, optionally verifying it exists.
    
    Args:
        company_name: Company name
        verify: If True, verify the logo URL is accessible before returning
    
    Returns:
        Logo URL or None if unavailable or verification fails
    """
    url = get_company_logo_url(company_name)
    if not url:
        return None
    
    if verify:
        if not verify_logo_url(url):
            return None
    
    return url
