/**
 * Company name to local logo file mapping.
 * 
 * Add your company logos to public/company-logos/ and map them here.
 * 
 * Logo files should be named: {companyName}.{ext}
 * Supported formats: png, jpg, jpeg, svg, webp
 */
export const COMPANY_LOGO_MAP: Record<string, string> = {
  // Company logo mappings
  // Add your logo files to: apps/next-web/public/company-logos/
  
  // Real company logos
  "shein": "/company-logos/shein.png",
  "stripe": "/company-logos/stripe.png",
  "didi": "/company-logos/didi.png",
  "bnsf railway": "/company-logos/bnsf.png",
  "bnsf": "/company-logos/bnsf.png",
  
  // Database companies (add logo files as needed)
  "aicrafters": "/company-logos/aicrafters.png",
  "banksphere": "/company-logos/banksphere.png",
  "bridgepoint": "/company-logos/bridgepoint.png",
  "brightlabs": "/company-logos/brightlabs.png",
  "citymobility": "/company-logos/citymobility.png",
  "cloudnova": "/company-logos/cloudnova.png",
  "consultx": "/company-logos/consultx.png",
  "dataharbor": "/company-logos/dataharbor.png",
  "devforge": "/company-logos/devforge.png",
  "marketmint": "/company-logos/marketmint.png",
  "mednova": "/company-logos/mednova.png",
  "nimbleops": "/company-logos/nimbleops.png",
  "ninja van": "/company-logos/ninja-van.png",
  "orbitcloud": "/company-logos/orbitcloud.png",
  "paywave": "/company-logos/paywave.png",
  "planiq": "/company-logos/planiq.png",
  "productory": "/company-logos/productory.png",
  "quantumedge": "/company-logos/quantumedge.png",
  "retailtech": "/company-logos/retailtech.png",
  "saasworks": "/company-logos/saasworks.png",
  "securemesh": "/company-logos/securemesh.png",
  "streamstack": "/company-logos/streamstack.png",
  "vantageworks": "/company-logos/vantageworks.png",
  "zenlytics": "/company-logos/zenlytics.png",
};

/**
 * Get local logo path for a company name.
 * Returns null if no local logo is available.
 */
export function getLocalCompanyLogo(companyName: string | null | undefined): string | null {
  if (!companyName || !companyName.trim()) {
    return null;
  }
  
  // Normalize company name for lookup
  const normalized = companyName.trim().toLowerCase();
  
  // Direct lookup
  if (COMPANY_LOGO_MAP[normalized]) {
    return COMPANY_LOGO_MAP[normalized];
  }
  
  // Try removing common suffixes
  const withoutSuffix = normalized.replace(/\s+(inc|llc|ltd|corp|corporation|limited|co\.|company)$/i, "");
  if (COMPANY_LOGO_MAP[withoutSuffix]) {
    return COMPANY_LOGO_MAP[withoutSuffix];
  }
  
  return null;
}
