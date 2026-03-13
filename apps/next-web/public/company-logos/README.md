# Company Logos

Place company logo images in this directory.

## File Naming

Name your logo files using the company name (normalized, lowercase):
- `shein.png` for SHEIN
- `stripe.png` for Stripe
- `didi.png` for DiDi
- `bnsf.png` for BNSF Railway

## Supported Formats

- PNG (recommended)
- JPG/JPEG
- SVG
- WebP

## Adding New Logos

1. Place the logo file in this directory
2. Update `lib/companyLogoMap.ts` to add the mapping:
   ```typescript
   "company-name": "/company-logos/company-name.png",
   ```

## Logo Priority

The system checks logos in this order:
1. Logo URL from API (if provided)
2. Local logo file (from this directory)
3. Clearbit API (fallback)
