# fastapi-server (CLARITY Job Seeker API)

## Requirements
- Python 3.10+ (recommended 3.11)
- MySQL 8+

## Local setup

Create a virtualenv and install deps:

```bash
cd apps/fastapi-server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Dev Quickstart (SQLite, local persistent)

1) Create `apps/fastapi-server/.env` from template (**do not commit secrets**):

```bash
cp ../../env/.env.dev.example .env
```

Ensure it contains:

```bash
DATABASE_URL=sqlite:///./looogo_dev.db
JWT_SECRET=change_me_to_a_long_random_string
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini
```

**Note**: For AI assistant features, you need a valid OpenAI API key. Get one from https://platform.openai.com/api-keys

2) Run migrations (SQLite):

```bash
alembic upgrade head
```

3) Seed jobs (idempotent; safe to run multiple times):

```bash
python -m scripts.seed_jobs
python -m scripts.seed_jobs
```

4) Start API:

```bash
uvicorn app.main:app --reload --port 8000
```

### Dev vs Prod DB switching

This backend supports **two DB environments** using `DATABASE_URL`:
- **Dev (default)**: SQLite
- **Prod**: Postgres (managed/hosted)

Copy one of these templates to `apps/fastapi-server/.env`:
- `env/.env.dev.example` (SQLite)
- `env/.env.prod.example` (Postgres)

Example (dev / SQLite):

```bash
DATABASE_URL=sqlite:///./looogo_dev.db
JWT_SECRET=change_me_to_a_long_random_string
JWT_EXPIRES_IN=3600
UPLOAD_DIR=./uploads
```

Example (prod / Postgres):

```bash
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DBNAME
JWT_SECRET=change_me_to_a_long_random_string
JWT_EXPIRES_IN=3600
UPLOAD_DIR=./uploads
```

### Run (both dev/prod)

```bash
alembic upgrade head
python -m scripts.seed_jobs
uvicorn app.main:app --reload --port 8000
```

## Real jobs starter import (no scraping)

This repo includes a starter importer that pulls from **Remotive's public API** and upserts into `jobs`.

```bash
python -m scripts.import_jobs_remotive --search "software engineer" --limit 200
```

Notes:
- This does **not** scrape LinkedIn/JobStreet HTML pages.
- It is safe to re-run; it upserts by `(source, sourceId)` using ORM queries.

## Optional: MySQL

MySQL is not required for dev/prod in this setup. If you still want to use MySQL locally:
- install driver: `pip install pymysql`
- use a MySQL `DATABASE_URL` like: `mysql+pymysql://user:pass@localhost:3306/dbname`

```bash
docker run --name clarity-mysql -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=job_seeker -p 3306:3306 -d mysql:8
```


