const DRAFT_KEY = "looogo_resume_draft_v2";
const USE_DRAFT_KEY = "looogo_use_resume_draft_v1";

export interface ResumeDraftData {
  personalInfo: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  summary?: string;
  experience: Array<{
    company: string;
    position: string;
    startDate: string;
    endDate?: string;
    current: boolean;
    description: string;
  }>;
  education: Array<{
    school: string;
    degree: string;
    major?: string;
    startDate: string;
    endDate?: string;
    gpa?: string;
  }>;
  skills: string[];
  projects: Array<{
    name: string;
    description: string;
    technologies?: string;
    url?: string;
  }>;
  certifications?: string[];
  languages?: string[];
  other?: string;
}

const DEFAULT_DRAFT: ResumeDraftData = {
  personalInfo: {},
  experience: [],
  education: [],
  skills: [],
  projects: []
};

export function getResumeDraft(): ResumeDraftData {
  if (typeof window === "undefined") return DEFAULT_DRAFT;
  const stored = window.localStorage.getItem(DRAFT_KEY);
  if (!stored) return DEFAULT_DRAFT;
  try {
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_DRAFT, ...parsed };
  } catch {
    // Legacy: try to parse as plain text
    if (stored.trim()) {
      return { ...DEFAULT_DRAFT, other: stored };
    }
    return DEFAULT_DRAFT;
  }
}

export function setResumeDraft(data: ResumeDraftData) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
}

export function clearResumeDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DRAFT_KEY);
}

// Convert structured data to plain text for matching
export function draftToText(draft: ResumeDraftData): string {
  const parts: string[] = [];
  
  if (draft.personalInfo.name) parts.push(`Name: ${draft.personalInfo.name}`);
  if (draft.personalInfo.email) parts.push(`Email: ${draft.personalInfo.email}`);
  if (draft.personalInfo.phone) parts.push(`Phone: ${draft.personalInfo.phone}`);
  if (draft.personalInfo.location) parts.push(`Location: ${draft.personalInfo.location}`);
  
  if (draft.summary) parts.push(`\nSummary:\n${draft.summary}`);
  
  if (draft.experience.length > 0) {
    parts.push("\nExperience:");
    draft.experience.forEach((exp) => {
      parts.push(`${exp.position} at ${exp.company} (${exp.startDate} - ${exp.endDate || exp.current ? "Present" : ""})`);
      if (exp.description) parts.push(exp.description);
    });
  }
  
  if (draft.education.length > 0) {
    parts.push("\nEducation:");
    draft.education.forEach((edu) => {
      parts.push(`${edu.degree}${edu.major ? ` in ${edu.major}` : ""} from ${edu.school} (${edu.startDate} - ${edu.endDate || "Present"})`);
    });
  }
  
  if (draft.skills.length > 0) {
    parts.push(`\nSkills: ${draft.skills.join(", ")}`);
  }
  
  if (draft.projects.length > 0) {
    parts.push("\nProjects:");
    draft.projects.forEach((proj) => {
      parts.push(`${proj.name}: ${proj.description}`);
      if (proj.technologies) parts.push(`Technologies: ${proj.technologies}`);
    });
  }
  
  if (draft.certifications && draft.certifications.length > 0) {
    parts.push(`\nCertifications: ${draft.certifications.join(", ")}`);
  }
  
  if (draft.languages && draft.languages.length > 0) {
    parts.push(`\nLanguages: ${draft.languages.join(", ")}`);
  }
  
  if (draft.other) parts.push(`\nOther: ${draft.other}`);
  
  return parts.join("\n");
}

export function getUseResumeDraftForMatching(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(USE_DRAFT_KEY) === "1";
}

export function setUseResumeDraftForMatching(v: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USE_DRAFT_KEY, v ? "1" : "0");
}

