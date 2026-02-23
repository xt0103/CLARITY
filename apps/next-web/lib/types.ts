export type ApplicationStatus = "APPLIED" | "UNDER_REVIEW" | "INTERVIEW" | "OFFER" | "REJECTED";
export type Priority = "HIGH" | "MEDIUM" | "LOW";
export type PlatformSource = "LINKEDIN" | "OFFICIAL" | "REFERRAL" | "OTHER";

export type RegisterRequest = { email: string; password: string; name: string };
export type RegisterResponse = { user: { id: string; email: string; name?: string | null } };

export type LoginRequest = { email: string; password: string };
export type LoginResponse = { accessToken: string; tokenType: "Bearer"; expiresIn: number };

export type MeResponse = {
  user: { id: string; email: string; name?: string | null; defaultResumeId: string | null; createdAt: string };
};

export type ResumeItem = { id: string; fileName: string; createdAt: string; isDefault: boolean };
export type ResumeListResponse = { resumes: ResumeItem[] };
export type ResumeCreateResponse = { resume: ResumeItem };
export type ResumePatchResponse = { resume: ResumeItem; user: { defaultResumeId: string | null } };
export type ResumeParseResponse = { resumeId: string; keywords: any; updatedAt: string };
export type ResumeDetailResponse = { resume: ResumeItem; textContent?: string | null };

export type MatchSearchRequest = {
  queryText: string;
  filters?: { location?: string; jobType?: string; tags?: string[] };
  resumeId?: string | null;
  limit?: number;
};

export type MatchJobCard = {
  jobId: string;
  title: string;
  company: string;
  location?: string | null;
  jobType?: string | null;
  tags: string[];
  externalUrl?: string | null;
  source: string;
  matchScore: number;
  matchRationale: string[];
};

export type MatchSearchResponse = { sessionId: string; jobs: MatchJobCard[] };

export type JobDetailResponse = {
  job: {
    id: string;
    title: string;
    company: string;
    location?: string | null;
    jobType?: string | null;
    tags: string[];
    descriptionText: string;
    externalUrl?: string | null;
    applyUrl?: string | null;
    postedAt?: string | null;
    source: string;
    sourceId?: string | null;
    isActive?: boolean | null;
    jobKeywords?: {
      skills: string[];
      tools: string[];
      domain: string[];
      titles: string[];
      methods: string[];
    } | null;
    createdAt: string;
    isFavorite?: boolean | null;
  };
  match?: {
    matchScore?: number | null;
    keywordScore?: number | null;
    clusterScore?: number | null;
    matchedClusters?: string[];
    matchedKeywordsByGroup: {
      skills: string[];
      tools: string[];
      domain: string[];
      titles: string[];
      methods: string[];
    };
    missingKeywordsByGroup: {
      skills: string[];
      tools: string[];
      domain: string[];
      titles: string[];
      methods: string[];
    };
    softMatchedKeywordsByGroup?: {
      skills: string[];
      tools: string[];
      domain: string[];
      titles: string[];
      methods: string[];
    } | null;
    note?: string | null;
  } | null;
};

export type JobListItem = {
  id: string;
  title: string;
  company: string;
  location?: string | null;
  descriptionText: string;
  applyUrl?: string | null;
  postedAt?: string | null;
  source: string;
  sourceId?: string | null;
  isActive: boolean;
  jobKeywords?: {
    skills: string[];
    tools: string[];
    domain: string[];
    titles: string[];
    methods: string[];
  } | null;
  match?: {
    matchScore?: number | null;
    keywordScore?: number | null;
    clusterScore?: number | null;
    matchedClusters?: string[];
    matchedKeywordsByGroup: {
      skills: string[];
      tools: string[];
      domain: string[];
      titles: string[];
      methods: string[];
    };
    missingKeywordsByGroup: {
      skills: string[];
      tools: string[];
      domain: string[];
      titles: string[];
      methods: string[];
    };
    softMatchedKeywordsByGroup?: {
      skills: string[];
      tools: string[];
      domain: string[];
      titles: string[];
      methods: string[];
    } | null;
    note?: string | null;
  } | null;
  isFavorite?: boolean | null;
};

export type JobListResponse = {
  jobs: JobListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type CreateApplicationRequest = {
  jobId?: string | null;
  jobSnapshot: { title: string; company: string; location?: string | null; externalUrl?: string | null };
  platformSource: PlatformSource;
  dateApplied: string; // YYYY-MM-DD
  status: ApplicationStatus;
  priority?: Priority | null;
  notes?: string | null;
};

export type ApplicationItem = {
  id: string;
  snapshotTitle: string;
  snapshotCompany: string;
  snapshotLocation?: string | null;
  snapshotExternalUrl?: string | null;
  platformSource: PlatformSource;
  dateApplied: string;
  status: ApplicationStatus;
  priority?: Priority | null;
  isFavorite?: boolean | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateApplicationResponse = { application: ApplicationItem };

export type ListApplicationsResponse = {
  applications: ApplicationItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type PatchApplicationRequest = {
  status?: ApplicationStatus;
  priority?: Priority | null;
  notes?: string | null;
  dateApplied?: string;
  platformSource?: PlatformSource;
};
export type PatchApplicationResponse = { application: { id: string; status?: ApplicationStatus; priority?: Priority | null; notes?: string | null; updatedAt: string } };

export type DashboardMetricsResponse = {
  totals: { totalApplications: number; interviews: number; offers: number; responseRate: number };
  statusBreakdown: Record<ApplicationStatus, number>;
  dailyMatches: unknown[];
};

