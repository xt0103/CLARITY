# CLARITY — Job Seeker Web App (MVP)

This repo contains a **job-seeker** web app (frontend + backend) for:
- Job matching & recommendations (MVP uses seeded jobs)
- Application tracking (Job Tracker)
- Resume upload & management (PDF/DOCX)
- Dashboard metrics

Tech stack:
- Frontend: **Next.js (TypeScript)**
- Backend: **FastAPI (Python)**
- DB: **MySQL**
- Auth: **Email + Password (JWT)**

---

## 1) Folder Structure (recommended)

```
CLARITY/
  rules/
    PROMPT_PACK.md
    coding_rules.md

  specs/
    PRD.md
    TECH_SPEC.md
    API_CONTRACT.md

  data/
    seed_jobs.json
    seed_jobs.template.json

  env/
    ENV_TEMPLATES.md

  ui/
    dashboard.png
    job_match.png
    tracker.png
    resume_1.png
    resume_2.png
    ai_tools.png

  apps/
    fastapi-server/
    next-web/
```

---

## 2) Prerequisites

- Node.js 18+ (or 20+)
- Python 3.10+ (recommended 3.11)
- MySQL 8+
- (Optional) Docker Desktop (for MySQL)

---

## 3) Quick Start (Local Dev)

### Step A — Start MySQL (Docker recommended)

Create a MySQL container:

```bash
docker run --name looogo-mysql \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=looogo \
  -p 3306:3306 \
  -d mysql:8
```

Verify MySQL is running:
```bash
docker ps
```

---

### Step B — Backend (FastAPI)

Go to backend folder:
```bash
cd apps/fastapi-server
```

Create `.env` (DO NOT commit it). Example:
```bash
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/looogo
JWT_SECRET=change_me_to_a_long_random_string
JWT_EXPIRES_IN=3600
UPLOAD_DIR=./uploads
# Optional:
# OPENAI_API_KEY=sk-...
```

Install dependencies:
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run DB migrations:
```bash
alembic upgrade head
```

Seed jobs into DB (implementation depends on your seed script).
If your backend provides a command/script, run it here.
Otherwise, keep `data/seed_jobs.json` ready and insert via your seed utility.

Start the server:
```bash
uvicorn app.main:app --reload --port 8000
```

Backend should be up at:
- http://localhost:8000

---

### Step C — Frontend (Next.js)

Open another terminal:
```bash
cd apps/next-web
```

Create `.env.local`:
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Install and run:
```bash
npm install
npm run dev
```

Frontend should be up at:
- http://localhost:3000

---

## 4) MVP Smoke Test (End-to-End)

1. Open http://localhost:3000/login  
2. Register (if enabled) or login (email + password)
3. Upload resume (PDF/DOCX) in Resume page
4. Go Dashboard → enter job search text → Job Match list appears
5. Open a Job → Apply (opens external link) → Confirm applied
6. Go Tracker → verify a new application record exists
7. Dashboard metrics should reflect tracker counts

---

## 5) Environment Variables

### Backend
- `DATABASE_URL` — MySQL connection string
- `JWT_SECRET` — secret key for JWT signing
- `JWT_EXPIRES_IN` — seconds (default 3600)
- `UPLOAD_DIR` — local folder for resume uploads
- `OPENAI_API_KEY` — optional, for AI features later

### Frontend
- `NEXT_PUBLIC_API_BASE_URL` — backend base URL

---

## 6) Notes on Cloud Deployment (later)

- MySQL does **not** need to change for cloud deployment.
- For resume uploads, cloud deployment usually switches from local disk to object storage (S3/R2).
- Recommended: Frontend on Vercel, Backend on Render/Fly/EC2, DB on managed MySQL.

---

## 7) Docs

- `specs/PRD.md` — product requirements
- `specs/TECH_SPEC.md` — technical architecture
- `specs/API_CONTRACT.md` — frontend-backend contract
- `rules/PROMPT_PACK.md` — prompts for Cursor/Claude to generate code
- `data/seed_jobs.json` — seeded jobs for MVP search & match

---

## 8) Git Hygiene

Do NOT commit:
- `apps/fastapi-server/.env`
- `apps/next-web/.env.local`
- `apps/fastapi-server/uploads/` (if using local upload dir)
- any API keys

---

## 9) Common Troubleshooting

### CORS errors
- Ensure backend CORS allows `http://localhost:3000`
- Ensure frontend `NEXT_PUBLIC_API_BASE_URL` is correct

### MySQL connection issues
- Check container is running: `docker ps`
- Verify port: `3306`
- Verify database exists: `looogo`

### JWT / 401 issues
- Make sure frontend attaches `Authorization: Bearer <token>`
- Re-login to refresh token

---

## 10) Next Steps

- Add import endpoint for pasted JD (ManualProvider)
- Add better matching (embeddings + rerank)
- Implement AI Interview tool
- Add deployment scripts (Dockerfiles, CI)

