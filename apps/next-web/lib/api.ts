import { apiFetch } from "@/lib/apiClient";
import type {
  CreateApplicationRequest,
  CreateApplicationResponse,
  DashboardMetricsResponse,
  JobDetailResponse,
  JobListResponse,
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
  ResumeDetailResponse,
  ResumeListResponse,
  ResumeParseResponse,
  ResumePatchResponse
} from "@/lib/types";

export const api = {
  register: (body: RegisterRequest) =>
    apiFetch<RegisterResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: LoginRequest) =>
    apiFetch<LoginResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => apiFetch<MeResponse>("/api/me"),

  listResumes: () => apiFetch<ResumeListResponse>("/api/resumes"),
  getResumeDetail: (resumeId: string) => apiFetch<ResumeDetailResponse>(`/api/resumes/${resumeId}`),
  uploadResume: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiFetch<ResumeCreateResponse>("/api/resumes", { method: "POST", body: fd });
  },
  patchResume: (resumeId: string, body: { setAsDefault?: boolean; fileName?: string }) =>
    apiFetch<ResumePatchResponse>(`/api/resumes/${resumeId}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    }),
  parseResume: (resumeId: string) => apiFetch<ResumeParseResponse>(`/api/resumes/${resumeId}/parse`, { method: "POST" }),
  deleteResume: (resumeId: string) => apiFetch<void>(`/api/resumes/${resumeId}`, { method: "DELETE" }),

  matchSearch: (body: MatchSearchRequest) =>
    apiFetch<MatchSearchResponse>("/api/match/search", { method: "POST", body: JSON.stringify(body) }),

  searchJobs: (params?: { query?: string; location?: string; company?: string; withMatch?: boolean; favorites?: boolean; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.query) q.set("query", params.query);
    if (params?.location) q.set("location", params.location);
    if (params?.company) q.set("company", params.company);
    if (params?.withMatch) q.set("withMatch", "true");
    if (params?.favorites) q.set("favorites", "true");
    if (typeof params?.limit === "number") q.set("limit", String(params.limit));
    if (typeof params?.offset === "number") q.set("offset", String(params.offset));
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return apiFetch<JobListResponse>(`/api/jobs${suffix}`);
  },
  jobDetail: (jobId: string, resumeId?: string | null, withMatch?: boolean) => {
    const q = new URLSearchParams();
    if (resumeId) q.set("resumeId", resumeId);
    if (withMatch) q.set("withMatch", "true");
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return apiFetch<JobDetailResponse>(`/api/jobs/${jobId}${suffix}`);
  },

  createApplication: (body: CreateApplicationRequest) =>
    apiFetch<CreateApplicationResponse>("/api/applications", { method: "POST", body: JSON.stringify(body) }),
  listApplications: (params?: { status?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return apiFetch<ListApplicationsResponse>(`/api/applications${suffix}`);
  },
  patchApplication: (id: string, body: PatchApplicationRequest) =>
    apiFetch<PatchApplicationResponse>(`/api/applications/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteApplication: (id: string) => apiFetch<void>(`/api/applications/${id}`, { method: "DELETE" }),

  dashboardMetrics: () => apiFetch<DashboardMetricsResponse>("/api/metrics/dashboard"),

  favoriteJob: (jobId: string) => apiFetch<{ message: string }>(`/api/jobs/${jobId}/favorite`, { method: "POST" }),
  unfavoriteJob: (jobId: string) => apiFetch<{ message: string }>(`/api/jobs/${jobId}/favorite`, { method: "DELETE" })
};

