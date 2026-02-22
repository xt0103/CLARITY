# API_CONTRACT — CLARITY Job Seeker (FastAPI + Next.js + MySQL)

This contract is the single source of truth for frontend ↔ backend integration.

- Base URL (local): `http://localhost:8000`
- Auth: `Authorization: Bearer <accessToken>`
- Date format: `YYYY-MM-DD` (ISO date)
- Datetime format: ISO 8601 UTC string (e.g., `2026-02-14T04:00:00Z`)
- Pagination (if used): `page` (1-based), `pageSize` (default 20)

## Common Enums

### ApplicationStatus
`APPLIED | UNDER_REVIEW | INTERVIEW | OFFER | REJECTED`

### Priority
`HIGH | MEDIUM | LOW`

### PlatformSource
`LINKEDIN | OFFICIAL | REFERRAL | OTHER`

---

## Error Format (standard)
All errors should follow:
```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "details": { "optional": "object" }
  }
}
```

Common codes:
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `VALIDATION_ERROR` (422)
- `CONFLICT` (409)
- `INTERNAL_ERROR` (500)

---

# 1) Auth

## POST /api/auth/register  (MVP: enabled)
Create an account.

**Request**
```json
{ "email": "user@example.com", "password": "StrongPass123", "name": "Kai Ge" }
```

**Response 201**
```json
{ "user": { "id": "uuid", "email": "user@example.com", "name": "Kai Ge" } }
```

**Errors**
- 409 `CONFLICT` if email exists

---

## POST /api/auth/login  (MVP: enabled)
Login with email + password.

**Request**
```json
{ "email": "user@example.com", "password": "StrongPass123" }
```

**Response 200**
```json
{ "accessToken": "jwt", "tokenType": "Bearer", "expiresIn": 3600 }
```

**Errors**
- 401 `UNAUTHORIZED` invalid credentials

---

## GET /api/me  (MVP: enabled)
Get current user profile.

