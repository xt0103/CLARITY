# Toolbox icon assets

Put the PNG icons you shared into this folder so the Toolbox page can render them directly.

## Included by default (SVG)
This repo already includes SVG versions of these icons in this folder, so `/ai-tools` will work immediately.
If you have the original PNG assets, you can drop them here too and update `apps/next-web/app/ai-tools/page.tsx`
to point to `*.png` instead of `*.svg`.

## Required (6)
- `chat.(svg|png)` — AI Interview Practice (blue chat bubble)
- `doc.(svg|png)` — Resume Customizer (green document)
- `download.(svg|png)` — Job Application Plugin (orange download)
- `mail.(svg|png)` — Cover Letter Generator (purple mail)
- `trend.(svg|png)` — Salary Negotiation Coach (red trend)
- `compass.(svg|png)` — Career Path Advisor (blue compass)

## Optional (used elsewhere on the page)
- `crown.(svg|png)`
- `sparkle.(svg|png)`
- `check.(svg|png)`

After adding files, refresh `http://localhost:3000/ai-tools`.

