"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, useMemo } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { CompanyLogo } from "@/lib/companyLogo";

// Helper function to parse job description into sections
function parseJobDescription(text: string) {
  const sections: {
    about?: string;
    responsibilities?: string[];
    requirements?: string[];
    niceToHave?: string[];
  } = {};

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let currentSection: "about" | "responsibilities" | "requirements" | "niceToHave" | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    
    if (lower.includes("about") || lower.includes("role") || lower.includes("职位") || lower.includes("岗位")) {
      if (currentSection && currentSection === "about") {
        sections[currentSection] = currentContent.join("\n");
      }
      currentSection = "about";
      currentContent = [];
    } else if (lower.includes("responsibilit") || lower.includes("职责") || lower.includes("工作内容")) {
      if (currentSection && currentSection === "about") {
        sections[currentSection] = currentContent.join("\n");
      }
      currentSection = "responsibilities";
      currentContent = [];
      if (!sections.responsibilities) {
        sections.responsibilities = [];
      }
    } else if (lower.includes("requirement") || lower.includes("要求") || lower.includes("must have")) {
      if (currentSection) {
        if (currentSection === "about") {
          sections[currentSection] = currentContent.join("\n");
        }
      }
      currentSection = "requirements";
      currentContent = [];
      if (!sections.requirements) {
        sections.requirements = [];
      }
    } else if (lower.includes("nice to have") || lower.includes("preferred") || lower.includes("加分项")) {
      if (currentSection) {
        if (currentSection === "about") {
          sections[currentSection] = currentContent.join("\n");
        }
      }
      currentSection = "niceToHave";
      currentContent = [];
      if (!sections.niceToHave) {
        sections.niceToHave = [];
      }
    } else if (currentSection) {
      // Extract bullet points
      const bulletMatch = line.match(/^[-•*]\s*(.+)$/);
      if (bulletMatch) {
        if (currentSection === "responsibilities" || currentSection === "requirements" || currentSection === "niceToHave") {
          if (!sections[currentSection]) {
            sections[currentSection] = [];
          }
          sections[currentSection]!.push(bulletMatch[1]);
        } else {
          currentContent.push(bulletMatch[1]);
        }
      } else {
        if (currentSection === "about") {
          currentContent.push(line);
        } else if (currentSection === "responsibilities" || currentSection === "requirements" || currentSection === "niceToHave") {
          if (!sections[currentSection]) {
            sections[currentSection] = [];
          }
          sections[currentSection]!.push(line);
        }
      }
    }
  }

  if (currentSection === "about") {
    sections[currentSection] = currentContent.join("\n");
  }

  return sections;
}

