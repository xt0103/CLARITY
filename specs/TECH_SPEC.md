# TECH_SPEC — CLARITY Job Seeker (FastAPI + Next.js + MySQL)

## 0. 目标与范围（MVP）
实现可上线的前后端分离 MVP：
- 登录 → Dashboard
- Resume 上传/管理（CV 用于匹配）
- Job Search/Match（先 Seed/Manual 数据源，后续可加 API/Agent）
- Job Detail → Apply 外链 + “Confirm applied” → 写入 Tracker
- Job Tracker CRUD + 状态流转
- Dashboard 指标聚合
- AI Tools：容器页 + AI Interview 占位（后续实现）

---

## 1. 总体架构
- **Frontend**：Next.js（App Router，React，TypeScript）
- **Backend**：FastAPI（Python）
- **DB**：MySQL（SQLAlchemy + Alembic）
- **Auth**：JWT（Access token；Refresh token 可后加）
- **Storage**：MVP 可本地存储上传文件；上线建议对象存储（S3/R2/Supabase Storage）
- **AI（可选模块）**：OpenAI API（仅后端调用）

**关键原则（保证后续不大改）**
1) Routes 稳定：`/dashboard /job-match /jobs/:id /tracker /resume /ai-tools /settings`  
2) 后端实现 **Job Provider 插拔层**：Seed / Manual / API（后续）  
3) Tracker 永远存 jobSnapshot（title/company/url/location）

---

## 2. Repo 结构建议（前后端两个仓库）

### 2.1 Backend（fastapi-server）
```
fastapi-server/
  app/
    main.py
    core/
      config.py
      security.py          # JWT, password hashing
      db.py                # SQLAlchemy engine/session
    models/
      user.py
      resume.py
      job.py
      application.py
      match_result.py      # optional cache
    schemas/
      auth.py
      resume.py
      job.py
      application.py
      match.py
      metrics.py
    api/
      deps.py              # get_db, get_current_user
      routes/
        auth.py
        resumes.py
        jobs.py
        match.py
        applications.py
        metrics.py
        export.py
    services/
      storage_service.py
      resume_service.py
      job_service.py
      match_service.py
      application_service.py
      metrics_service.py
    providers/
      base.py              # JobProvider interface
      seed_provider.py
      manual_provider.py
      api_provider.py      # future
  alembic/
  alembic.ini
  requirements.txt
  README.md
```

### 2.2 Frontend（next-web）
```
next-web/
  app/
    login/page.tsx
    dashboard/page.tsx
    job-match/page.tsx
    jobs/[jobId]/page.tsx
    tracker/page.tsx
    resume/page.tsx
    ai-tools/page.tsx
    settings/page.tsx
  components/
    layout/*
    dashboard/*
    jobmatch/*
    tracker/*
    resume/*
    ui/*
  lib/
    apiClient.ts          # axios/fetch wrapper + auth
    auth.ts               # token storage helpers
    types.ts              # shared API types
  .env.local
```

---

## 3. 数据库设计（MySQL）
> 推荐 MySQL 8.x，字符集 utf8mb4。

### 3.1 Enums（建议用 VARCHAR 存，便于迁移/扩展）
- `application_status`: `APPLIED | UNDER_REVIEW | INTERVIEW | OFFER | REJECTED`
- `priority`: `HIGH | MEDIUM | LOW`
- `platform_source`: `LINKEDIN | OFFICIAL | REFERRAL | OTHER`

### 3.2 Tables（核心字段）

#### users
- id (CHAR(36) UUID, PK)
- email (VARCHAR(255), unique)
- password_hash (VARCHAR(255))  *(若用邮箱密码登录)*
- name (VARCHAR(120), nullable)
- default_resume_id (CHAR(36), nullable)
- created_at, updated_at (DATETIME)

#### resumes
- id (CHAR(36), PK)
- user_id (CHAR(36), FK -> users.id)
- file_name (VARCHAR(255))
- storage_key (VARCHAR(512))  *(本地路径或对象存储 key)*
- text_content (LONGTEXT, nullable)  *(解析后的纯文本，可先空)*
- is_deleted (TINYINT, default 0)
- created_at, updated_at

Index：`(user_id, created_at)`

