# PROMPT_PACK — Cursor / Claude Vibe Coding (CLARITY)

Use these prompts sequentially to generate the project. Paste each prompt into Cursor/Claude/Codex.

---

## Prompt 0 — Project setup
Create two repositories:
1) `fastapi-server` (FastAPI backend)
2) `next-web` (Next.js frontend, TypeScript, App Router)

Stack:
- Backend: FastAPI + SQLAlchemy + Alembic + MySQL + JWT auth
- Frontend: Next.js + TypeScript + React Query (or SWR) + basic component library
- File upload supports PDF and DOCX
- Language: English UI

Follow the API contract strictly (see `specs/API_CONTRACT.md`).

---

## Prompt 1 — Backend scaffolding (FastAPI)
Generate a production-ready FastAPI project under `fastapi-server/` with:
- app/main.py (FastAPI app, CORS enabled for http://localhost:3000)
- app/core/config.py (env settings)
- app/core/db.py (SQLAlchemy engine/session using DATABASE_URL)
- app/core/security.py (password hashing + JWT helpers)
- app/api/deps.py (get_db, get_current_user)
- app/models: User, Resume, Job, Application (soft delete flags)
- app/schemas: Pydantic request/response models aligned with `specs/API_CONTRACT.md`
- app/api/routes: auth.py, resumes.py, match.py, jobs.py, applications.py, metrics.py
- alembic migration setup and initial migration

Constraints:
- JWT access token expires in 1 hour
- Use UUID strings as ids
- Always filter by current userId for user-owned resources

---

## Prompt 2 — Backend endpoints (implement)
Implement endpoints exactly:
- POST /api/auth/register
- POST /api/auth/login
- GET /api/me
- POST /api/resumes (multipart upload, store in UPLOAD_DIR, allow pdf/docx)
- GET /api/resumes
- PATCH /api/resumes/{id} (rename or set default)
- DELETE /api/resumes/{id} (soft delete)
- POST /api/match/search (SeedProvider: query DB jobs table; keyword-based matchScore 0-100; rationale is 2-4 bullets)
- GET /api/jobs/{id} (return job + computed match)
- POST /api/applications (require snapshot fields; create tracker record)
- GET /api/applications (filters + pagination)
- PATCH /api/applications/{id}
- DELETE /api/applications/{id} (soft delete)
- GET /api/metrics/dashboard (aggregate from applications)

Also add:
- Seed script to insert seed jobs from `seed_jobs.json` into `jobs` table.

---

## Prompt 3 — Frontend scaffolding (Next.js)
Generate `next-web/` with:
- Routes: /login, /dashboard, /job-match, /jobs/[jobId], /tracker, /resume, /ai-tools, /settings
- Layout: Sidebar + TopNav
- API client wrapper that reads NEXT_PUBLIC_API_BASE_URL
- Auth: store accessToken in memory + localStorage; attach Bearer token to requests
- Redirect unauthenticated users to /login
- Use React Query for data fetching + caching

---

## Prompt 4 — Frontend pages (MVP UX)
Implement MVP UIs aligned with PRD:
- Login page: email/password → login API → redirect /dashboard
- Dashboard:
  - show profile summary
  - resume widget (list + set default + upload shortcut)
  - search input → navigate to /job-match with query state
  - metrics panels calling /api/metrics/dashboard
- Job Match:
  - input query + filters
  - call POST /api/match/search
  - render job cards with matchScore + rationale
  - click card → /jobs/[jobId]
- Job Detail:
  - fetch /api/jobs/{id}
  - Apply button opens externalUrl in new tab, then modal confirm; on Yes → POST /api/applications
- Tracker:
  - table list from /api/applications with status filter
  - inline update status (PATCH)
- Resume:
  - list resumes
  - upload (POST /api/resumes)
  - set default (PATCH)
- AI Tools:
  - placeholder cards (Interview: Coming soon)
- Settings:
  - show profile + default resume shortcut

---

## Prompt 5 — Run instructions
Provide clear local run steps:
- Start MySQL (Docker)
- Backend env vars and `alembic upgrade head`
- Seed jobs into DB
- Start backend on :8000 and frontend on :3000