// Calculate standards from match breakdown (if available)
function calculateStandards(match: any) {
  // Default values if no match data
  if (!match?.breakdown) {
    return {
      strategic: 40,
      execution: 30,
      data: 30
    };
  }

  const breakdown = match.breakdown;
  const requirements = breakdown.requirements || {};
  const responsibilities = breakdown.responsibilities || {};
  
  // Calculate based on section scores
  const strategic = requirements.sectionScore || 40;
  const execution = responsibilities.sectionScore || 30;
  const data = breakdown.nice_to_have?.sectionScore || 30;

  return {
    strategic: Math.round(strategic),
    execution: Math.round(execution),
    data: Math.round(data)
  };
}

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("resumeId");
  const router = useRouter();
  const qc = useQueryClient();
  const [toastOpen, setToastOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"now" | "future">("now");

  const jobQ = useQuery({
    queryKey: ["job", jobId, resumeId],
    queryFn: async () => api.jobDetail(jobId, resumeId, true),
    enabled: !!jobId
  });

  const applyMut = useMutation({
    mutationFn: async () => {
      if (!jobQ.data) throw new Error("No job loaded");
      const j = jobQ.data.job;
      const outbound = j.applyUrl || j.externalUrl || null;
      return api.createApplication({
        jobId: j.id,
        jobSnapshot: {
          title: j.title,
          company: j.company,
          location: j.location || null,
          externalUrl: outbound
        },
        platformSource: "OFFICIAL",
        dateApplied: new Date().toISOString().slice(0, 10),
        status: "APPLIED",
        priority: "MEDIUM",
        notes: "Applied (confirmed)"
      });
    },
    onSuccess: async (res) => {
      if (!res) return;
      await qc.invalidateQueries({ queryKey: ["applications"] });
      await qc.invalidateQueries({ queryKey: ["metrics"] });
      setToastOpen(true);
    }
  });

  const favoriteMut = useMutation({
    mutationFn: async (isFavorite: boolean) => {
      if (!jobId) throw new Error("No job ID");
      if (isFavorite) {
        return api.favoriteJob(jobId);
      } else {
        return api.unfavoriteJob(jobId);
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["job", jobId] });
      await qc.invalidateQueries({ queryKey: ["jobs"] });
    }
  });

  const parsedDescription = useMemo(() => {
    if (!jobQ.data?.job.descriptionText) return null;
    return parseJobDescription(jobQ.data.job.descriptionText);
  }, [jobQ.data?.job.descriptionText]);

  const standards = useMemo(() => {
    if (!jobQ.data?.match) return { strategic: 40, execution: 30, data: 30 };
    return calculateStandards(jobQ.data.match);
  }, [jobQ.data?.match]);

  // Collect all matched and missing keywords
  const allMatchedKeywords = useMemo(() => {
    if (!jobQ.data?.match) return [];
    const match = jobQ.data.match;
    const all: string[] = [];
    if (match.matchedKeywordsByGroup) {
      Object.values(match.matchedKeywordsByGroup).forEach((arr: any) => {
        if (Array.isArray(arr)) all.push(...arr);
      });
    }
    return all.slice(0, 10);
  }, [jobQ.data?.match]);

  const allMissingKeywords = useMemo(() => {
    if (!jobQ.data?.match) return [];
    const match = jobQ.data.match;
    const all: string[] = [];
    if (match.missingKeywordsByGroup) {
      Object.values(match.missingKeywordsByGroup).forEach((arr: any) => {
        if (Array.isArray(arr)) all.push(...arr);
      });
    }
    return all.slice(0, 6);
  }, [jobQ.data?.match]);

  return (
    <AppShell>
      <div style={{ marginBottom: 10 }}>
        <Link href="/job-match">← Back to Job Match</Link>
      </div>
      {jobQ.isLoading && <p>Loading...</p>}
      {jobQ.error && (
        <p style={{ color: "#b91c1c" }}>
          {jobQ.error instanceof ApiError ? `${jobQ.error.code}: ${jobQ.error.message}` : "Failed to load job"}
        </p>
      )}

      {applyMut.error && (
        <p style={{ color: "#b91c1c" }}>
          {applyMut.error instanceof ApiError ? `${applyMut.error.code}: ${applyMut.error.message}` : "Failed to create application"}
        </p>
      )}

      {jobQ.data && (
        <div
          style={{
            // Softer, lighter background gradient to blend with header
            background:
              "linear-gradient(to bottom, #f9fafb 0%, #f4f6ff 26%, #eef3ff 55%, #eaf3ff 85%, #e5f1ff 100%)",
            padding: "16px 0 28px",
            minHeight: "calc(100vh - 72px)"
          }}
        >
          <div
            style={{
              maxWidth: 1320,
              margin: "0 auto",
              padding: "0 16px",
              display: "flex",
              flexDirection: "column",
              gap: 24
            }}
          >
          {/* Tab Switcher - Top Right */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 20 }}>
            <button
              onClick={() => setActiveTab("now")}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: activeTab === "now" ? "#0f172a" : "#fff",
                color: activeTab === "now" ? "#fff" : "#64748b",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer"
              }}
            >
              Now
            </button>
            <button
              onClick={() => setActiveTab("future")}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: activeTab === "future" ? "#0f172a" : "#fff",
                color: activeTab === "future" ? "#fff" : "#64748b",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer"
              }}
            >
              Future
            </button>
          </div>

          {activeTab === "now" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.6fr) 380px",
                gap: 20,
                alignItems: "flex-start"
              }}
            >
              {/* Left Panel: Job Description in single white card */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 24,
                  padding: 24,
                  boxShadow: "0 20px 40px rgba(15,23,42,0.18)",
                  border: "1px solid rgba(226,232,240,0.95)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 20
                }}
              >
                {/* Job Header */}
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <CompanyLogo 
                    companyName={jobQ.data.job.company} 
                    logoUrl={jobQ.data.job.companyLogoUrl}
                    size={80}
                  />
                  <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px 0", color: "#0f172a" }}>
                      {jobQ.data.job.title}
                    </h1>
                    <div style={{ fontSize: 18, color: "#475569", fontWeight: 500, marginBottom: 16 }}>
                      {jobQ.data.job.company}
                    </div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 14, color: "#64748b" }}>
                      <div>📍 {jobQ.data.job.location || "—"}</div>
                      <div>💼 {jobQ.data.job.jobType || "Full time"}</div>
                      <div>💰 $10K/Month</div>
                      <div>📅 {jobQ.data.job.postedAt ? new Date(jobQ.data.job.postedAt).toLocaleDateString("en-US", { year: "numeric", month: "numeric", day: "numeric" }).replace(/\//g, ".") : "—"}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => {
                        const url = jobQ.data?.job.applyUrl || jobQ.data?.job.externalUrl;
                        if (url) window.open(url, "_blank", "noopener,noreferrer");
                        setConfirmOpen(true);
                      }}
                      disabled={applyMut.isPending || jobQ.isLoading}
                      style={{
                        padding: "12px 20px",
                        borderRadius: 8,
                        border: 0,
                        background: "#2563eb",
                        color: "#fff",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8
                      }}
                    >
                      {applyMut.isPending ? "Applying..." : "Apply →"}
                    </button>
                    <button
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({
                            title: jobQ.data.job.title,
                            text: `Check out this job: ${jobQ.data.job.title} at ${jobQ.data.job.company}`,
                            url: window.location.href
                          });
                        }
                      }}
                      style={{
                        padding: "12px",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        background: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                      title="Share"
                    >
                      <span style={{ fontSize: 18 }}>📄</span>
                    </button>
                    <button
                      onClick={() => {
                        if (!jobQ.data) return;
                        const isFavorite = jobQ.data.job.isFavorite || false;
                        favoriteMut.mutate(!isFavorite);
                      }}
                      disabled={favoriteMut.isPending || jobQ.isLoading}
                      style={{
                        padding: "12px",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        background: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                      title={jobQ.data?.job.isFavorite ? "Unfavorite" : "Favorite"}
                    >
                      <span style={{ fontSize: 18, color: jobQ.data?.job.isFavorite ? "#fbbf24" : "#64748b" }}>
                        {jobQ.data?.job.isFavorite ? "★" : "☆"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* About the Role */}
                {parsedDescription?.about && (
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>About the Role</h2>
                    <p style={{ fontSize: 15, lineHeight: 1.6, color: "#475569" }}>{parsedDescription.about}</p>
                  </div>
                )}

                {/* Responsibilities */}
                {parsedDescription?.responsibilities && parsedDescription.responsibilities.length > 0 && (
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>Responsibilities</h2>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      {parsedDescription.responsibilities.map((item, idx) => (
                        <li key={idx} style={{ fontSize: 15, lineHeight: 1.6, color: "#475569", display: "flex", gap: 8 }}>
                          <span style={{ color: "#2563eb", fontWeight: 700 }}>•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Requirements */}
                {parsedDescription?.requirements && parsedDescription.requirements.length > 0 && (
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>Requirements</h2>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      {parsedDescription.requirements.map((item, idx) => (
                        <li key={idx} style={{ fontSize: 15, lineHeight: 1.6, color: "#475569", display: "flex", gap: 8 }}>
                          <span style={{ color: "#2563eb", fontWeight: 700 }}>•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Nice to Have */}
                {parsedDescription?.niceToHave && parsedDescription.niceToHave.length > 0 && (
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>Nice to Have</h2>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      {parsedDescription.niceToHave.map((item, idx) => (
                        <li key={idx} style={{ fontSize: 15, lineHeight: 1.6, color: "#475569", display: "flex", gap: 8 }}>
                          <span style={{ color: "#2563eb", fontWeight: 700 }}>•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Full Description (fallback) */}
                {!parsedDescription?.about && (
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>Description</h2>
                    <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit", fontSize: 15, lineHeight: 1.6, color: "#475569" }}>
                      {jobQ.data.job.descriptionText}
                    </pre>
                  </div>
                )}

                {/* Standards */}
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>Standards</h2>
                  <div style={{ position: "relative", height: 40, background: "#f1f5f9", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ display: "flex", height: "100%" }}>
                      <div
                        style={{
                          width: `${standards.strategic}%`,
                          background: "#2563eb",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 600
                        }}
                      >
                        {standards.strategic}% Strategic Ownership
                      </div>
                      <div
                        style={{
                          width: `${standards.execution}%`,
                          background: "#06b6d4",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 600
                        }}
                      >
                        {standards.execution}% Execution Leadership
                      </div>
                      <div
                        style={{
                          width: `${standards.data}%`,
                          background: "#8b5cf6",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 600
                        }}
                      >
                        {standards.data}% Data & Metrics Orientation
                      </div>
                    </div>
                  </div>
                </div>

                {/* Schedule Forecast */}
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>Schedule Forecast</h2>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#0f172a" }}>Phase</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#0f172a" }}>Weeks</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#0f172a" }}>Key Activities</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#0f172a" }}>Output</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { phase: "Product Strategy & Alignment", weeks: "Week 1-2", activities: "Define product vision, stakeholder alignment", output: "Product vision doc" },
                          { phase: "User & Market Discovery", weeks: "Week 3-4", activities: "User interviews, market research", output: "Problem statement" },
                          { phase: "PRD & Roadmap Planning", weeks: "Week 5-6", activities: "Write PRD, define success metrics", output: "PRD document" },
                          { phase: "Design & Prototyping", weeks: "Week 7-8", activities: "Create wireframes, interactive prototype", output: "Interactive prototype" },
                          { phase: "Engineering Development", weeks: "Week 9-10", activities: "Sprint planning, feature development", output: "Working product features" },
                          { phase: "Testing & Experiment Setup", weeks: "Week 11", activities: "QA testing, A/B test setup", output: "Tested release candidate" },
                          { phase: "Launch Preparation", weeks: "Week 12", activities: "Release planning, documentation", output: "Launch plan" },
                          { phase: "Launch & Iteration", weeks: "Week 12+", activities: "Feature launch, performance monitoring", output: "Performance report" }
                        ].map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 1 ? "#fafafa" : "transparent" }}>
                            <td style={{ padding: "10px 12px", color: "#475569" }}>{row.phase}</td>
                            <td style={{ padding: "10px 12px", color: "#64748b" }}>{row.weeks}</td>
                            <td style={{ padding: "10px 12px", color: "#475569" }}>{row.activities}</td>
                            <td style={{ padding: "10px 12px", color: "#475569" }}>{row.output}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Must Have */}
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>Must Have</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      "5+ years of product management experience",
                      "End-to-end ownership experience",
                      "Strong data & KPI ownership",
                      "Cross-functional leadership experience",
                      "SQL or analytics tool proficiency"
                    ].map((item, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>
                        </div>
                        <span style={{ fontSize: 15, color: "#475569", lineHeight: 1.5 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Talent Pool Forecast */}
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>Talent Pool Forecast</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {[
                      { title: "SaaS Product Manager", background: "PMs from SaaS or B2B software companies", characteristics: "Experience managing product roadmaps, familiar with SaaS metrics, work closely with design, engineering, and business teams." },
                      { title: "Technical Product Manager", background: "PMs with engineering or data-related backgrounds", characteristics: "Strong collaboration with engineering teams, comfortable with data analysis or SQL, experience working on technically complex products." },
                      { title: "Growth Product Manager", background: "PMs from startups or fast-growing companies", characteristics: "Used to fast product iterations, experience launching and testing new features, comfortable working in dynamic environments." }
                    ].map((pool, idx) => (
                      <div key={idx} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, background: "#fff" }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>{pool.title}</div>
                        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8, fontWeight: 500 }}>Background</div>
                        <div style={{ fontSize: 14, color: "#475569", marginBottom: 12, lineHeight: 1.5 }}>{pool.background}</div>
                        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8, fontWeight: 500 }}>Typical Characteristics</div>
                        <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.5 }}>{pool.characteristics}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Your Typical Day */}
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>Your Typical Day</h2>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, background: "#fff" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {[
                        { time: "9:00 AM", activity: "Team Standup", duration: "15 min", category: "Meeting", color: "#3b82f6" },
                        { time: "9:15 AM", activity: "Product Strategy Review", duration: "2 hrs", category: "Focus", color: "#10b981" },
                        { time: "11:30 AM", activity: "Coffee Break & Networking", duration: "30 min", category: "Break", color: "#f59e0b" },
                        { time: "12:00 PM", activity: "User Research Session", duration: "1 hr", category: "Meeting", color: "#3b82f6" },
                        { time: "1:00 PM", activity: "Lunch Break", duration: "1 hr", category: "Break", color: "#f59e0b" },
                        { time: "2:00 PM", activity: "Deep Work - Roadmap Planning", duration: "2 hrs", category: "Focus", color: "#10b981" },
                        { time: "4:00 PM", activity: "Cross-team Collaboration", duration: "1 hr", category: "Meeting", color: "#3b82f6" },
                        { time: "5:00 PM", activity: "Wrap-up & Planning", duration: "30 min", category: "Focus", color: "#10b981" },
                        { time: "5:30 PM", activity: "Personal Time / Gym", duration: "Flexible", category: "Life", color: "#8b5cf6" }
                      ].map((item, idx) => (
                        <div key={idx} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <div style={{ minWidth: 80, fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{item.time}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 500, color: "#475569", marginBottom: 4 }}>{item.activity}</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <span style={{ fontSize: 12, color: "#64748b" }}>{item.duration}</span>
                              <span
                                style={{
                                  padding: "2px 8px",
                                  borderRadius: 12,
                                  background: `${item.color}15`,
                                  color: item.color,
                                  fontSize: 11,
                                  fontWeight: 600
                                }}
                              >
                                {item.category}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: 16, padding: 12, background: "#dcfce7", borderRadius: 8, border: "1px solid #bbf7d0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 200, height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: "82%", height: "100%", background: "#22c55e" }} />
                      </div>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "#166534" }}>82%</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#166534", lineHeight: 1.5 }}>
                      Work-Life Balance Score: Flexible hours, remote options, and 5:30pm end time leave plenty of room for personal life.
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Panel: Job Match Analysis */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ border: "1px solid #e2e8f0", background: "#fff", padding: 24, borderRadius: 12 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: "#0f172a" }}>Job Match Analysis</h2>
                  
                  {jobQ.data.match?.matchScore == null ? (
                    <div style={{ color: "#64748b", fontSize: 14, textAlign: "center", padding: 40 }}>
                      Upload/parse a resume to see match score.{" "}
                      <Link href="/resume" style={{ color: "#2563eb", fontWeight: 600 }}>
                        Upload resume →
                      </Link>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      {/* Match Score Circle */}
                      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                        <div style={{ position: "relative", width: 160, height: 160 }}>
                          <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: "rotate(-90deg)" }}>
                            <circle
                              cx="80"
                              cy="80"
                              r="70"
                              fill="none"
                              stroke="#e2e8f0"
                              strokeWidth="12"
                            />
                            <circle
                              cx="80"
                              cy="80"
                              r="70"
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth="12"
                              strokeDasharray={`${2 * Math.PI * 70}`}
                              strokeDashoffset={`${2 * Math.PI * 70 * (1 - (jobQ.data.match.matchScore || 0) / 100)}`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            textAlign: "center"
                          }}>
                            <div style={{ fontSize: 32, fontWeight: 700, color: "#0f172a" }}>
                              {jobQ.data.match.matchScore}%
                            </div>
                            <div style={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>Match</div>
                          </div>
                        </div>
                      </div>

                      {/* Match Breakdown */}
                      <div style={{ display: "flex", justifyContent: "center", gap: 16, fontSize: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563eb" }} />
                          <span style={{ color: "#64748b", fontWeight: 500 }}>Matched ({allMatchedKeywords.length})</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#cbd5e1" }} />
                          <span style={{ color: "#64748b", fontWeight: 500 }}>Missing ({allMissingKeywords.length})</span>
                        </div>
                      </div>

                      {/* You Have */}
                      {allMatchedKeywords.length > 0 && (
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 12 }}>You Have ({allMatchedKeywords.length})</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {allMatchedKeywords.map((keyword, idx) => (
                              <span
                                key={idx}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 20,
                                  background: "#dbeafe",
                                  color: "#1e40af",
                                  fontSize: 13,
                                  fontWeight: 500
                                }}
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Missing Skills */}
                      {allMissingKeywords.length > 0 && (
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 12 }}>Missing Skills ({allMissingKeywords.length})</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {allMissingKeywords.map((keyword, idx) => (
                              <span
                                key={idx}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 20,
                                  background: "#f1f5f9",
                                  color: "#64748b",
                                  fontSize: 13,
                                  fontWeight: 500
                                }}
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Key Requirements */}
                      {jobQ.data.job.jobKeywords && (
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 12 }}>Key Requirements</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            {/* Skills */}
                            {jobQ.data.job.jobKeywords.skills && jobQ.data.job.jobKeywords.skills.length > 0 && (
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                  <span style={{ fontSize: 16 }}>👤</span>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Skills</span>
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {jobQ.data.job.jobKeywords.skills.slice(0, 6).map((skill, idx) => (
                                    <span
                                      key={idx}
                                      style={{
                                        padding: "4px 10px",
                                        borderRadius: 12,
                                        background: "#f1f5f9",
                                        color: "#475569",
                                        fontSize: 12,
                                        fontWeight: 500
                                      }}
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Tools */}
                            {jobQ.data.job.jobKeywords.tools && jobQ.data.job.jobKeywords.tools.length > 0 && (
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                  <span style={{ fontSize: 16 }}>🔧</span>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Tools</span>
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {jobQ.data.job.jobKeywords.tools.slice(0, 6).map((tool, idx) => (
                                    <span
                                      key={idx}
                                      style={{
                                        padding: "4px 10px",
                                        borderRadius: 12,
                                        background: "#f1f5f9",
                                        color: "#475569",
                                        fontSize: 12,
                                        fontWeight: 500
                                      }}
                                    >
                                      {tool}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Domains */}
                            {jobQ.data.job.jobKeywords.domain && jobQ.data.job.jobKeywords.domain.length > 0 && (
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                  <span style={{ fontSize: 16 }}>〈〉</span>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Domains</span>
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {jobQ.data.job.jobKeywords.domain.slice(0, 6).map((domain, idx) => (
                                    <span
                                      key={idx}
                                      style={{
                                        padding: "4px 10px",
                                        borderRadius: 12,
                                        background: "#f1f5f9",
                                        color: "#475569",
                                        fontSize: 12,
                                        fontWeight: 500
                                      }}
                                    >
                                      {domain}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Company Culture */}
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>Company Culture</h2>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, background: "#fff" }}>
                    <p style={{ fontSize: 15, lineHeight: 1.6, color: "#475569", marginBottom: 16 }}>
                      We're a fast-growing tech company that values innovation, collaboration, and work-life balance. Our culture is built on trust, transparency, and continuous learning.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>Core Values</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {["Innovation", "Collaboration", "Impact"].map((value, idx) => (
                            <span
                              key={idx}
                              style={{
                                padding: "4px 12px",
                                borderRadius: 16,
                                background: "#eef2ff",
                                color: "#3730a3",
                                fontSize: 13,
                                fontWeight: 500
                              }}
                            >
                              {value}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>Team Size</div>
                        <div style={{ fontSize: 14, color: "#475569" }}>250+ employees, 12-person product team</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>Work Style</div>
                        <div style={{ fontSize: 14, color: "#475569" }}>Agile, autonomous teams with flexible hours</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>Diversity</div>
                        <div style={{ fontSize: 14, color: "#475569" }}>45% women in leadership, 60 countries</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Meet Your Team */}
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>Meet Your Team</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {[
                      {
                        name: "Sarah Chen",
                        title: "Product Lead",
                        background: "Stanford CS '15, Ex-Google",
                        personality: "ENTJ - Strategic thinker",
                        hobbies: "Rock Climbing, Coffee, Photography",
                        sameSchool: "Stanford University"
                      },
                      {
                        name: "Michael Park",
                        title: "Senior Engineer",
                        background: "MIT '17, Tech Lead",
                        personality: "INTP - Problem solver",
                        hobbies: "Gaming, Hiking, Chess"
                      },
                      {
                        name: "Emily Rodriguez",
                        title: "UX Designer",
                        background: "RISD '16, Design Systems",
                        personality: "ENFP - Creative collaborator",
                        hobbies: "Music, Coffee, Art"
                      },
                      {
                        name: "David Kim",
                        title: "Data Scientist",
                        background: "Stanford Stats '14",
                        personality: "ISTJ - Analytical mind",
                        hobbies: "Basketball, Reading, Cooking",
                        sameSchool: "Stanford University"
                      }
                    ].map((member, idx) => (
                      <div key={idx} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, background: "#fff" }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <div
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: "50%",
                              background: `linear-gradient(135deg, #${["667eea", "764ba2", "f093fb", "4facfe"][idx]} 0%, #${["764ba2", "f093fb", "4facfe", "00f2fe"][idx]} 100%)`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontSize: 18,
                              fontWeight: 700,
                              flexShrink: 0
                            }}
                          >
                            {member.name.charAt(0)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>{member.name}</div>
                            <div style={{ fontSize: 14, color: "#64748b", marginBottom: 8 }}>{member.title}</div>
                            <div style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}>{member.background}</div>
                            <div style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}>{member.personality}</div>
                            <div style={{ fontSize: 13, color: "#64748b", marginBottom: member.sameSchool ? 4 : 0 }}>
                              Hobbies: {member.hobbies}
                            </div>
                            {member.sameSchool && (
                              <div style={{ fontSize: 12, color: "#2563eb", fontWeight: 500, marginTop: 4 }}>
                                Same school: {member.sameSchool}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Your Team Position */}
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>Your Team Position</h2>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, background: "#fff" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>Strategic Leader</div>
                        <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
                          You'll bridge product vision with technical execution, working closely with Sarah and Michael.
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>Collaboration Style</div>
                        <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
                          Your analytical approach complements the team's creative energy - perfect balance!
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>Growth Opportunities</div>
                        <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
                          Direct mentorship from Sarah (Stanford alum) and ownership of key product initiatives.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Salary Position */}
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>Salary Position</h2>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, background: "#fff" }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>
                      $175,000
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#64748b", marginLeft: 8 }}>Your Salary (Mid-range)</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>vs. SF Average</span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#22c55e" }}>+23%</span>
                        </div>
                        <div style={{ position: "relative", height: 24, background: "#f1f5f9", borderRadius: 12, overflow: "hidden" }}>
                          <div style={{ width: "100%", height: "100%", background: "#e2e8f0", position: "absolute" }} />
                          <div style={{ width: "73%", height: "100%", background: "#22c55e", position: "absolute" }} />
                          <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, fontWeight: 600, color: "#166534" }}>
                            City avg: $142,000
                          </div>
                        </div>
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>vs. Industry Average</span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#2563eb" }}>+11%</span>
                        </div>
                        <div style={{ position: "relative", height: 24, background: "#f1f5f9", borderRadius: 12, overflow: "hidden" }}>
                          <div style={{ width: "100%", height: "100%", background: "#e2e8f0", position: "absolute" }} />
                          <div style={{ width: "89%", height: "100%", background: "#2563eb", position: "absolute" }} />
                          <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, fontWeight: 600, color: "#1e40af" }}>
                            Industry avg: $158,000
                          </div>
                        </div>
                      </div>
                      <div style={{ padding: 12, background: "#eef2ff", borderRadius: 8, border: "1px solid #c7d2fe" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#3730a3", marginBottom: 4 }}>Top 22% Earner</div>
                        <div style={{ fontSize: 13, color: "#3730a3", lineHeight: 1.5 }}>
                          You're in the 78th percentile for your role in San Francisco
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "future" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.6fr) 380px",
                gap: 20,
                alignItems: "flex-start"
              }}
            >
              {/* Left Panel: Header card + Future content card */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Job Header Card */}
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: 24,
                    padding: 24,
                    boxShadow: "0 16px 32px rgba(15,23,42,0.12)",
                    border: "1px solid rgba(226,232,240,0.95)",
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-start"
                  }}
                >
                  <CompanyLogo 
                    companyName={jobQ.data.job.company} 
                    logoUrl={jobQ.data.job.companyLogoUrl}
                    size={80}
                  />
                  <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px 0", color: "#0f172a" }}>
                      {jobQ.data.job.title}
                    </h1>
                    <div style={{ fontSize: 18, color: "#475569", fontWeight: 500, marginBottom: 16 }}>
                      {jobQ.data.job.company}
                    </div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 14, color: "#64748b" }}>
                      <div>📍 {jobQ.data.job.location || "—"}</div>
                      <div>💼 {jobQ.data.job.jobType || "Full time"}</div>
                      <div>💰 $10K/Month</div>
                      <div>
                        📅{" "}
                        {jobQ.data.job.postedAt
                          ? new Date(jobQ.data.job.postedAt)
                              .toLocaleDateString("en-US", { year: "numeric", month: "numeric", day: "numeric" })
                              .replace(/\//g, ".")
                          : "—"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => {
                        const url = jobQ.data?.job.applyUrl || jobQ.data?.job.externalUrl;
                        if (url) window.open(url, "_blank", "noopener,noreferrer");
                        setConfirmOpen(true);
                      }}
                      disabled={applyMut.isPending || jobQ.isLoading}
                      style={{
                        padding: "12px 20px",
                        borderRadius: 999,
                        border: 0,
                        background: "#2563eb",
                        color: "#fff",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8
                      }}
                    >
                      {applyMut.isPending ? "Applying..." : "Apply →"}
                    </button>
                    <button
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({
                            title: jobQ.data.job.title,
                            text: `Check out this job: ${jobQ.data.job.title} at ${jobQ.data.job.company}`,
                            url: window.location.href
                          });
                        }
                      }}
                      style={{
                        padding: "12px",
                        borderRadius: 999,
                        border: "1px solid #e2e8f0",
                        background: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                      title="Share"
                    >
                      <span style={{ fontSize: 18 }}>📄</span>
                    </button>
                    <button
                      onClick={() => {
                        if (!jobQ.data) return;
                        const isFavorite = jobQ.data.job.isFavorite || false;
                        favoriteMut.mutate(!isFavorite);
                      }}
                      disabled={favoriteMut.isPending || jobQ.isLoading}
                      style={{
                        padding: "12px",
                        borderRadius: 999,
                        border: "1px solid #e2e8f0",
                        background: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                      title={jobQ.data?.job.isFavorite ? "Unfavorite" : "Favorite"}
                    >
                      <span style={{ fontSize: 18, color: jobQ.data?.job.isFavorite ? "#fbbf24" : "#64748b" }}>
                        {jobQ.data?.job.isFavorite ? "★" : "☆"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Future Content Card */}
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: 24,
                    padding: 24,
                    boxShadow: "0 20px 40px rgba(15,23,42,0.18)",
                    border: "1px solid rgba(226,232,240,0.95)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 24
                  }}
                >
                  {/* Skills You'll Gain */}
                  <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "#0f172a" }}>Skills You'll Gain</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {[
                      { skill: "Product Strategy", now: 70, future: 95 },
                      { skill: "Leadership", now: 65, future: 90 },
                      { skill: "AI/ML Knowledge", now: 50, future: 85 },
                      { skill: "Data Analysis", now: 75, future: 92 },
                      { skill: "Market Research", now: 68, future: 88 }
                    ].map((item, idx) => (
                      <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{item.skill}</span>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: "#64748b" }}>
                            <span>Now: {item.now}%</span>
                            <span>→</span>
                            <span style={{ color: "#2563eb", fontWeight: 600 }}>{item.future}%</span>
                          </div>
                        </div>
                        <div style={{ position: "relative", height: 32, background: "#f1f5f9", borderRadius: 8, overflow: "hidden" }}>
                          <div style={{ position: "absolute", left: 0, top: 0, width: `${item.now}%`, height: "100%", background: "#cbd5e1" }} />
                          <div style={{ position: "absolute", left: 0, top: 0, width: `${item.future}%`, height: "100%", background: "#2563eb", opacity: 0.6 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                    {[
                      { icon: "Ω", title: "AI/ML Expertise", desc: "Cutting-edge tech" },
                      { icon: "👥", title: "Leadership", desc: "Team management" },
                      { icon: "📊", title: "Data Strategy", desc: "Analytics depth" }
                    ].map((item, idx) => (
                      <div key={idx} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, background: "#fff", textAlign: "center" }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>{item.icon}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>{item.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Salary Growth Projection */}
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "#0f172a" }}>Salary Growth Projection</h2>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 20, background: "#fff" }}>
                    {/* Simple line chart representation */}
                    <div style={{ height: 200, position: "relative", marginBottom: 20 }}>
                      <svg width="100%" height="200" style={{ overflow: "visible" }}>
                        <defs>
                          <linearGradient id="salaryGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {/* Y-axis labels */}
                        {[0, 50, 100, 150, 200, 250, 300].map((val, idx) => (
                          <text key={idx} x="0" y={200 - (val / 300) * 180} fontSize="12" fill="#64748b">
                            ${val}k
                          </text>
                        ))}
                        {/* Line */}
                        <polyline
                          points="40,140 100,130 160,115 220,100 280,85 340,70"
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth="3"
                        />
                        {/* Area under curve */}
                        <polygon
                          points="40,140 40,200 100,130 160,115 220,100 280,85 340,70 340,200"
                          fill="url(#salaryGradient)"
                        />
                        {/* X-axis labels */}
                        {["Now", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5"].map((label, idx) => (
                          <text key={idx} x={40 + idx * 60} y={195} fontSize="12" fill="#64748b" textAnchor="middle">
                            {label}
                          </text>
                        ))}
                      </svg>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                      <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#f8fafc" }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>$281k</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>5-Year Projection</div>
                        <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 600, marginTop: 4 }}>+61% growth</div>
                      </div>
                      <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#f8fafc" }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>$232k</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>3-Year Milestone</div>
                        <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 600, marginTop: 4 }}>+33% growth</div>
                      </div>
                      <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#f8fafc" }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>+43%</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>Above Market</div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>at Year 5</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Growth Resources Investment */}
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "#0f172a" }}>Growth Resources Investment</h2>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 20, background: "#fff" }}>
                    {/* Radar chart representation */}
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                      <div style={{ width: 300, height: 300, position: "relative" }}>
                        <svg width="300" height="300" viewBox="0 0 300 300">
                          <circle cx="150" cy="150" r="120" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                          <circle cx="150" cy="150" r="90" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                          <circle cx="150" cy="150" r="60" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                          <circle cx="150" cy="150" r="30" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                          {/* Axes */}
                          {[
                            { label: "Learning Budget", angle: 0 },
                            { label: "Mentorship", angle: 72 },
                            { label: "Innovation Time", angle: 144 },
                            { label: "Conference Access", angle: 216 },
                            { label: "Skill Workshops", angle: 288 }
                          ].map((axis, idx) => {
                            const rad = (axis.angle * Math.PI) / 180;
                            const x = 150 + 120 * Math.sin(rad);
                            const y = 150 - 120 * Math.cos(rad);
                            return (
                              <g key={idx}>
                                <line x1="150" y1="150" x2={x} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                                <text x={x + (x > 150 ? 10 : -10)} y={y + (y > 150 ? 15 : -5)} fontSize="11" fill="#64748b" textAnchor={x > 150 ? "start" : "end"}>
                                  {axis.label}
                                </text>
                              </g>
                            );
                          })}
                          {/* Data polygon */}
                          <polygon
                            points="150,30 210,90 240,150 210,210 150,240 90,210 60,150 90,90"
                            fill="#2563eb"
                            fillOpacity="0.3"
                            stroke="#2563eb"
                            strokeWidth="2"
                          />
                        </svg>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {[
                        { label: "Learning Budget", value: 85, desc: "$5k annual budget for courses & certifications" },
                        { label: "Mentorship", value: 90, desc: "1-on-1 with VP and C-suite leaders" },
                        { label: "Innovation Time", value: 75, desc: "20% time for personal projects" },
                        { label: "Conference Access", value: 80, desc: "Unlimited access to industry events" },
                        { label: "Skill Workshops", value: 88, desc: "Weekly internal workshops & training" }
                      ].map((item, idx) => (
                        <div key={idx}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{item.label}</span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#2563eb" }}>{item.value}%</span>
                          </div>
                          <div style={{ position: "relative", height: 24, background: "#f1f5f9", borderRadius: 12, overflow: "hidden", marginBottom: 4 }}>
                            <div style={{ width: `${item.value}%`, height: "100%", background: "#2563eb" }} />
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>{item.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Career Path Opportunities */}
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "#0f172a" }}>Career Path Opportunities</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {[
                      { title: "VP of Product", timeline: "3-4 years", probability: 78, rating: "High", skills: ["Strategic Leadership", "Executive Communication", "P&L Management"] },
                      { title: "Director of AI Products", timeline: "2-3 years", probability: 65, rating: "Medium", skills: ["AI/ML Expertise", "Technical Leadership", "Innovation Management"] },
                      { title: "Chief Product Officer", timeline: "5-7 years", probability: 58, rating: "Medium", skills: ["C-Suite Leadership", "Business Strategy", "Organization Building"] },
                      { title: "Product Consultant", timeline: "2+ years", probability: 82, rating: "High", skills: ["Advisory Skills", "Industry Expertise", "Client Management"] }
                    ].map((path, idx) => (
                      <div key={idx} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, background: "#fff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>{path.title}</div>
                            <div style={{ fontSize: 13, color: "#64748b" }}>Timeline: {path.timeline}</div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                            <span style={{ padding: "4px 8px", borderRadius: 12, background: path.rating === "High" ? "#dcfce7" : "#fef3c7", color: path.rating === "High" ? "#166534" : "#92400e", fontSize: 11, fontWeight: 600 }}>
                              {path.rating}
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#2563eb" }}>{path.probability}%</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>Key Skills Needed:</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {path.skills.map((skill, skillIdx) => (
                            <span key={skillIdx} style={{ padding: "4px 10px", borderRadius: 12, background: "#f1f5f9", color: "#475569", fontSize: 12 }}>
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                </div>
              </div>

              {/* Right Panel: Future Content */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Company Growth */}
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "#0f172a" }}>Company Growth</h2>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, background: "#fff" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>Revenue Growth</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "#22c55e" }}>+147%</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>YoY</div>
                      <div style={{ height: 1, background: "#e2e8f0" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>Team Expansion</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "#22c55e" }}>+85%</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>Last 12mo</div>
                      <div style={{ height: 1, background: "#e2e8f0" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>Market Share</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "#2563eb" }}>#3</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>in sector</div>
                      <div style={{ height: 1, background: "#e2e8f0" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>Funding Round</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "#2563eb" }}>Series C</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>($120M)</div>
                    </div>
                  </div>
                </div>

                {/* Industry Impact */}
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "#0f172a" }}>Industry Impact</h2>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, background: "#fff" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>Cutting-Edge Tech</div>
                        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
                          Working with latest AI/ML technologies that are shaping the future of SaaS
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>Industry Recognition</div>
                        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
                          Company featured in TechCrunch, Forbes, and named "Best Place to Work 2024"
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>Global Reach</div>
                        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
                          Expanding to APAC and EMEA markets - international exposure and growth opportunities
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Potential Conflicts */}
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "#0f172a" }}>Potential Conflicts</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {[
                      { 
                        title: "Early Morning Meetings", 
                        severity: "Medium", 
                        conflict: "Based on your profile preferring late-start schedules (10am+), this role requires 9am daily standups. Team is distributed across EST timezone.",
                        mitigation: "Consider negotiating flexible start times or asynchronous standups with your manager during onboarding."
                      },
                      { 
                        title: "High Extroversion Environment", 
                        severity: "Low", 
                        conflict: "Your ISFJ profile indicates preference for deep work. Team culture emphasizes frequent social events and open collaboration spaces (80% of time).",
                        mitigation: "Request dedicated quiet hours or work-from-home days. Many introverts thrive here with boundaries."
                      },
                      { 
                        title: "Fast-Paced Risk-Taking Culture", 
                        severity: "High", 
                        conflict: "Your work history shows preference for stability and thorough planning. Company values 'move fast and break things' mentality with 2-week sprint cycles.",
                        mitigation: "This is a growth opportunity but may cause stress initially. Request mentorship and start with smaller scope projects."
                      },
                      { 
                        title: "On-Call Rotation Expected", 
                        severity: "Medium", 
                        conflict: "Role includes quarterly on-call duties (1 week/month). Your profile indicates strong work-life boundaries and family commitments after 6pm.",
                        mitigation: "Discuss on-call expectations upfront. Many parents negotiate specific hours or swap weeks with teammates."
                      },
                      { 
                        title: "Async-First Communication", 
                        severity: "Low", 
                        conflict: "Your background shows preference for face-to-face meetings. Company culture is heavily async (Slack/Notion) with minimal synchronous meetings.",
                        mitigation: "This actually reduces meeting fatigue. Embrace written communication - it's a valuable skill for remote work."
                      }
                    ].map((item, idx) => (
                      <div key={idx} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, background: "#fff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{item.title}</div>
                          <span style={{ 
                            padding: "4px 8px", 
                            borderRadius: 12, 
                            background: item.severity === "High" ? "#fee2e2" : item.severity === "Medium" ? "#fef3c7" : "#dcfce7",
                            color: item.severity === "High" ? "#991b1b" : item.severity === "Medium" ? "#92400e" : "#166534",
                            fontSize: 11, 
                            fontWeight: 600 
                          }}>
                            {item.severity}
                          </span>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>Conflict:</div>
                          <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{item.conflict}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>Mitigation:</div>
                          <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{item.mitigation}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {confirmOpen && jobQ.data && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50
          }}
          role="dialog"
          aria-modal="true"
        >
          <div style={{ width: "min(520px, 100%)", background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Confirm application</div>
            <div style={{ marginTop: 8, color: "#475569", lineHeight: 1.4 }}>
              Did you apply to <b>{jobQ.data.job.title}</b> at <b>{jobQ.data.job.company}</b>?
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmOpen(false)}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 900 }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  applyMut.mutate();
                }}
                disabled={applyMut.isPending}
                style={{ padding: "10px 12px", borderRadius: 10, border: 0, background: "#0b1220", color: "#fff", fontWeight: 900 }}
              >
                I applied
              </button>
            </div>
          </div>
        </div>
      )}

      {toastOpen && (
        <div
          style={{
            position: "fixed",
            right: 18,
            bottom: 18,
            background: "#0b1220",
            color: "#fff",
            borderRadius: 14,
            padding: 14,
            width: 320,
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)"
          }}
          role="status"
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Application created</div>
          <div style={{ opacity: 0.85, fontSize: 13, marginBottom: 10 }}>You can manage it in Tracker.</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => router.push("/tracker")}
              style={{ padding: "8px 10px", borderRadius: 10, border: 0, background: "#2563eb", color: "#fff", fontWeight: 900 }}
            >
              Go to Tracker
            </button>
            <button
              onClick={() => setToastOpen(false)}
              style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #334155", background: "transparent", color: "#fff", fontWeight: 900 }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