#### jobs
- id (CHAR(36), PK)
- title (VARCHAR(255))
- company (VARCHAR(255))
- location (VARCHAR(255), nullable)
- job_type (VARCHAR(80), nullable)
- tags_json (JSON, nullable)  *(skills tags)*
- description_text (LONGTEXT)
- external_url (VARCHAR(1024), nullable)
- source (VARCHAR(50))  *(seed/manual/api/scrape)*
- source_id (VARCHAR(255), nullable) *(原平台id，可空)*
- created_at, updated_at

Index：`(company)`, `(title)`, `(source, source_id)`

#### applications（Job Tracker）
- id (CHAR(36), PK)
- user_id (CHAR(36), FK)
- job_id (CHAR(36), nullable) *(可空，避免来源变更影响历史)*
- snapshot_title (VARCHAR(255))
- snapshot_company (VARCHAR(255))
- snapshot_location (VARCHAR(255), nullable)
- snapshot_external_url (VARCHAR(1024), nullable)
- platform_source (VARCHAR(20))
- date_applied (DATE)
- status (VARCHAR(20))
- priority (VARCHAR(20), nullable)
- notes (TEXT, nullable)
- is_deleted (TINYINT, default 0)
- created_at, updated_at

Index：`(user_id, status)`, `(user_id, date_applied)`

#### match_results（可选缓存）
- id (CHAR(36), PK)
- user_id (CHAR(36), FK)
- resume_id (CHAR(36), FK)
- job_id (CHAR(36), FK)
- match_score (INT 0-100)
- rationale_json (JSON)
- created_at

Index：`(user_id, resume_id)`

---

## 4. Backend API 设计（FastAPI）
> 所有业务 API 默认需要 `Authorization: Bearer <accessToken>`。

### 4.1 认证 Auth
#### POST `/api/auth/register`（可选）
Input: `{ email, password, name? }`

#### POST `/api/auth/login`
Input: `{ email, password }`  
Output:
```json
{ "accessToken": "...", "tokenType": "Bearer", "expiresIn": 3600 }
```

#### GET `/api/me`
Output: user profile + `defaultResumeId`

---

### 4.2 Resume
#### POST `/api/resumes`（上传）
Content-Type: `multipart/form-data`  
Fields: `file`  
Output:
```json
{ "resume": { "id":"...", "fileName":"...", "createdAt":"..." } }
```

#### GET `/api/resumes`
Output:
```json
{ "resumes": [ { "id":"...", "fileName":"...", "isDefault":true } ] }
```

#### PATCH `/api/resumes/{id}`
Input:
- `{ "setAsDefault": true }` 或 `{ "fileName": "..." }`

#### DELETE `/api/resumes/{id}`
Soft delete

---

### 4.3 Job Provider & Match
#### POST `/api/match/search`
Input:
```json
{
  "queryText": "product manager singapore fintech",
  "filters": { "location":"Singapore", "jobType":"Full-time", "tags":["SQL"] },
  "resumeId": "optional"
}
```
Output:
```json
{
  "sessionId": "uuid",
  "jobs": [
    {
      "jobId":"uuid",
      "title":"...",
      "company":"...",
      "location":"...",
      "jobType":"...",
      "tags":["..."],
      "externalUrl":"https://...",
      "matchScore": 0,
      "matchRationale": ["..."]
    }
  ]
}
```

#### GET `/api/jobs/{id}`
Output: job detail + match（使用默认 resume 或 query 参数 resumeId）

---

### 4.4 Apply & Tracker
#### POST `/api/applications`
Input（支持 jobId 或 snapshot）：
```json
{
  "jobId": "optional",
  "jobSnapshot": { "title":"...", "company":"...", "location":"...", "externalUrl":"..." },
  "platformSource": "OFFICIAL",
  "dateApplied": "2026-02-14",
  "status": "APPLIED",
  "priority": "MEDIUM",
  "notes": "Applied via official site"
}
```

#### GET `/api/applications?status=APPLIED&from=2026-01-01&to=2026-02-14`
Output: `{ "applications":[...], "total": 123 }`

#### PATCH `/api/applications/{id}`
Partial update: status/priority/notes/dateApplied/platformSource

