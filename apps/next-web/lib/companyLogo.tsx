/**
 * Utility functions for company logo handling.
 */
import React from "react";
import { getLocalCompanyLogo } from "./companyLogoMap";

/**
 * Get company logo URL using Clearbit Logo API.
 * Falls back to company name if domain extraction fails.
 * 
 * @param companyName - Company name (e.g., "SHEIN", "Google")
 * @returns Logo URL or null if unavailable
 */
export function getCompanyLogoUrl(companyName: string | null | undefined): string | null {
  if (!companyName || !companyName.trim()) {
    return null;
  }

  // Clean company name: remove common suffixes and normalize
  const cleaned = companyName
    .trim()
    .toLowerCase()
    .replace(/\s+(inc|llc|ltd|corp|corporation|limited|co\.|company)$/i, "")
    .replace(/[^a-z0-9]/g, "");

  if (!cleaned) {
    return null;
  }

  // Try multiple formats:
  // 1. Direct company name (e.g., "shein" -> "https://logo.clearbit.com/shein.com")
  // 2. Common domain patterns
  const domains = [
    `${cleaned}.com`,
    `${cleaned}.io`,
    `${cleaned}.ai`,
    `www.${cleaned}.com`,
  ];

  // Use the first domain format (most common)
  return `https://logo.clearbit.com/${domains[0]}`;
}

/**
 * Company Logo component props
 */
export interface CompanyLogoProps {
  companyName: string | null | undefined;
  logoUrl?: string | null | undefined;  // Optional: logo URL from API
  size?: number;
  fallbackLetter?: string;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * React component for displaying company logo with fallback.
 * 
 * Usage:
 * ```tsx
 * <CompanyLogo companyName="SHEIN" size={62} />
 * ```
 */
export function CompanyLogo({
  companyName,
  logoUrl: providedLogoUrl,
  size = 62,
  fallbackLetter,
  style,
  className
}: CompanyLogoProps): React.JSX.Element {
  const [logoError, setLogoError] = React.useState(false);
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Reset error state when logo URL or company name changes
    setLogoError(false);
    
    // Priority 1: Check for local logo file first (most reliable)
    const localLogo = companyName ? getLocalCompanyLogo(companyName) : null;
    if (localLogo) {
      console.log(`[CompanyLogo] Using local logo for ${companyName}: ${localLogo}`);
      setLogoUrl(localLogo);
      return;
    }
    
    // Priority 2: Use provided logo URL from API (if available)
    if (providedLogoUrl && providedLogoUrl.trim()) {
      console.log(`[CompanyLogo] Using API logo for ${companyName}: ${providedLogoUrl}`);
      setLogoUrl(providedLogoUrl);
      return;
    }
    
    // Priority 3: Fallback to Clearbit API (only if no provided URL and no local logo)
    const fallbackUrl = companyName ? getCompanyLogoUrl(companyName) : null;
    if (fallbackUrl) {
      console.log(`[CompanyLogo] Using Clearbit fallback for ${companyName}: ${fallbackUrl}`);
    } else if (companyName) {
      console.log(`[CompanyLogo] No logo found for: ${companyName}`);
    }
    setLogoUrl(fallbackUrl);
  }, [companyName, providedLogoUrl]);

  const letter = fallbackLetter || (companyName || "?").trim().charAt(0).toUpperCase();

  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: 14,
    background: "#e2e8f0",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    color: "#334155",
    flex: "0 0 auto",
    overflow: "hidden",
    ...style
  };

  // Show logo if we have a URL and no error
  if (logoUrl && !logoError) {
    return (
      <div style={containerStyle} className={className} aria-label={`${companyName} logo`}>
        <img
          src={logoUrl}
          alt={`${companyName} logo`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block"
          }}
          onError={(e) => {
            // If API logo fails, try local logo as fallback
            console.warn(`[CompanyLogo] Failed to load logo: ${logoUrl} for ${companyName}`);
            
            // If this was an API/Clearbit URL, try local logo
            if (logoUrl && (logoUrl.startsWith("http://") || logoUrl.startsWith("https://"))) {
              const localLogo = companyName ? getLocalCompanyLogo(companyName) : null;
              if (localLogo && localLogo !== logoUrl) {
                console.log(`[CompanyLogo] Falling back to local logo: ${localLogo}`);
                setLogoUrl(localLogo);
                setLogoError(false); // Reset error to try local logo
                return;
              }
            }
            
            // If no local logo available, show fallback letter
            setLogoError(true);
          }}
          onLoad={() => {
            console.log(`[CompanyLogo] Successfully loaded: ${logoUrl} for ${companyName}`);
          }}
          onLoadStart={() => {
            console.log(`[CompanyLogo] Loading logo: ${logoUrl} for ${companyName}`);
          }}
          crossOrigin="anonymous"
          loading="lazy"
        />
      </div>
    );
  }

  // Fallback to letter
  return (
    <div style={containerStyle} className={className} aria-label={`${companyName || "Company"} logo`}>
      {letter}
    </div>
  );
}
