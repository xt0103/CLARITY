# CLARITY Job Seeker Web App — Functional Spec (for Vibe Coding)

## 0) Scope
Build a **full‑stack web app for Job Seekers** (not HR side).  
Goal: ship a working MVP framework first; UI can change later without rewriting business logic.

### MVP modules
1. Dashboard (profile + CV + search + stats + daily matches)
2. Job Match (AI recommendations + match score)
3. Job Detail (JD view + apply)
4. Job Tracker (track applications across statuses)
5. Resume (upload CV + manage versions)
6. AI Tools (toolbox container + placeholder entries)
7. Settings (basic profile info)

### Confirmed decisions (locked)
- ✅ Login is required.
- ✅ Dashboard shows personal info + uploaded CV(s). CV is used for job matching.
- ✅ Job Tracker tracks **only applied jobs** (no “Saved/Interested” status).
- ✅ Apply flow can be external redirect + “Confirm applied” to create tracker record.
- ✅ Match score can be simple for MVP (keyword/embedding).
- ✅ Export (CSV) optional but OK to include.

---

## 1) User Roles & Access

### Roles
- `JobSeeker` (only role in MVP)

### Access rules
- All features require login.
- Users can only access their own data (CVs, searches, tracker records).

---

## 2) Information Architecture (Routes)

Stable routes (UI can change, routes should not):
- `/login`
- `/dashboard`
- `/job-match`
- `/jobs/:jobId`
- `/tracker`
- `/resume`
- `/resume/upload`
- `/ai-tools`
- `/settings`
- *(Optional)* `/export` or a button action that triggers CSV download

---

## 3) Core User Flows (must work end-to-end)

### Flow A — Search → Recommend → View JD → Apply → Tracker
1. User logs in, goes to **Dashboard**.
2. User uploads a CV (or selects default CV).
3. User enters job objectives (free text + optional chips: role/location/job type).
4. App navigates to `/job-match` and starts recommendation generation.
5. Job list appears with `matchScore` for each job.
6. User opens a job card → `/jobs/:jobId` (Job Detail).
7. User clicks **Apply**:
   - MVP: open `externalUrl` in new tab.
   - After redirect, show modal: “Did you apply?” → Yes/No
8. If “Yes”, create tracker record with status = `Applied`.
9. Tracker shows the new record immediately.

### Flow B — Tracker → Update status
1. User visits `/tracker`.
2. User changes status by:
   - clicking status columns/tabs OR editing row
3. Allowed statuses (fixed set):
   - `Applied`, `UnderReview`, `Interview`, `Offer`, `Rejected`
4. Status change updates metrics in Dashboard.

### Flow C — Resume Upload → Use for matching
1. User visits `/resume` → upload new CV (PDF/DOCX).
2. App stores file and extracts text (MVP can do basic parsing; if not available, keep file + manual text input).
3. User sets a **default CV** for matching.
4. Job Match uses selected/default CV content.

---

## 4) Functional Requirements by Module

## 4.1 Dashboard (`/dashboard`)

### Must display
- User greeting + profile summary
- CV section:
  - show uploaded CVs (name, upload date)
  - choose default CV
  - upload CV CTA
- Job Match Assistant:
  - free text input: “Tell me about your ideal job…”
  - optional quick chips: role / location / job type
  - buttons:
    - Upload Resume (shortcut)
    - Job Description input (paste text; optional)
  - Search action → navigates to `/job-match` with query payload
- Daily Job Matches panel:
  - list of recommended jobs (from last search or daily refresh)
  - each item shows title/company/location/tags/matchScore + Apply button
- Application Performance panel (computed from Tracker):
  - total applications
  - interviews count
  - offers count
  - response rate (definition below)
  - status distribution donut (Applied/UnderReview/Interview/Offer/Rejected)
- Calendar widget + subscription card can be UI-only placeholders.

### Metrics definitions (MVP)
- `totalApplications` = number of tracker records
- `interviews` = count(status == Interview)
- `offers` = count(status == Offer)
- `responseRate` = (count(status in {UnderReview, Interview, Offer, Rejected}) / totalApplications) * 100  
  *(You can adjust later; keep stable for now.)*

---

## 4.2 Job Match (`/job-match`)

### Inputs
- Job objectives text (required)
- Filters (optional): location, jobType, tags
- Selected `resumeId` (optional; fallback to user default resume)

### Outputs
A list of Job Cards. Each card must include:
- `jobTitle`, `company`, `location`, `jobType`
- `tags` (skills stack)
- `matchScore` (0–100)
- actions:
  - View JD (go to `/jobs/:jobId`)
  - Apply (external redirect + confirm)
  - *(Optional)* Save to a local list for viewing only, but **NOT** in tracker

### Generation controls
- Regenerate: rerun job recommendation
- Stop: stop streaming if using streaming (optional)
- Recommendation history (optional)

### MatchScore (MVP acceptable)
- Option A: keyword overlap (resume text vs JD)
- Option B: embedding similarity (if available)

Return also:
- `matchRationale` (short bullet explanation, 2–4 points)

---

