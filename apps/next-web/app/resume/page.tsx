"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import type { ResumeParseResponse } from "@/lib/types";
import {
  clearResumeDraft,
  draftToText,
  getResumeDraft,
  getUseResumeDraftForMatching,
  setResumeDraft,
  setUseResumeDraftForMatching,
  type ResumeDraftData
} from "@/lib/resumeDraft";

// Parse resume text into structured sections
function parseResumeText(text: string): {
  personalInfo: string[];
  education: string[];
  experience: string[];
  skills: string[];
  projects: string[];
  other: string[];
} {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const sections: {
    personalInfo: string[];
    education: string[];
    experience: string[];
    skills: string[];
    projects: string[];
    other: string[];
  } = {
    personalInfo: [],
    education: [],
    experience: [],
    skills: [],
    projects: [],
    other: []
  };

  let currentSection: keyof typeof sections | null = null;
  const sectionKeywords: Record<string, keyof typeof sections> = {
    personal: "personalInfo",
    contact: "personalInfo",
    email: "personalInfo",
    phone: "personalInfo",
    address: "personalInfo",
    education: "education",
    edu: "education",
    degree: "education",
    university: "education",
    school: "education",
    experience: "experience",
    work: "experience",
    employment: "experience",
    career: "experience",
    position: "experience",
    job: "experience",
    skills: "skills",
    skill: "skills",
    technical: "skills",
    competencies: "skills",
    projects: "projects",
    project: "projects",
    portfolio: "projects",
    other: "other",
    summary: "other",
    objective: "other",
    achievements: "other",
    awards: "other",
    certifications: "other"
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    let matched = false;

    for (const [keyword, section] of Object.entries(sectionKeywords)) {
      if (line.includes(keyword) && line.length < 50) {
        currentSection = section;
        matched = true;
        break;
      }
    }

    if (!matched && currentSection) {
      sections[currentSection].push(lines[i]);
    } else if (!matched && i < 5) {
      // First few lines likely personal info
      sections.personalInfo.push(lines[i]);
    } else if (!matched) {
      sections.other.push(lines[i]);
    }
  }

  return sections;
}

