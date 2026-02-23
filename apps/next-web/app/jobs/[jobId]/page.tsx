"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("resumeId");
  const router = useRouter();
  const qc = useQueryClient();
  const [toastOpen, setToastOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  return (
    <AppShell>
      <div style={{ marginBottom: 10 }}>
        <Link href="/job-match">← Back to Job Match</Link>
      </div>
      <h1>Job Detail</h1>

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
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ border: "1px solid #e2e8f0", background: "#fff", padding: 12, borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{jobQ.data.job.title}</div>
                <div style={{ color: "#475569" }}>
                  {jobQ.data.job.company} · {jobQ.data.job.location || "—"} · {jobQ.data.job.jobType || "—"}
                </div>
                {(jobQ.data.job.applyUrl || jobQ.data.job.externalUrl) && (
                  <div style={{ marginTop: 8 }}>
                    <a
                      href={(jobQ.data.job.applyUrl || jobQ.data.job.externalUrl) as string}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#2563eb", fontWeight: 800 }}
                    >
                      Open external link →
                    </a>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  onClick={() => {
                    if (!jobQ.data) return;
                    const isFavorite = jobQ.data.job.isFavorite || false;
                    favoriteMut.mutate(!isFavorite);
                  }}
                  disabled={favoriteMut.isPending || jobQ.isLoading}
                  style={{
                    padding: "10px 12px",
                    height: 42,
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                  title={jobQ.data?.job.isFavorite ? "Unfavorite" : "Favorite"}
                >
                  <span style={{ fontSize: 18 }}>{jobQ.data?.job.isFavorite ? "★" : "☆"}</span>
                </button>
                <button
                  onClick={() => {
                    const url = jobQ.data?.job.applyUrl || jobQ.data?.job.externalUrl;
                    if (url) window.open(url, "_blank", "noopener,noreferrer");
                    setConfirmOpen(true);
                  }}
                  disabled={applyMut.isPending || jobQ.isLoading}
                  style={{ padding: "10px 12px", height: 42 }}
                >
                  {applyMut.isPending ? "Saving..." : "Apply"}
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", color: "#64748b", fontSize: 12 }}>
                {jobQ.data.job.source && <div>Source: {jobQ.data.job.source}</div>}
                {jobQ.data.job.postedAt && <div>Posted: {jobQ.data.job.postedAt}</div>}
                {typeof jobQ.data.job.isActive === "boolean" && <div>Active: {String(jobQ.data.job.isActive)}</div>}
              </div>
            </div>
          </div>

          {/* Match panel */}
          <div style={{ border: "1px solid #e2e8f0", background: "#fff", padding: 12, borderRadius: 8 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Match</div>
            {jobQ.data.match?.matchScore == null ? (
              <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>
                {jobQ.data.match?.note || "Upload/parse a resume to see match score."}{" "}
                <Link href="/resume" style={{ color: "#2563eb", fontWeight: 900 }}>
                  Upload resume →
                </Link>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>Match Score</div>
                  <div style={{ fontSize: 12, fontWeight: 900 }}>{jobQ.data.match.matchScore}%</div>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.max(0, Math.min(100, jobQ.data.match.matchScore || 0))}%`,
                      background:
                        (jobQ.data.match.matchScore || 0) >= 70 ? "#22c55e" : (jobQ.data.match.matchScore || 0) >= 40 ? "#f59e0b" : "#ef4444"
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "#64748b", fontWeight: 800 }}>
                  <span>keyword: {jobQ.data.match.keywordScore ?? 0}%</span>
                  <span>cluster: {jobQ.data.match.clusterScore ?? 0}%</span>
                </div>
                {jobQ.data.match.matchedClusters && jobQ.data.match.matchedClusters.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Matched capability areas:</div>
                    {jobQ.data.match.matchedClusters.slice(0, 3).map((c, idx) => (
                      <span
                        key={`mc-${idx}-${c}`}
                        style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, background: "#eef2ff", border: "1px solid #c7d2fe", color: "#3730a3", fontWeight: 900 }}
                      >
                        {c.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  {(["skills", "tools", "titles", "domain", "methods"] as const).map((g) => (
                    <div key={g} style={{ border: "1px solid #f1f5f9", borderRadius: 12, padding: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a", textTransform: "capitalize" }}>{g}</div>
                      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Matched:</span>
                          {(jobQ.data.match?.matchedKeywordsByGroup?.[g] || []).slice(0, 10).map((k, idx) => (
                            <span
                              key={`m-${g}-${idx}-${k}`}
                              style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontWeight: 900, border: "1px solid #bbf7d0" }}
                            >
                              {k}
                            </span>
                          ))}
                          {(jobQ.data.match?.matchedKeywordsByGroup?.[g] || []).length === 0 && <span style={{ fontSize: 12, color: "#94a3b8" }}>—</span>}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Missing:</span>
                          {(jobQ.data.match?.missingKeywordsByGroup?.[g] || []).slice(0, 10).map((k, idx) => (
                            <span
                              key={`x-${g}-${idx}-${k}`}
                              style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, background: "#f1f5f9", color: "#475569", fontWeight: 800, border: "1px solid #e2e8f0" }}
                            >
                              {k}
                            </span>
                          ))}
                          {(jobQ.data.match?.missingKeywordsByGroup?.[g] || []).length === 0 && <span style={{ fontSize: 12, color: "#94a3b8" }}>—</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Job keywords (grouped) */}
          {jobQ.data.job.jobKeywords && (
            <div style={{ border: "1px solid #e2e8f0", background: "#fff", padding: 12, borderRadius: 8 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Job Keywords</div>
              <div style={{ display: "grid", gap: 12 }}>
                {(["skills", "tools", "titles", "domain", "methods"] as const).map((g) => (
                  <div key={`jk-${g}`}>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900, textTransform: "capitalize" }}>{g}</div>
                    <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(jobQ.data.job.jobKeywords?.[g] || []).slice(0, 20).map((k, idx) => (
                        <span key={`j-${g}-${idx}-${k}`} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, background: "#f1f5f9", color: "#0f172a", fontWeight: 800 }}>
                          {k}
                        </span>
                      ))}
                      {(jobQ.data.job.jobKeywords?.[g] || []).length === 0 && <span style={{ fontSize: 12, color: "#94a3b8" }}>—</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ border: "1px solid #e2e8f0", background: "#fff", padding: 12, borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Description</div>
            <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{jobQ.data.job.descriptionText}</pre>
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