## 4.3 Job Detail (`/jobs/:jobId`)

### Must display
- Job header: title, company, location, job type, tags
- JD content (full text)
- Match section:
  - matchScore
  - matchRationale
  - *(Optional)* missing skills list (later)

### Actions
- Apply:
  - open externalUrl
  - then prompt confirm applied → creates tracker record
- Back to Job Match

---

## 4.4 Job Tracker (`/tracker`)

### Purpose
Track **only** jobs that user applied to.

### UI behaviour (logic must exist regardless of UI)
- Show a grid/table of applications with sortable columns.
- Status pipeline at top:
  - Applied → UnderReview → Interview → Offer → Rejected
- Filtering:
  - by status
  - by date range (optional)
  - by priority (optional)
- CRUD:
  - add record manually (optional)
  - edit fields
  - delete record (soft delete)

### Required columns (MVP)
- Company
- Role / Job Title
- Platform Source (enum or text: LinkedIn/Official/Referral/Other)
- Date Applied
- Location
- Priority (High/Med/Low)
- Current Status (fixed enum)
- External URL (optional)
- Notes (optional)

### State transitions
- Any status can be changed to any other status (MVP flexible).

---

## 4.5 Resume (`/resume`)

### Must support
- Upload CV (PDF/DOCX)
- List CVs with metadata
- Set default CV
- Delete CV (soft delete)
- *(Optional)* view parsed text preview

### Nice-to-have (can be placeholder)
- AI resume polishing
- Template selection
- Export resume PDF

*(These can appear in UI but return “Coming soon” if not implemented.)*

---

## 4.6 AI Tools (`/ai-tools`)

### MVP requirement
A toolbox container page with cards (config-driven). Provide at least two cards:
- Delivery Plugin (download link placeholder)
- AI Interview (route placeholder: `/ai-interview` or modal “Coming soon”)

Subscription banner can be UI-only placeholder.

---

## 4.7 Settings (`/settings`)

### MVP requirement
- Basic profile fields:
  - name, email (read-only if from auth)
  - location, target role (optional)
- Manage default resume (shortcut)

---

## 5) Data Model (Minimum Entities)

Storage can be SQL/NoSQL; these entities must exist conceptually.

### User
- id
- email
- name
- createdAt
- defaultResumeId (nullable)

### Resume
- id
- userId
- fileName
- fileUrl (or storage key)
- textContent (nullable, extracted)
- createdAt
- updatedAt
- isDefault *(or use user.defaultResumeId)*
- isDeleted (soft delete)

### Job (internal normalized object)
- id
- title
- company
- location
- jobType
- tags[]
- descriptionText
- externalUrl
- sourcePlatform
- createdAt

### MatchResult *(optional table; can be computed on the fly for MVP)*
- id
- userId
- resumeId
- jobId
- matchScore
- rationale (string or list)
- createdAt

### Application (Tracker record)
- id
- userId
- jobId (nullable if job is a snapshot)
- jobSnapshot { title, company, location, externalUrl }  *(recommended for robustness)*
- platformSource
- dateApplied
- status (enum)
- priority
- notes
- createdAt
- updatedAt
- isDeleted (soft delete)

---

## 6) API Requirements (Behaviour-level)

### Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`

### Resume
- `POST /api/resumes` (upload)
- `GET /api/resumes` (list)
- `PATCH /api/resumes/:id` (set default / rename)
- `DELETE /api/resumes/:id`

### Job Match
- `POST /api/match/search`
  - input: `{ queryText, filters?, resumeId? }`
  - output: `{ sessionId, jobs:[...jobCard] }` *(or stream)*
- `GET /api/jobs/:id`
  - returns job detail + match data (if available)

### Apply & Tracker
- `POST /api/applications`
  - create tracker record (from jobId or snapshot)
- `GET /api/applications`
  - list + filter by status/date
- `PATCH /api/applications/:id`
  - update status/fields
- `DELETE /api/applications/:id`

### Dashboard metrics
- `GET /api/metrics/dashboard`
  - output: counts + status breakdown + daily matches (optional)

### Export (optional)
- `GET /api/export/applications.csv`

---

## 7) Edge Cases & UX Rules
- If user has no resume yet:
  - dashboard shows “Upload resume to get match score”
  - job-match can still run but matchScore becomes “N/A” or uses query-only heuristic
- Apply confirmation:
  - If user clicks “No”, do not create tracker record.
  - If user clicks “Yes”, create record with status `Applied`.
- External URL missing:
  - disable Apply button and show “No application link available”.

---

## 8) MVP Definition of Done
- Login works, user sees dashboard.
- Upload a resume and set default resume.
- From dashboard, run a search → job-match list appears.
- Open job detail, click Apply → confirm → tracker record created.
- Tracker records can be updated across statuses.
- Dashboard shows metrics reflecting tracker data.
- AI tools page shows placeholder cards.

---

## 9) Future Extensions (must not break MVP architecture)
- HR side portal
- Browser plugin for auto-detect applied
- Real success rate prediction
- AI interview coaching tool
- Paid subscription + usage limits
- Bulk import from LinkedIn / CSV