#### DELETE `/api/applications/{id}`
Soft delete

---

### 4.5 Dashboard Metrics
#### GET `/api/metrics/dashboard`
Output:
```json
{
  "totals": { "totalApplications": 47, "interviews": 12, "offers": 3, "responseRate": 68 },
  "statusBreakdown": { "APPLIED":10, "UNDER_REVIEW":15, "INTERVIEW":12, "OFFER":3, "REJECTED":7 },
  "dailyMatches": []
}
```

ResponseRate（MVP 固定）：
`(UNDER_REVIEW + INTERVIEW + OFFER + REJECTED) / totalApplications * 100`

---

### 4.6 Export（可选）
#### GET `/api/export/applications.csv`
返回当前用户的 Applications CSV 下载

---

## 5. Job Provider 插拔层（确保后续不大改）
### 5.1 Provider Interface（后端内部）
`providers/base.py`
- `search_jobs(query, filters, limit) -> list[JobNormalized]`
- `get_job(job_id) -> JobNormalized`
- `sync_jobs()`（可选）

### 5.2 MVP 实现顺序
1) `SeedProvider`: 从 DB `jobs` 表检索（title/company/description LIKE）  
2) `ManualProvider`: 用户粘贴 JD（后续可加接口 `/api/jobs/import`），用规则或 GPT 抽取字段后入库  
3) `ApiProvider`（未来）：第三方 job API 定时同步

> 前端永远只调用 `/api/match/search` 和 `/api/jobs/{id}`，不关心来源。

---

## 6. AI 接入（可选模块，不影响非 AI 功能）
### 6.1 最小 AI 用法（MVP）
- `matchScore`：先用简单关键词重合（不调用 AI）
- `matchRationale`：可选调用 GPT 生成 2–4 条解释（后端生成）

### 6.2 AI Interview（后续）
- 新表：`interview_sessions`, `interview_messages`（后加）
- API：
  - `POST /api/interview/sessions`
  - `POST /api/interview/chat`（streaming）
  - `POST /api/interview/score`（输出结构化评分 JSON）

---

## 7. 前端对接方式（Next.js）
### 7.1 API Client（统一封装）
- `lib/apiClient.ts`：axios 或 fetch wrapper
- 自动加 `Authorization: Bearer <token>`
- 401 自动跳转 `/login`

### 7.2 状态管理建议
- 列表/请求缓存：React Query（推荐）或 SWR
- UI 状态：useState + Zustand（可选）

### 7.3 Apply UX（关键）
Job Detail 点击 Apply：
1) `window.open(externalUrl, "_blank")`
2) 弹窗 “Did you apply?” Yes/No
3) Yes → `POST /api/applications`（带 jobSnapshot）

---

## 8. 环境变量（示例）
### Backend `.env`
- `DATABASE_URL=mysql+pymysql://user:pass@localhost:3306/looogo`
- `JWT_SECRET=...`
- `JWT_EXPIRES_IN=3600`
- `UPLOAD_DIR=./uploads`
- *(Optional)* `OPENAI_API_KEY=...`

### Frontend `.env.local`
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`

---

## 9. 本地开发启动
### 9.1 Backend
1) 起 MySQL（本地或 Docker）
2) `pip install -r requirements.txt`
3) `alembic upgrade head`
4) `uvicorn app.main:app --reload --port 8000`

### 9.2 Frontend
1) `npm install`
2) `npm run dev`（默认 3000）
3) 前端通过 `NEXT_PUBLIC_API_BASE_URL` 请求后端

---

## 10. 部署建议（最省事）
- Frontend：Vercel
- Backend：Render / Fly.io / AWS EC2（Docker 推荐）
- DB：托管 MySQL（RDS/PlanetScale/阿里云等）
- Storage：S3/R2（避免多实例文件丢失）

---

## 11. MVP 交付清单（Definition of Done）
- 登录可用（JWT）
- Resume：上传/列表/设默认/删除
- Job Match：能返回 job 列表（先 seed 数据）
- Job Detail：展示 JD + Apply 外链 + confirm
- Tracker：新增记录、状态更新、筛选、软删
- Dashboard：展示聚合指标
- AI Tools：页面容器 + 占位卡片
