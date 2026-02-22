# DATA_DICTIONARY_MIN (SQLite) — CLARITY Job Seeker

Scope: **minimum data dictionary** for the MVP E2E loop.

- **DB runtime**: SQLite (local persistent), `DATABASE_URL=sqlite:///./looogo_dev.db`
- **DB naming**: snake_case columns (SQLAlchemy models)
- **API naming**: camelCase fields (per `specs/API_CONTRACT.md`)
- **Frontend**: consumes API fields only; never reads DB directly

---

## Table: `users`

Source model: `apps/fastapi-server/app/models/user.py`

| Column (DB) | Type (DB) | Required | Notes / Constraints | API field(s) |
|---|---|---:|---|---|
| `id` | `VARCHAR(36)` | ✅ | UUID string, PK | `user.id` |
| `email` | `VARCHAR(255)` | ✅ | unique, indexed | `user.email` |
| `password_hash` | `VARCHAR(255)` | ✅ | bcrypt hash (never returned) | (not exposed) |
| `name` | `VARCHAR(120)` | ❌ | nullable | `user.name` |
| `default_resume_id` | `VARCHAR(36)` | ❌ | nullable, links resumes | `user.defaultResumeId` |
| `created_at` | `DATETIME` | ✅ | UTC | `user.createdAt` |
| `updated_at` | `DATETIME` | ✅ | UTC | (not exposed in `/api/me`) |

### Frontend mapping
- **`/dashboard` (top profile card)**: `GET /api/me` → `user.name`, `user.email`
  - Avatar: if API has no avatar field, UI uses **first letter of `name` (fallback to `email`)**.

---

## Table: `jobs`

Source model: `apps/fastapi-server/app/models/job.py`

| Column (DB) | Type (DB) | Required | Notes / Constraints | API field(s) |
|---|---|---:|---|---|
| `id` | `VARCHAR(36)` | ✅ | UUID string, PK | `job.id` (detail), `jobs[].jobId` (match list) |
| `title` | `VARCHAR(255)` | ✅ | indexed | `title` |
| `company` | `VARCHAR(255)` | ✅ | indexed | `company` |
| `location` | `VARCHAR(255)` | ❌ | nullable | `location` |
| `job_type` | `VARCHAR(80)` | ❌ | nullable | `jobType` |
| `tags_json` | `JSON` | ❌ | nullable (list of strings) | `tags` |
| `description_text` | `TEXT` | ✅ | full JD text | `descriptionText` (job detail) |
| `external_url` | `VARCHAR(1024)` | ❌ | nullable | `externalUrl` |
| `source` | `VARCHAR(50)` | ✅ | e.g. `"seed"` | `source` |
| `source_id` | `VARCHAR(255)` | ❌ | nullable | (not exposed; used for upsert) |
| `created_at` | `DATETIME` | ✅ | UTC | `createdAt` |
| `updated_at` | `DATETIME` | ✅ | UTC | (not required by contract) |

Constraints:
- Unique: **(`source`, `source_id`)** for idempotent seed import.

### Frontend mapping
- **`/job-match` (search results)**: `POST /api/match/search` → `jobs[]`
  - Uses: `jobId`, `title`, `company`, `location`, `jobType`, `tags`, `externalUrl`, `matchScore`, `matchRationale`
- **`/jobs/[jobId]` (detail)**: `GET /api/jobs/{jobId}` → `job`
  - Uses: `job.id`, `title`, `company`, `location`, `descriptionText`, `externalUrl`

---

## Table: `applications`

Source model: `apps/fastapi-server/app/models/application.py`

| Column (DB) | Type (DB) | Required | Notes / Constraints | API field(s) |
|---|---|---:|---|---|
| `id` | `VARCHAR(36)` | ✅ | UUID string, PK | `application.id` |
| `user_id` | `VARCHAR(36)` | ✅ | indexed, owner isolation | (implicit; never exposed) |
| `job_id` | `VARCHAR(36)` | ❌ | nullable FK | `application.jobId` |
| `snapshot_title` | `VARCHAR(255)` | ✅ | **required snapshot** | `snapshotTitle` |
| `snapshot_company` | `VARCHAR(255)` | ✅ | **required snapshot** | `snapshotCompany` |
| `snapshot_location` | `VARCHAR(255)` | ❌ | nullable | `snapshotLocation` |
| `snapshot_external_url` | `VARCHAR(1024)` | ❌ | nullable | `snapshotExternalUrl` |
| `platform_source` | `VARCHAR(20)` | ✅ | enum: `LINKEDIN/OFFICIAL/REFERRAL/OTHER` | `platformSource` |
| `date_applied` | `DATE` | ✅ | ISO date | `dateApplied` |
| `status` | `VARCHAR(20)` | ✅ | enum: `APPLIED/UNDER_REVIEW/INTERVIEW/OFFER/REJECTED` | `status` |
| `priority` | `VARCHAR(20)` | ❌ | enum: `HIGH/MEDIUM/LOW` | `priority` |
| `notes` | `TEXT` | ❌ | nullable | `notes` |
| `is_deleted` | `BOOLEAN` | ✅ | soft delete | (not exposed) |
| `created_at` | `DATETIME` | ✅ | UTC | `createdAt` |
| `updated_at` | `DATETIME` | ✅ | UTC | `updatedAt` |

### Frontend mapping
- **`/jobs/[jobId]` (apply flow)**:
  - `POST /api/applications` request must include:
    - `jobId` (nullable), `jobSnapshot.{title,company,location?,externalUrl?}`
    - `platformSource`, `dateApplied`, `status` (**use `APPLIED`**), optional `priority`, optional `notes`
- **`/tracker`**:
  - list: `GET /api/applications` → `applications[]`
  - update: `PATCH /api/applications/{id}` (status/priority/notes/dateApplied/platformSource)
  - delete: `DELETE /api/applications/{id}` (soft delete)
- **`/dashboard` metrics**:
  - `GET /api/metrics/dashboard` aggregates from non-deleted applications