export default function ResumePage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ResumeDraftData>(() => getResumeDraft());
  const [useDraft, setUseDraft] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [parsed, setParsed] = useState<ResumeParseResponse | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ["resumes"],
    queryFn: async () => api.listResumes()
  });

  const detailQ = useQuery({
    queryKey: ["resume-detail", selectedResumeId],
    queryFn: async () => {
      if (!selectedResumeId) return null;
      return api.getResumeDetail(selectedResumeId);
    },
    enabled: !!selectedResumeId
  });

  // 自动显示关键词（如果详情中有）
  useEffect(() => {
    if (detailQ.data?.keywords && !parsed) {
      // 如果有关键词但还没有显示，自动设置
      setParsed({
        resumeId: selectedResumeId || "",
        keywords: detailQ.data.keywords,
        updatedAt: new Date().toISOString()
      });
    }
  }, [detailQ.data?.keywords, selectedResumeId, parsed]);

  useEffect(() => {
    setDraft(getResumeDraft());
    setUseDraft(getUseResumeDraftForMatching());
  }, []);

  const uploadMut = useMutation({
    mutationFn: async (file: File) => api.uploadResume(file),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["resumes"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
    }
  });

  const setDefaultMut = useMutation({
    mutationFn: async (resumeId: string) => api.patchResume(resumeId, { setAsDefault: true }),
    onMutate: (id) => setBusyId(id),
    onSettled: () => setBusyId(null),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["resumes"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
    }
  });

  const parseMut = useMutation({
    mutationFn: async (resumeId: string) => api.parseResume(resumeId),
    onMutate: (id) => setBusyId(id),
    onSettled: () => setBusyId(null),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      setParsed(res);
    }
  });

  const deleteMut = useMutation({
    mutationFn: async (resumeId: string) => {
      await api.deleteResume(resumeId);
      return resumeId;
    },
    onMutate: (id) => setBusyId(id),
    onSettled: () => setBusyId(null),
    onSuccess: async (deletedId) => {
      await qc.invalidateQueries({ queryKey: ["resumes"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
      if (selectedResumeId === deletedId) {
        setSelectedResumeId(null);
      }
    }
  });

  function onPickFile() {
    fileRef.current?.click();
  }

  async function onFileChange() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    uploadMut.mutate(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  const draftStats = useMemo(() => {
    const text = draftToText(draft);
    const chars = text.length;
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const ready = chars >= 500 && (draft.experience.length > 0 || draft.education.length > 0);
    return { chars, words, ready };
  }, [draft]);

  const parsedSections = useMemo(() => {
    if (!detailQ.data?.textContent) return null;
    return parseResumeText(detailQ.data.textContent);
  }, [detailQ.data?.textContent]);

  return (
    <AppShell>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8, color: "#0f172a" }}>Resume Management</h1>
        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>
          Upload and manage your resumes. View parsed content and extracted keywords for better job matching.
        </p>

        {/* Upload Section */}
        <div
          style={{
            border: "2px dashed #cbd5e1",
            borderRadius: 16,
            padding: 32,
            textAlign: "center",
            background: "#f8fafc",
            marginBottom: 32
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={onFileChange}
            style={{ display: "none" }}
          />
          <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
          <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 8, color: "#0f172a" }}>Upload Resume</h2>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
            Support PDF and DOCX formats. Maximum file size: 10MB
          </p>
          <button
            onClick={onPickFile}
            disabled={uploadMut.isPending}
            style={{
              padding: "12px 24px",
              borderRadius: 8,
              background: "#2563eb",
              color: "white",
              border: "none",
              fontWeight: 800,
              cursor: uploadMut.isPending ? "not-allowed" : "pointer",
              opacity: uploadMut.isPending ? 0.6 : 1
            }}
          >
            {uploadMut.isPending ? "Uploading..." : "Choose File"}
          </button>
          {uploadMut.error && (
            <p style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>
              {uploadMut.error instanceof ApiError ? `${uploadMut.error.code}: ${uploadMut.error.message}` : "Upload failed"}
            </p>
          )}
        </div>

        {/* Resume List */}
        {listQ.isLoading && (
          <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>Loading resumes...</div>
        )}
        {listQ.error && (
          <div style={{ padding: 16, background: "#fee2e2", borderRadius: 8, color: "#b91c1c", marginBottom: 24 }}>
            {listQ.error instanceof ApiError ? `${listQ.error.code}: ${listQ.error.message}` : "Failed to load resumes"}
          </div>
        )}

        {listQ.data && listQ.data.resumes.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 16, color: "#0f172a" }}>Your Resumes</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {listQ.data.resumes.map((r) => (
                <div
                  key={r.id}
                  style={{
                    border: selectedResumeId === r.id ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    background: selectedResumeId === r.id ? "#eff6ff" : "#fff",
                    padding: 16,
                    borderRadius: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onClick={() => setSelectedResumeId(r.id === selectedResumeId ? null : r.id)}
                >
                  <div style={{ flex: "1 1 200px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 900, fontSize: 16, color: "#0f172a" }}>{r.fileName}</span>
                      {r.isDefault && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "#dcfce7",
                            color: "#166534",
                            fontWeight: 800
                          }}
                        >
                          Default
                        </span>
                      )}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>Uploaded {new Date(r.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        parseMut.mutate(r.id);
                      }}
                      disabled={busyId === r.id}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: "white",
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: busyId === r.id ? "not-allowed" : "pointer",
                        opacity: busyId === r.id ? 0.6 : 1
                      }}
                    >
                      {busyId === r.id ? "Parsing..." : "Parse Keywords"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDefaultMut.mutate(r.id);
                      }}
                      disabled={busyId === r.id || r.isDefault}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: "white",
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: busyId === r.id || r.isDefault ? "not-allowed" : "pointer",
                        opacity: busyId === r.id || r.isDefault ? 0.6 : 1
                      }}
                    >
                      Set Default
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete "${r.fileName}"?`)) {
                          deleteMut.mutate(r.id);
                        }
                      }}
                      disabled={busyId === r.id || undefined}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid #fee2e2",
                        background: "#fee2e2",
                        color: "#b91c1c",
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: busyId === r.id ? "not-allowed" : "pointer",
                        opacity: busyId === r.id ? 0.6 : 1
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Parsed Content Display */}
        {selectedResumeId && detailQ.data && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 16, color: "#0f172a" }}>Resume Content</h2>
            {detailQ.isLoading && <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>Loading content...</div>}
            {detailQ.error && (
              <div style={{ padding: 16, background: "#fee2e2", borderRadius: 8, color: "#b91c1c" }}>
                {detailQ.error instanceof ApiError ? `${detailQ.error.code}: ${detailQ.error.message}` : "Failed to load content"}
              </div>
            )}
            {parsedSections && detailQ.data.textContent && (
              <div style={{ display: "grid", gap: 20 }}>
                {parsedSections.personalInfo.length > 0 && (
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, background: "#fff" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 900, marginBottom: 12, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20 }}>👤</span> Personal Information
                    </h3>
                    <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.8 }}>
                      {parsedSections.personalInfo.map((line, idx) => (
                        <div key={`personal-${idx}`}>{line}</div>
                      ))}
                    </div>
                  </div>
                )}

                {parsedSections.experience.length > 0 && (
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, background: "#fff" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 900, marginBottom: 12, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20 }}>💼</span> Work Experience
                    </h3>
                    <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.8 }}>
                      {parsedSections.experience.map((line, idx) => (
                        <div key={`exp-${idx}`} style={{ marginBottom: idx < parsedSections.experience.length - 1 ? 8 : 0 }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {parsedSections.education.length > 0 && (
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, background: "#fff" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 900, marginBottom: 12, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20 }}>🎓</span> Education
                    </h3>
                    <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.8 }}>
                      {parsedSections.education.map((line, idx) => (
                        <div key={`edu-${idx}`} style={{ marginBottom: idx < parsedSections.education.length - 1 ? 8 : 0 }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {parsedSections.skills.length > 0 && (
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, background: "#fff" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 900, marginBottom: 12, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20 }}>🛠️</span> Skills
                    </h3>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {parsedSections.skills.map((skill, idx) => (
                        <span
                          key={`skill-${idx}`}
                          style={{
                            fontSize: 13,
                            padding: "6px 12px",
                            borderRadius: 6,
                            background: "#eff6ff",
                            border: "1px solid #bfdbfe",
                            color: "#1e40af",
                            fontWeight: 800
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {parsedSections.projects.length > 0 && (
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, background: "#fff" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 900, marginBottom: 12, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20 }}>🚀</span> Projects
                    </h3>
                    <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.8 }}>
                      {parsedSections.projects.map((line, idx) => (
                        <div key={`proj-${idx}`} style={{ marginBottom: idx < parsedSections.projects.length - 1 ? 8 : 0 }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {parsedSections.other.length > 0 && (
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, background: "#fff" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 900, marginBottom: 12, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20 }}>📋</span> Additional Information
                    </h3>
                    <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.8 }}>
                      {parsedSections.other.map((line, idx) => (
                        <div key={`other-${idx}`} style={{ marginBottom: idx < parsedSections.other.length - 1 ? 8 : 0 }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {!parsedSections && detailQ.data.textContent && (
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, background: "#fff" }}>
                <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                  {detailQ.data.textContent}
                </div>
              </div>
            )}
            {!detailQ.data.textContent && (
              <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                No text content available for this resume.
              </div>
            )}
          </div>
        )}

        {/* Extracted Keywords */}
        {parsed && (
          <div style={{ marginBottom: 32, border: "1px solid #dbeafe", background: "#eff6ff", padding: 20, borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 16 }}>
              <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>Extracted Keywords</div>
              <div style={{ color: "#64748b", fontSize: 12 }}>Updated {new Date(parsed.updatedAt).toLocaleString()}</div>
            </div>
            <div style={{ color: "#475569", fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
              These keywords are automatically extracted from your resume and used to compute job match scores.
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              {(["skills", "tools", "titles", "domain", "methods"] as const).map((g) => (
                <div key={`k-${g}`}>
                  <div style={{ fontSize: 13, color: "#475569", fontWeight: 900, textTransform: "capitalize", marginBottom: 8 }}>
                    {g}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(parsed.keywords?.[g] || []).slice(0, 30).map((k: string, idx: number) => (
                      <span
                        key={`kw-${g}-${k}-${idx}`}
                        style={{
                          fontSize: 12,
                          padding: "5px 12px",
                          borderRadius: 6,
                          background: "#ffffff",
                          border: "1px solid #bfdbfe",
                          color: "#1e40af",
                          fontWeight: 800
                        }}
                      >
                        {k}
                      </span>
                    ))}
                    {(parsed.keywords?.[g] || []).length === 0 && (
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resume Draft Section */}
        <div style={{ marginTop: 32, borderTop: "2px solid #e2e8f0", paddingTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 4, color: "#0f172a" }}>Resume Draft (Editable)</h2>
              <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>
                Build your resume with structured fields. If enabled, Job Match will use it for matching.
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={useDraft}
                  onChange={(e) => {
                    setUseDraft(e.target.checked);
                    setUseResumeDraftForMatching(e.target.checked);
                  }}
                  style={{ cursor: "pointer" }}
                />
                Use for Job Match
              </label>
              <div style={{ color: "#64748b", fontSize: 12 }}>
                {draftStats.words} words · {draftStats.chars} chars · {draftStats.ready ? "✅ ready" : "⚠️ add more"}
              </div>
              {savedAt && (
                <div style={{ color: "#64748b", fontSize: 12 }}>Saved {new Date(savedAt).toLocaleString()}</div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gap: 24 }}>
            {/* Personal Information */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, background: "#fff" }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, marginBottom: 16, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>👤</span> Personal Information
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>Name</label>
                  <input
                    type="text"
                    value={draft.personalInfo.name || ""}
                    onChange={(e) => setDraft({ ...draft, personalInfo: { ...draft.personalInfo, name: e.target.value } })}
                    placeholder="Full name"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>Email</label>
                  <input
                    type="email"
                    value={draft.personalInfo.email || ""}
                    onChange={(e) => setDraft({ ...draft, personalInfo: { ...draft.personalInfo, email: e.target.value } })}
                    placeholder="email@example.com"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>Phone</label>
                  <input
                    type="tel"
                    value={draft.personalInfo.phone || ""}
                    onChange={(e) => setDraft({ ...draft, personalInfo: { ...draft.personalInfo, phone: e.target.value } })}
                    placeholder="+1 234 567 8900"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>Location</label>
                  <input
                    type="text"
                    value={draft.personalInfo.location || ""}
                    onChange={(e) => setDraft({ ...draft, personalInfo: { ...draft.personalInfo, location: e.target.value } })}
                    placeholder="City, Country"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>LinkedIn</label>
                  <input
                    type="url"
                    value={draft.personalInfo.linkedin || ""}
                    onChange={(e) => setDraft({ ...draft, personalInfo: { ...draft.personalInfo, linkedin: e.target.value } })}
                    placeholder="https://linkedin.com/in/..."
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>GitHub / Website</label>
                  <input
                    type="url"
                    value={draft.personalInfo.github || draft.personalInfo.website || ""}
                    onChange={(e) => setDraft({ ...draft, personalInfo: { ...draft.personalInfo, github: e.target.value, website: e.target.value } })}
                    placeholder="https://github.com/..."
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                  />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, background: "#fff" }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, marginBottom: 12, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>📝</span> Professional Summary
              </h3>
              <textarea
                value={draft.summary || ""}
                onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                placeholder="Brief summary of your professional background and key strengths..."
                style={{
                  width: "100%",
                  minHeight: 100,
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 14,
                  lineHeight: 1.6,
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
            </div>

            {/* Work Experience */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>💼</span> Work Experience
                </h3>
                <button
                  onClick={() => setDraft({ ...draft, experience: [...draft.experience, { company: "", position: "", startDate: "", endDate: "", current: false, description: "" }] })}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #2563eb",
                    background: "#eff6ff",
                    color: "#2563eb",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: "pointer"
                  }}
                >
                  + Add Experience
                </button>
              </div>
              {draft.experience.length === 0 && (
                <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 20 }}>No work experience added yet</div>
              )}
              {draft.experience.map((exp, idx) => (
                <div key={`exp-${idx}`} style={{ marginBottom: idx < draft.experience.length - 1 ? 20 : 0, padding: 16, background: "#f8fafc", borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>Experience #{idx + 1}</div>
                    <button
                      onClick={() => setDraft({ ...draft, experience: draft.experience.filter((_, i) => i !== idx) })}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        border: "1px solid #fee2e2",
                        background: "#fee2e2",
                        color: "#b91c1c",
                        fontWeight: 800,
                        fontSize: 11,
                        cursor: "pointer"
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>Position</label>
                        <input
                          type="text"
                          value={exp.position}
                          onChange={(e) => {
                            const newExp = [...draft.experience];
                            newExp[idx].position = e.target.value;
                            setDraft({ ...draft, experience: newExp });
                          }}
                          placeholder="Software Engineer"
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>Company</label>
                        <input
                          type="text"
                          value={exp.company}
                          onChange={(e) => {
                            const newExp = [...draft.experience];
                            newExp[idx].company = e.target.value;
                            setDraft({ ...draft, experience: newExp });
                          }}
                          placeholder="Company Name"
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                        />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>Start Date</label>
                        <input
                          type="text"
                          value={exp.startDate}
                          onChange={(e) => {
                            const newExp = [...draft.experience];
                            newExp[idx].startDate = e.target.value;
                            setDraft({ ...draft, experience: newExp });
                          }}
                          placeholder="YYYY-MM or YYYY"
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>End Date</label>
                        <input
                          type="text"
                          value={exp.endDate || ""}
                          onChange={(e) => {
                            const newExp = [...draft.experience];
                            newExp[idx].endDate = e.target.value;
                            newExp[idx].current = false;
                            setDraft({ ...draft, experience: newExp });
                          }}
                          placeholder="YYYY-MM or Present"
                          disabled={exp.current}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14, opacity: exp.current ? 0.5 : 1 }}
                        />
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-end" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#475569", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={exp.current}
                            onChange={(e) => {
                              const newExp = [...draft.experience];
                              newExp[idx].current = e.target.checked;
                              if (e.target.checked) newExp[idx].endDate = "";
                              setDraft({ ...draft, experience: newExp });
                            }}
                            style={{ cursor: "pointer" }}
                          />
                          Current
                        </label>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>Description</label>
                      <textarea
                        value={exp.description}
                        onChange={(e) => {
                          const newExp = [...draft.experience];
                          newExp[idx].description = e.target.value;
                          setDraft({ ...draft, experience: newExp });
                        }}
                        placeholder="Describe your responsibilities and achievements..."
                        style={{
                          width: "100%",
                          minHeight: 80,
                          padding: 12,
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          fontSize: 14,
                          lineHeight: 1.6,
                          fontFamily: "inherit",
                          resize: "vertical"
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Education */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🎓</span> Education
                </h3>
                <button
                  onClick={() => setDraft({ ...draft, education: [...draft.education, { school: "", degree: "", major: "", startDate: "", endDate: "", gpa: "" }] })}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #2563eb",
                    background: "#eff6ff",
                    color: "#2563eb",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: "pointer"
                  }}
                >
                  + Add Education
                </button>
              </div>
              {draft.education.length === 0 && (
                <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 20 }}>No education added yet</div>
              )}
              {draft.education.map((edu, idx) => (
                <div key={`edu-${idx}`} style={{ marginBottom: idx < draft.education.length - 1 ? 20 : 0, padding: 16, background: "#f8fafc", borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>Education #{idx + 1}</div>
                    <button
                      onClick={() => setDraft({ ...draft, education: draft.education.filter((_, i) => i !== idx) })}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        border: "1px solid #fee2e2",
                        background: "#fee2e2",
                        color: "#b91c1c",
                        fontWeight: 800,
                        fontSize: 11,
                        cursor: "pointer"
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>Degree</label>
                        <input
                          type="text"
                          value={edu.degree}
                          onChange={(e) => {
                            const newEdu = [...draft.education];
                            newEdu[idx].degree = e.target.value;
                            setDraft({ ...draft, education: newEdu });
                          }}
                          placeholder="Bachelor's / Master's / PhD"
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>School</label>
                        <input
                          type="text"
                          value={edu.school}
                          onChange={(e) => {
                            const newEdu = [...draft.education];
                            newEdu[idx].school = e.target.value;
                            setDraft({ ...draft, education: newEdu });
                          }}
                          placeholder="University Name"
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                        />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>Major</label>
                        <input
                          type="text"
                          value={edu.major || ""}
                          onChange={(e) => {
                            const newEdu = [...draft.education];
                            newEdu[idx].major = e.target.value;
                            setDraft({ ...draft, education: newEdu });
                          }}
                          placeholder="Computer Science"
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>Start Date</label>
                        <input
                          type="text"
                          value={edu.startDate}
                          onChange={(e) => {
                            const newEdu = [...draft.education];
                            newEdu[idx].startDate = e.target.value;
                            setDraft({ ...draft, education: newEdu });
                          }}
                          placeholder="YYYY"
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>End Date / GPA</label>
                        <input
                          type="text"
                          value={edu.endDate || edu.gpa || ""}
                          onChange={(e) => {
                            const newEdu = [...draft.education];
                            if (e.target.value.match(/^\d+\.\d+$/)) {
                              newEdu[idx].gpa = e.target.value;
                            } else {
                              newEdu[idx].endDate = e.target.value;
                            }
                            setDraft({ ...draft, education: newEdu });
                          }}
                          placeholder="YYYY or GPA"
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Skills */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, background: "#fff" }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, marginBottom: 12, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>🛠️</span> Skills
              </h3>
              <div style={{ marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Type a skill and press Enter (e.g., JavaScript, Python, React)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.currentTarget.value.trim()) {
                      e.preventDefault();
                      setDraft({ ...draft, skills: [...draft.skills, e.currentTarget.value.trim()] });
                      e.currentTarget.value = "";
                    }
                  }}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {draft.skills.map((skill, idx) => (
                  <span
                    key={`skill-${idx}`}
                    style={{
                      fontSize: 13,
                      padding: "6px 12px",
                      borderRadius: 6,
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      color: "#1e40af",
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    {skill}
                    <button
                      onClick={() => setDraft({ ...draft, skills: draft.skills.filter((_, i) => i !== idx) })}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#1e40af",
                        cursor: "pointer",
                        fontSize: 16,
                        lineHeight: 1,
                        padding: 0,
                        marginLeft: 4
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {draft.skills.length === 0 && (
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>No skills added yet</span>
                )}
              </div>
            </div>

            {/* Projects */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🚀</span> Projects
                </h3>
                <button
                  onClick={() => setDraft({ ...draft, projects: [...draft.projects, { name: "", description: "", technologies: "", url: "" }] })}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #2563eb",
                    background: "#eff6ff",
                    color: "#2563eb",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: "pointer"
                  }}
                >
                  + Add Project
                </button>
              </div>
              {draft.projects.length === 0 && (
                <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 20 }}>No projects added yet</div>
              )}
              {draft.projects.map((proj, idx) => (
                <div key={`proj-${idx}`} style={{ marginBottom: idx < draft.projects.length - 1 ? 20 : 0, padding: 16, background: "#f8fafc", borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>Project #{idx + 1}</div>
                    <button
                      onClick={() => setDraft({ ...draft, projects: draft.projects.filter((_, i) => i !== idx) })}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        border: "1px solid #fee2e2",
                        background: "#fee2e2",
                        color: "#b91c1c",
                        fontWeight: 800,
                        fontSize: 11,
                        cursor: "pointer"
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>Project Name</label>
                        <input
                          type="text"
                          value={proj.name}
                          onChange={(e) => {
                            const newProj = [...draft.projects];
                            newProj[idx].name = e.target.value;
                            setDraft({ ...draft, projects: newProj });
                          }}
                          placeholder="Project Name"
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>URL (optional)</label>
                        <input
                          type="url"
                          value={proj.url || ""}
                          onChange={(e) => {
                            const newProj = [...draft.projects];
                            newProj[idx].url = e.target.value;
                            setDraft({ ...draft, projects: newProj });
                          }}
                          placeholder="https://..."
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>Description</label>
                      <textarea
                        value={proj.description}
                        onChange={(e) => {
                          const newProj = [...draft.projects];
                          newProj[idx].description = e.target.value;
                          setDraft({ ...draft, projects: newProj });
                        }}
                        placeholder="Describe the project, your role, and key achievements..."
                        style={{
                          width: "100%",
                          minHeight: 80,
                          padding: 12,
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          fontSize: 14,
                          lineHeight: 1.6,
                          fontFamily: "inherit",
                          resize: "vertical"
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>Technologies</label>
                      <input
                        type="text"
                        value={proj.technologies || ""}
                        onChange={(e) => {
                          const newProj = [...draft.projects];
                          newProj[idx].technologies = e.target.value;
                          setDraft({ ...draft, projects: newProj });
                        }}
                        placeholder="React, Node.js, MongoDB, etc."
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Certifications & Languages */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, background: "#fff" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 900, marginBottom: 12, color: "#0f172a" }}>Certifications</h3>
                  <input
                    type="text"
                    placeholder="Type and press Enter (e.g., AWS Certified)"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.currentTarget.value.trim()) {
                        e.preventDefault();
                        setDraft({ ...draft, certifications: [...(draft.certifications || []), e.currentTarget.value.trim()] });
                        e.currentTarget.value = "";
                      }
                    }}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14, marginBottom: 8 }}
                  />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(draft.certifications || []).map((cert, idx) => (
                      <span
                        key={`cert-${idx}`}
                        style={{
                          fontSize: 12,
                          padding: "4px 10px",
                          borderRadius: 6,
                          background: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          color: "#166534",
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        {cert}
                        <button
                          onClick={() => setDraft({ ...draft, certifications: (draft.certifications || []).filter((_, i) => i !== idx) })}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#166534",
                            cursor: "pointer",
                            fontSize: 14,
                            lineHeight: 1,
                            padding: 0
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 900, marginBottom: 12, color: "#0f172a" }}>Languages</h3>
                  <input
                    type="text"
                    placeholder="Type and press Enter (e.g., English - Fluent)"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.currentTarget.value.trim()) {
                        e.preventDefault();
                        setDraft({ ...draft, languages: [...(draft.languages || []), e.currentTarget.value.trim()] });
                        e.currentTarget.value = "";
                      }
                    }}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14, marginBottom: 8 }}
                  />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(draft.languages || []).map((lang, idx) => (
                      <span
                        key={`lang-${idx}`}
                        style={{
                          fontSize: 12,
                          padding: "4px 10px",
                          borderRadius: 6,
                          background: "#fef3c7",
                          border: "1px solid #fde68a",
                          color: "#92400e",
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        {lang}
                        <button
                          onClick={() => setDraft({ ...draft, languages: (draft.languages || []).filter((_, i) => i !== idx) })}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#92400e",
                            cursor: "pointer",
                            fontSize: 14,
                            lineHeight: 1,
                            padding: 0
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Other */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, background: "#fff" }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, marginBottom: 12, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>📋</span> Additional Information
              </h3>
              <textarea
                value={draft.other || ""}
                onChange={(e) => setDraft({ ...draft, other: e.target.value })}
                placeholder="Any other relevant information (awards, publications, volunteer work, etc.)..."
                style={{
                  width: "100%",
                  minHeight: 100,
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 14,
                  lineHeight: 1.6,
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={async () => {
                setResumeDraft(draft);
                setSavedAt(Date.now());
                await qc.invalidateQueries({ queryKey: ["me"] });
              }}
              style={{
                padding: "12px 24px",
                fontWeight: 900,
                borderRadius: 8,
                background: "#2563eb",
                color: "white",
                border: "none",
                cursor: "pointer",
                fontSize: 14
              }}
            >
              Save Draft
            </button>
            <button
              onClick={() => {
                const ok = window.confirm("Clear your local resume draft? This cannot be undone.");
                if (!ok) return;
                clearResumeDraft();
                setDraft({
                  personalInfo: {},
                  experience: [],
                  education: [],
                  skills: [],
                  projects: []
                });
                setSavedAt(null);
              }}
              style={{
                padding: "12px 24px",
                fontWeight: 800,
                borderRadius: 8,
                background: "white",
                color: "#64748b",
                border: "1px solid #cbd5e1",
                cursor: "pointer",
                fontSize: 14
              }}
            >
              Clear Draft
            </button>
          </div>
        </div>

        {/* Error Messages */}
        {(setDefaultMut.error || deleteMut.error) && (
          <div style={{ marginTop: 16, padding: 12, background: "#fee2e2", borderRadius: 8, color: "#b91c1c", fontSize: 13 }}>
            {((setDefaultMut.error || deleteMut.error) as any) instanceof ApiError
              ? `${((setDefaultMut.error || deleteMut.error) as ApiError).code}: ${((setDefaultMut.error || deleteMut.error) as ApiError).message}`
              : "Update failed"}
          </div>
        )}

        {parseMut.error && (
          <div style={{ marginTop: 16, padding: 12, background: "#fee2e2", borderRadius: 8, color: "#b91c1c", fontSize: 13 }}>
            {parseMut.error instanceof ApiError ? `${parseMut.error.code}: ${parseMut.error.message}` : "Parse failed"}
          </div>
        )}
      </div>
    </AppShell>
  );
}
