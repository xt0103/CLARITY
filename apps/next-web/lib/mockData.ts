import type {
  ApplicationItem,
  ApplicationStatus,
  DashboardMetricsResponse,
  MatchJobCard,
  MeResponse,
  PlatformSource,
  ResumeItem
} from "@/lib/types";

export type MockState = {
  me: MeResponse;
  resumes: ResumeItem[];
  jobs: Array<MatchJobCard & { descriptionText: string }>;
  applications: ApplicationItem[];
};

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

export const initialMockState: MockState = {
  me: {
    user: {
      id: "mock-user",
      email: "demo@example.com",
      name: "Demo User",
      defaultResumeId: null,
      createdAt: nowIso()
    }
  },
  resumes: [
    { id: "mock-resume-1", fileName: "Demo_CV.pdf", createdAt: nowIso(), isDefault: true }
  ],
  jobs: [
    {
      jobId: "mock-job-1",
      title: "Senior Frontend Developer",
      company: "TechCorp Inc.",
      location: "San Francisco, CA",
      jobType: "Full-time",
      tags: ["React", "TypeScript", "Tailwind"],
      externalUrl: "https://example.com/jobs/mock-1",
      source: "seed",
      matchScore: 95,
      matchRationale: ["Strong React + TypeScript overlap", "Prior frontend system experience", "Great fit for senior scope"],
      descriptionText:
        "Full JD text (mock).\n\nResponsibilities:\n- Build UI\n- Collaborate\n\nRequirements:\n- React, TypeScript"
    },
    {
      jobId: "mock-job-2",
      title: "Full Stack Engineer",
      company: "StartupXYZ",
      location: "Remote",
      jobType: "Full-time",
      tags: ["Node.js", "React", "AWS"],
      externalUrl: "https://example.com/jobs/mock-2",
      source: "seed",
      matchScore: 88,
      matchRationale: ["Good JS stack overlap", "Backend + cloud exposure", "Remote-friendly role"],
      descriptionText: "Full JD text (mock)."
    },
    {
      jobId: "mock-job-3",
      title: "Product Designer",
      company: "Design Studio",
      location: "New York, NY",
      jobType: "Contract",
      tags: ["Figma", "UI/UX", "Prototyping"],
      externalUrl: "https://example.com/jobs/mock-3",
      source: "seed",
      matchScore: 82,
      matchRationale: ["Design tooling overlap", "User research experience", "Strong portfolio alignment"],
      descriptionText: "Full JD text (mock)."
    },
    {
      jobId: "mock-job-4",
      title: "Developer Engineer",
      company: "Cloud Solutions",
      location: "Austin, TX",
      jobType: "Full-time",
      tags: ["Docker", "Kubernetes", "CI/CD"],
      externalUrl: "https://example.com/jobs/mock-4",
      source: "seed",
      matchScore: 79,
      matchRationale: ["DevOps keywords match", "K8s familiarity", "Delivery focus"],
      descriptionText: "Full JD text (mock)."
    }
  ],
  applications: [
    {
      id: "mock-app-1",
      snapshotTitle: "Senior Frontend Developer",
      snapshotCompany: "TechCorp Inc.",
      snapshotLocation: "San Francisco, CA",
      snapshotExternalUrl: "https://example.com/jobs/mock-1",
      platformSource: "OFFICIAL",
      dateApplied: today(),
      status: "UNDER_REVIEW",
      priority: "MEDIUM",
      notes: "Auto reply received",
      createdAt: nowIso(),
      updatedAt: nowIso()
    }
  ]
};

export function computeMetrics(applications: ApplicationItem[]): DashboardMetricsResponse {
  const statuses: ApplicationStatus[] = ["APPLIED", "UNDER_REVIEW", "INTERVIEW", "OFFER", "REJECTED"];
  const statusBreakdown = Object.fromEntries(statuses.map((s) => [s, 0])) as Record<ApplicationStatus, number>;
  for (const a of applications) statusBreakdown[a.status] = (statusBreakdown[a.status] || 0) + 1;
  const totalApplications = applications.length;
  const interviews = statusBreakdown.INTERVIEW;
  const offers = statusBreakdown.OFFER;
  const responded =
    statusBreakdown.UNDER_REVIEW + statusBreakdown.INTERVIEW + statusBreakdown.OFFER + statusBreakdown.REJECTED;
  const responseRate = totalApplications > 0 ? Math.round((responded / totalApplications) * 100) : 0;
  return { totals: { totalApplications, interviews, offers, responseRate }, statusBreakdown, dailyMatches: [] };
}

