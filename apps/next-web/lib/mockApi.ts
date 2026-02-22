import type {
  CreateApplicationRequest,
  CreateApplicationResponse,
  DashboardMetricsResponse,
  JobDetailResponse,
  ListApplicationsResponse,
  LoginRequest,
  LoginResponse,
  MatchSearchRequest,
  MatchSearchResponse,
  MeResponse,
  PatchApplicationRequest,
  PatchApplicationResponse,
  RegisterRequest,
  RegisterResponse,
  ResumeCreateResponse,
  ResumeListResponse,
  ResumePatchResponse
} from "@/lib/types";
import { ApiError } from "@/lib/apiClient";
import { computeMetrics, initialMockState, type MockState } from "@/lib/mockData";

const STORAGE_KEY = "clarity_mock_state_v1";

function loadState(): MockState {
  if (typeof window === "undefined") return initialMockState;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialMockState;
  try {
    return JSON.parse(raw) as MockState;
  } catch {
    return initialMockState;
  }
}

function saveState(state: MockState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function delay(ms = 250) {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureToken(accessToken?: string) {
  if (!accessToken) {
    throw new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Unauthorized" });
  }
}

export const mockApi = {
  async register(body: RegisterRequest): Promise<RegisterResponse> {
    await delay();
    // In mock mode, we don't manage multiple users; accept any register.
    const state = loadState();
    state.me.user.email = body.email;
    state.me.user.name = body.name;
    saveState(state);
    return { user: { id: state.me.user.id, email: body.email, name: body.name } };
  },

  async login(_body: LoginRequest): Promise<LoginResponse> {
    await delay();
    return { accessToken: "mock-token", tokenType: "Bearer", expiresIn: 3600 };
  },

  async me(accessToken: string): Promise<MeResponse> {
    await delay();
    ensureToken(accessToken);
    return loadState().me;
  },

  async listResumes(accessToken: string): Promise<ResumeListResponse> {
    await delay();
    ensureToken(accessToken);
    return { resumes: loadState().resumes };
  },

  async uploadResume(accessToken: string, file: File): Promise<ResumeCreateResponse> {
    await delay();
    ensureToken(accessToken);
    const state = loadState();
    const id = `mock-resume-${Date.now()}`;
    const item = { id, fileName: file.name, createdAt: new Date().toISOString(), isDefault: state.resumes.length === 0 };
    state.resumes = [item, ...state.resumes];
    if (item.isDefault) state.me.user.defaultResumeId = id;
    saveState(state);
    return { resume: item };
  },

  async patchResume(
    accessToken: string,
    resumeId: string,
    body: { setAsDefault?: boolean; fileName?: string }
  ): Promise<ResumePatchResponse> {
    await delay();
    ensureToken(accessToken);
    const state = loadState();
    const r = state.resumes.find((x) => x.id === resumeId);
    if (!r) throw new ApiError({ status: 404, code: "NOT_FOUND", message: "Resume not found" });
    if (body.fileName) r.fileName = body.fileName;
    if (body.setAsDefault) {
      state.me.user.defaultResumeId = r.id;
      state.resumes = state.resumes.map((x) => ({ ...x, isDefault: x.id === r.id }));
    }
    saveState(state);
    const updated = state.resumes.find((x) => x.id === resumeId)!;
    return { resume: updated, user: { defaultResumeId: state.me.user.defaultResumeId } };
  },

  async deleteResume(accessToken: string, resumeId: string): Promise<void> {
    await delay();
    ensureToken(accessToken);
    const state = loadState();
    state.resumes = state.resumes.filter((x) => x.id !== resumeId);
    if (state.me.user.defaultResumeId === resumeId) state.me.user.defaultResumeId = null;
    saveState(state);
  },

  async matchSearch(accessToken: string, body: MatchSearchRequest): Promise<MatchSearchResponse> {
    await delay();
    ensureToken(accessToken);
    const q = (body.queryText || "").toLowerCase();
    const state = loadState();
    const jobs = state.jobs
      .filter((j) => {
        if (!q) return true;
        return (
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          j.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .slice(0, body.limit ?? 20)
      .map(({ descriptionText: _dt, ...card }) => card);

    return { sessionId: `mock-session-${Date.now()}`, jobs };
  },

  async jobDetail(accessToken: string, jobId: string): Promise<JobDetailResponse> {
    await delay();
    ensureToken(accessToken);
    const job = loadState().jobs.find((j) => j.jobId === jobId);
    if (!job) throw new ApiError({ status: 404, code: "NOT_FOUND", message: "Job not found" });
    return {
      job: {
        id: job.jobId,
        title: job.title,
        company: job.company,
        location: job.location ?? null,
        jobType: job.jobType ?? null,
        tags: job.tags,
        descriptionText: job.descriptionText,
        externalUrl: job.externalUrl ?? null,
        source: job.source,
        createdAt: new Date().toISOString()
      },
      match: { matchScore: job.matchScore, matchRationale: job.matchRationale }
    };
  },

  async createApplication(accessToken: string, body: CreateApplicationRequest): Promise<CreateApplicationResponse> {
    await delay();
    ensureToken(accessToken);
    const state = loadState();
    const id = `mock-app-${Date.now()}`;
    const now = new Date().toISOString();
    const application = {
      id,
      snapshotTitle: body.jobSnapshot.title,
      snapshotCompany: body.jobSnapshot.company,
      snapshotLocation: body.jobSnapshot.location ?? null,
      snapshotExternalUrl: body.jobSnapshot.externalUrl ?? null,
      platformSource: body.platformSource,
      dateApplied: body.dateApplied,
      status: body.status,
      priority: body.priority ?? null,
      notes: body.notes ?? null,
      createdAt: now,
      updatedAt: now
    };
    state.applications = [application, ...state.applications];
    saveState(state);
    return { application };
  },

  async listApplications(accessToken: string, params?: { status?: string }): Promise<ListApplicationsResponse> {
    await delay();
    ensureToken(accessToken);
    const state = loadState();
    const apps = params?.status ? state.applications.filter((a) => a.status === params.status) : state.applications;
    return { applications: apps, total: apps.length, page: 1, pageSize: 20 };
  },

  async patchApplication(accessToken: string, id: string, body: PatchApplicationRequest): Promise<PatchApplicationResponse> {
    await delay();
    ensureToken(accessToken);
    const state = loadState();
    const a = state.applications.find((x) => x.id === id);
    if (!a) throw new ApiError({ status: 404, code: "NOT_FOUND", message: "Application not found" });
    if (body.status) a.status = body.status;
    if (body.priority !== undefined) a.priority = body.priority ?? null;
    if (body.notes !== undefined) a.notes = body.notes ?? null;
    a.updatedAt = new Date().toISOString();
    saveState(state);
    return { application: { id: a.id, status: a.status, priority: a.priority ?? null, notes: a.notes ?? null, updatedAt: a.updatedAt } };
  },

  async dashboardMetrics(accessToken: string): Promise<DashboardMetricsResponse> {
    await delay();
    ensureToken(accessToken);
    return computeMetrics(loadState().applications);
  }
};