**Response 200**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Kai Ge",
    "defaultResumeId": "uuid-or-null",
    "createdAt": "2026-02-14T04:00:00Z"
  }
}
```

---

# 2) Resumes (PDF + DOCX)

## POST /api/resumes  (MVP: enabled)
Upload a resume file.

- Content-Type: `multipart/form-data`
- Field: `file` (PDF/DOCX)

**Response 201**
```json
{
  "resume": {
    "id": "uuid",
    "fileName": "Kaige_CV.pdf",
    "createdAt": "2026-02-14T04:00:00Z",
    "isDefault": false
  }
}
```

**Errors**
- 413 `VALIDATION_ERROR` file too large
- 422 `VALIDATION_ERROR` unsupported file type

---

## GET /api/resumes  (MVP: enabled)
List resumes for current user.

**Response 200**
```json
{
  "resumes": [
    {
      "id": "uuid",
      "fileName": "Kaige_CV.pdf",
      "createdAt": "2026-02-14T04:00:00Z",
      "isDefault": true
    }
  ]
}
```

---

## PATCH /api/resumes/{resumeId}  (MVP: enabled)
Update resume metadata / set default.

**Request (set default)**
```json
{ "setAsDefault": true }
```

**Request (rename)**
```json
{ "fileName": "Kaige_CV_v2.pdf" }
```

**Response 200**
```json
{
  "resume": {
    "id": "uuid",
    "fileName": "Kaige_CV_v2.pdf",
    "createdAt": "2026-02-14T04:00:00Z",
    "isDefault": true
  },
  "user": { "defaultResumeId": "uuid" }
}
```

---

## DELETE /api/resumes/{resumeId}  (MVP: enabled)
Soft delete a resume.

**Response 204** (no body)

**Errors**
- 404 `NOT_FOUND`

---

# 3) Jobs & Match

## POST /api/match/search  (MVP: enabled)
Search jobs and compute match score for each job.

**Request**
```json
{
  "queryText": "product manager fintech singapore",
  "filters": {
    "location": "Singapore",
    "jobType": "Full-time",
    "tags": ["SQL", "Analytics"]
  },
  "resumeId": "uuid-or-null",
  "limit": 20
}
```

**Response 200**
```json
{
  "sessionId": "uuid",
  "jobs": [
    {
      "jobId": "uuid",
      "title": "Product Manager",
      "company": "FinTechCo",
      "location": "Singapore",
      "jobType": "Full-time",
      "tags": ["SQL", "Analytics"],
      "externalUrl": "https://example.com/job/123",
      "source": "seed",
      "matchScore": 82,
      "matchRationale": [
        "Matches Product and Analytics keywords",
        "Resume includes SQL + experimentation experience"
      ]
    }
  ]
}
```

**Notes (MVP)**
- Job retrieval uses SeedProvider (DB-seeded jobs).
- `matchScore` can be keyword-based for MVP.
- `matchRationale` may be heuristic or AI-generated later.

**Errors**
- 400 `VALIDATION_ERROR` missing queryText (or empty)

---

## GET /api/jobs/{jobId}  (MVP: enabled)
Fetch job detail. Match is computed using provided resumeId OR user's default resume.

Query params:
- `resumeId` (optional)

**Response 200**
```json
{
  "job": {
    "id": "uuid",
    "title": "Product Manager",
    "company": "FinTechCo",
    "location": "Singapore",
    "jobType": "Full-time",
    "tags": ["SQL", "Analytics"],
    "descriptionText": "Full JD text...",
    "externalUrl": "https://example.com/job/123",
    "source": "seed",
    "createdAt": "2026-02-14T04:00:00Z"
  },
  "match": {
    "matchScore": 82,
    "matchRationale": [
      "Matches Product and Analytics keywords",
      "Resume includes SQL + experimentation experience"
    ]
  }
}
```

**Errors**
- 404 `NOT_FOUND`

---

# 4) Applications (Tracker)

## POST /api/applications  (MVP: enabled)
Create an application tracker record (typically after user confirms they applied).

**Request (recommended: snapshot always provided)**
```json
{
  "jobId": "uuid-or-null",
  "jobSnapshot": {
    "title": "Product Manager",
    "company": "FinTechCo",
    "location": "Singapore",
    "externalUrl": "https://example.com/job/123"
  },
  "platformSource": "OFFICIAL",
  "dateApplied": "2026-02-14",
  "status": "APPLIED",
  "priority": "MEDIUM",
  "notes": "Applied on company site"
}
```

**Response 201**
```json
{
  "application": {
    "id": "uuid",
    "jobId": "uuid-or-null",
    "snapshotTitle": "Product Manager",
    "snapshotCompany": "FinTechCo",
    "snapshotLocation": "Singapore",
    "snapshotExternalUrl": "https://example.com/job/123",
    "platformSource": "OFFICIAL",
    "dateApplied": "2026-02-14",
    "status": "APPLIED",
    "priority": "MEDIUM",
    "notes": "Applied on company site",
    "createdAt": "2026-02-14T04:00:00Z",
    "updatedAt": "2026-02-14T04:00:00Z"
  }
}
```

**Errors**
- 422 `VALIDATION_ERROR` missing snapshot.title/company/dateApplied/status/platformSource

---

## GET /api/applications  (MVP: enabled)
List applications with filters.

Query params:
- `status` (optional)
- `from` (optional date)
- `to` (optional date)
- `page` (optional)
- `pageSize` (optional)

**Response 200**
```json
{
  "applications": [
    {
      "id": "uuid",
      "snapshotTitle": "Product Manager",
      "snapshotCompany": "FinTechCo",
      "snapshotLocation": "Singapore",
      "snapshotExternalUrl": "https://example.com/job/123",
      "platformSource": "OFFICIAL",
      "dateApplied": "2026-02-14",
      "status": "UNDER_REVIEW",
      "priority": "MEDIUM",
      "notes": "Auto reply received",
      "createdAt": "2026-02-14T04:00:00Z",
      "updatedAt": "2026-02-15T04:00:00Z"
    }
  ],
  "total": 47,
  "page": 1,
  "pageSize": 20
}
```

---

## PATCH /api/applications/{applicationId}  (MVP: enabled)
Partial update of an application.

**Request**
```json
{ "status": "INTERVIEW", "notes": "Interview scheduled", "priority": "HIGH" }
```

**Response 200**
```json
{
  "application": {
    "id": "uuid",
    "status": "INTERVIEW",
    "priority": "HIGH",
    "notes": "Interview scheduled",
    "updatedAt": "2026-02-16T04:00:00Z"
  }
}
```

**Errors**
- 404 `NOT_FOUND`

---

## DELETE /api/applications/{applicationId}  (MVP: enabled)
Soft delete an application.

**Response 204** (no body)

---

# 5) Dashboard Metrics

## GET /api/metrics/dashboard  (MVP: enabled)
Return aggregated stats for dashboard.

**Response 200**
```json
{
  "totals": {
    "totalApplications": 47,
    "interviews": 12,
    "offers": 3,
    "responseRate": 68
  },
  "statusBreakdown": {
    "APPLIED": 10,
    "UNDER_REVIEW": 15,
    "INTERVIEW": 12,
    "OFFER": 3,
    "REJECTED": 7
  },
  "dailyMatches": []
}
```

ResponseRate definition (locked for MVP):
`(UNDER_REVIEW + INTERVIEW + OFFER + REJECTED) / totalApplications * 100`

---

# 6) Export (Optional)

## GET /api/export/applications.csv
Download current user's applications as CSV.

**Response 200**
- `Content-Type: text/csv`
- Body: CSV file
