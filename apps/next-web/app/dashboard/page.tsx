"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import type { ApplicationStatus, JobListResponse, MatchJobCard } from "@/lib/types";
import { draftToText, getResumeDraft, getUseResumeDraftForMatching } from "@/lib/resumeDraft";
import { getProfileOverride } from "@/lib/profileOverride";

function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

const STATUS_COLORS: Record<ApplicationStatus, { stroke: string; fill: string; label: string }> = {
  APPLIED: { stroke: "#2563eb", fill: "#dbeafe", label: "Applied" },
  UNDER_REVIEW: { stroke: "#f59e0b", fill: "#fef3c7", label: "Under review" },
  INTERVIEW: { stroke: "#06b6d4", fill: "#cffafe", label: "Interview" },
  OFFER: { stroke: "#22c55e", fill: "#dcfce7", label: "Offer" },
  REJECTED: { stroke: "#ef4444", fill: "#fee2e2", label: "Rejected" }
};

function StatusLegend({
  breakdown
}: {
  breakdown: Partial<Record<ApplicationStatus, number>>;
}) {
  const order: ApplicationStatus[] = ["APPLIED", "UNDER_REVIEW", "INTERVIEW", "OFFER", "REJECTED"];
  const total = order.reduce((s, k) => s + (breakdown[k] ?? 0), 0);
  return (
    <div style={{ display: "grid", gap: 8, minWidth: 170 }}>
      {order.map((k) => {
        const v = breakdown[k] ?? 0;
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: STATUS_COLORS[k].stroke,
                  display: "inline-block",
                  flex: "0 0 auto"
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {STATUS_COLORS[k].label}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flex: "0 0 auto", minWidth: 60, justifyContent: "flex-end" }}>
              <span style={{ fontSize: 12, fontWeight: 900, textAlign: "right", minWidth: 20 }}>{v}</span>
              <span style={{ fontSize: 12, color: "#64748b", textAlign: "right", minWidth: 35 }}>{total ? `${pct(v, total)}%` : "0%"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusPie({
  breakdown,
  showLegend = true
}: {
  breakdown: Partial<Record<ApplicationStatus, number>>;
  showLegend?: boolean;
}) {
  const order: ApplicationStatus[] = ["APPLIED", "UNDER_REVIEW", "INTERVIEW", "OFFER", "REJECTED"];
  const total = order.reduce((s, k) => s + (breakdown[k] ?? 0), 0);

  const size = 140;
  const strokeW = 18;
  const r = (size - strokeW) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;

  let acc = 0;
  const segments: Array<{ status: ApplicationStatus; value: number; angle: number; midAngle: number }> = [];

  if (total > 0) {
    order.forEach((k) => {
      const v = breakdown[k] ?? 0;
      if (!v) return;
      const seg = (v / total) * c;
      const angle = (v / total) * 360;
      const midAngle = acc + angle / 2;
      segments.push({ status: k, value: v, angle, midAngle });
      acc += angle;
    });
  }

  // Convert angle to radians and calculate label position
  const getLabelPos = (angleDeg: number, radius: number) => {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    const x = center + radius * Math.cos(angleRad);
    const y = center + radius * Math.sin(angleRad);
    return { x, y };
  };

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "nowrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="application-status-pie" style={{ position: "relative", flexShrink: 0 }}>
        <g transform={`rotate(-90 ${center} ${center})`}>
          {/* background ring */}
          <circle cx={center} cy={center} r={r} fill="transparent" stroke="#e2e8f0" strokeWidth={strokeW} />
          {/* segments */}
          {segments.map((seg, idx) => {
            let segAcc = 0;
            for (let i = 0; i < idx; i++) {
              segAcc += segments[i].angle;
            }
            const segLength = (seg.angle / 360) * c;
            const dashOffset = c - segAcc;
            return (
              <circle
                key={seg.status}
                cx={center}
                cy={center}
                r={r}
                fill="transparent"
                stroke={STATUS_COLORS[seg.status].stroke}
                strokeWidth={strokeW}
                strokeDasharray={`${segLength} ${c - segLength}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
              />
            );
          })}
        </g>

        {/* center label */}
        <text x={center} y={center - 4} dominantBaseline="middle" textAnchor="middle" style={{ fontSize: 20, fontWeight: 900, fill: "#0f172a" }}>
          {total}
        </text>
        <text x={center} y={center + 10} dominantBaseline="middle" textAnchor="middle" style={{ fontSize: 10, fill: "#64748b", fontWeight: 800 }}>
          total
        </text>

      </svg>

      {showLegend && (
        <div style={{ display: "grid", gap: 6 }}>
          {order.map((k) => {
            const v = breakdown[k] ?? 0;
            return (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0f172a" }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: STATUS_COLORS[k].stroke, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 900, minWidth: 80 }}>{STATUS_COLORS[k].label}</span>
                <span style={{ fontSize: 11, color: "#64748b" }}>{total ? `${pct(v, total)}%` : "0%"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const qc = useQueryClient();
  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: async () => api.me()
  });

  const resumesQ = useQuery({
    queryKey: ["resumes"],
    queryFn: async () => api.listResumes()
  });

  const metricsQ = useQuery({
    queryKey: ["metrics"],
    queryFn: async () => api.dashboardMetrics()
  });

  const [assistantText, setAssistantText] = useState("");
  const [jobSearchRes, setJobSearchRes] = useState<JobListResponse | null>(null);

  const dailyQ = useQuery({
    queryKey: ["dailyMatches", meQ.data?.user.defaultResumeId || null],
    queryFn: async () => {
      const rid = meQ.data?.user.defaultResumeId ?? null;
      // Pull a larger candidate set, then pick the top 4 by matchScore in the UI.
      const res = await api.matchSearch({ queryText: "software engineer", resumeId: rid, limit: 20 });
      return res.jobs;
    },
    enabled: !!meQ.data,
    staleTime: 60_000
  });

  const matchesRaw = dailyQ.data || [];
  const matches = useMemo(() => {
    return [...matchesRaw]
      .map((j, idx) => ({ j, idx }))
      .sort((a, b) => {
        const av = typeof a.j.matchScore === "number" ? a.j.matchScore : -1;
        const bv = typeof b.j.matchScore === "number" ? b.j.matchScore : -1;
        if (bv !== av) return bv - av;
        return a.idx - b.idx;
      })
      .slice(0, 4)
      .map((x) => x.j);
  }, [matchesRaw]);

  const searchMut = useMutation({
    mutationFn: async () =>
      api.searchJobs({
        query: assistantText.trim(),
        limit: 6,
        offset: 0
      }),
    onSuccess: (res) => setJobSearchRes(res)
  });

  const applyMut = useMutation({
    mutationFn: async (job: MatchJobCard) => {
      const ok = window.confirm("Did you apply? Click OK to confirm and add to Tracker.");
      if (!ok) return null;
      return api.createApplication({
        jobId: job.jobId,
        jobSnapshot: {
          title: job.title,
          company: job.company,
          location: job.location || null,
          externalUrl: job.externalUrl || null
        },
        platformSource: "OFFICIAL",
        dateApplied: new Date().toISOString().slice(0, 10),
        status: "APPLIED",
        priority: "MEDIUM",
        notes: "Applied (confirmed)"
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["metrics"] });
      await qc.invalidateQueries({ queryKey: ["applications"] });
    }
  });

  const quickChips = ["Software Engineer", "Remote", "Full-time", "Singapore"];
  const [displayNameOverride, setDisplayNameOverride] = useState<string | null>(null);
  useEffect(() => {
    const load = () => {
      const userId = meQ.data?.user.id;
      if (!userId) return;
      const o = getProfileOverride(userId);
      setDisplayNameOverride(o.displayName || null);
    };
    load();
    if (typeof window !== "undefined") {
      window.addEventListener("focus", load);
      return () => window.removeEventListener("focus", load);
    }
    return;
  }, [meQ.data?.user.id]);

  const displayName = displayNameOverride || meQ.data?.user.name || meQ.data?.user.email || "";
  const avatarLetter = (displayName || "?").trim().charAt(0).toUpperCase();
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    const load = () => {
      const draft = getResumeDraft();
      const d = draftToText(draft).trim();
      const useDraft = getUseResumeDraftForMatching();
      setDraftReady(useDraft && d.length >= 500);
    };
    load();
    if (typeof window !== "undefined") {
      window.addEventListener("focus", load);
      return () => window.removeEventListener("focus", load);
    }
    return;
  }, []);

  const completionPct = useMemo(() => {
    const hasUpload = (resumesQ.data?.resumes || []).length > 0;
    const hasDefault = !!meQ.data?.user.defaultResumeId;
    // simple, explainable heuristic:
    // - upload exists: 70
    // - default set: +15
    // - editable draft enabled+non-empty: +15
    let pct = 0;
    if (hasUpload) pct = 70;
    if (hasDefault) pct += 15;
    if (draftReady) pct += 15;
    return Math.min(100, pct);
  }, [resumesQ.data, meQ.data, draftReady]);
  const today = useMemo(() => new Date(), []);
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-based
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  const cal = useMemo(() => {
    const firstDow = new Date(calYear, calMonth, 1).getDay(); // 0=Sun..6=Sat
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: Array<{ day: number | null }> = [];
    for (let i = 0; i < firstDow; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
    while (cells.length % 7 !== 0) cells.push({ day: null });
    return { daysInMonth, cells };
  }, [calYear, calMonth]);

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(calYear, calMonth, 1));
  }, [calYear, calMonth]);

  const selectedLabel = useMemo(() => {
    const d = new Date(calYear, calMonth, selectedDay);
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(d);
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${weekday} · ${y}-${mm}-${dd}`;
  }, [calYear, calMonth, selectedDay]);

  if (meQ.isLoading) {
    return (
      <AppShell>
        <div style={{ padding: 24 }}>Loading profile…</div>
      </AppShell>
    );
  }

  if (meQ.error) {
    return (
      <AppShell>
        <div style={{ padding: 24 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Failed to load profile</div>
          <div style={{ color: "#b91c1c" }}>{meQ.error instanceof Error ? meQ.error.message : "Unknown error"}</div>
          <button onClick={() => meQ.refetch()} style={{ marginTop: 12, padding: "10px 12px" }}>
            Retry
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 1440, margin: "0 auto", display: "grid", gap: 18, paddingBottom: 24 }}>
        {/* Dashboard grid (3 columns). Subscription sits at left-bottom. Toolbox sits at middle-bottom. */}
        <div
          style={{
            display: "grid",
            // Responsive 3-column layout to avoid overlap on narrower viewports.
            // min widths + gaps must fit; otherwise content looks clipped/overlapped.
            gridTemplateColumns: "minmax(300px, 360px) minmax(520px, 1fr) minmax(300px, 360px)",
            gap: 18,
            alignItems: "start"
          }}
        >
          {/* Left column */}
          <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              background: "linear-gradient(135deg, #0b1220, #0f172a)",
              color: "#fff",
              borderRadius: 14,
              padding: 16,
              minHeight: 160
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 999,
                  background: "#1d4ed8",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 900
                }}
                aria-label="avatar"
                title={meQ.data?.user.name || meQ.data?.user.email || "User"}
              >
                {avatarLetter}
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>
                  Welcome Back, {displayName}!
                </div>
                <div style={{ opacity: 0.8, marginTop: 5, fontSize: 13 }}>{meQ.data?.user.email}</div>
              </div>
            </div>
            <div style={{ opacity: 0.75, marginTop: 10, fontSize: 13 }}>Current summary job track report</div>

            <div style={{ marginTop: 14, background: "#ffffff", color: "#0f172a", borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: 999, border: "5px solid #2563eb" }} />
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{completionPct}%</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Profile Completion</div>
                </div>
              </div>
              <Link href="/resume" style={{ color: "#2563eb", fontWeight: 700, fontSize: 13 }}>
                Complete Profile →
              </Link>
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 10, fontSize: 15 }}>Calendar</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 900, fontSize: 17, color: "#1d4ed8" }}>{monthLabel}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => {
                    const m = calMonth - 1;
                    if (m < 0) {
                      setCalMonth(11);
                      setCalYear((y) => y - 1);
                    } else setCalMonth(m);
                  }}
                  style={{ width: 32, height: 32, borderRadius: 999, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 900 }}
                  aria-label="prev-month"
                >
                  ‹
                </button>
                <button
                  onClick={() => {
                    const m = calMonth + 1;
                    if (m > 11) {
                      setCalMonth(0);
                      setCalYear((y) => y + 1);
                    } else setCalMonth(m);
                  }}
                  style={{ width: 32, height: 32, borderRadius: 999, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 900 }}
                  aria-label="next-month"
                >
                  ›
                </button>
              </div>
            </div>
            <div style={{ color: "#64748b", fontSize: 11, marginTop: 5 }}>{selectedLabel}</div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {["S", "M", "T", "W", "T", "F", "S"].map((d, idx) => (
                <div key={`dow-${idx}`} style={{ fontSize: 10, color: "#64748b", textAlign: "center", fontWeight: 800 }}>
                  {d}
                </div>
              ))}
              {cal.cells.map((c, idx) => {
                const isToday = c.day != null && calYear === today.getFullYear() && calMonth === today.getMonth() && c.day === today.getDate();
                const isSelected = c.day != null && c.day === selectedDay;
                return (
                  <button
                    key={`cal-${idx}`}
                    onClick={() => {
                      if (c.day != null) setSelectedDay(c.day);
                    }}
                    style={{
                      height: 32,
                      borderRadius: 999,
                      border: isSelected ? "1px solid #2563eb" : "1px solid transparent",
                      background: isSelected ? "#dbeafe" : isToday ? "#2563eb" : "#fff",
                      color: isToday ? "#fff" : "#0f172a",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: isToday || isSelected ? 900 : 700,
                      opacity: c.day == null ? 0 : 1,
                      cursor: c.day == null ? "default" : "pointer",
                      fontSize: 12
                    }}
                    aria-label={c.day == null ? "empty" : `day-${c.day}`}
                    disabled={c.day == null}
                  >
                    {c.day ?? ""}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subscription (moved to left-bottom blank area) */}
          <div style={{ background: "#2563eb", color: "#fff", borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>Subscription Status</div>
              <div style={{ background: "rgba(15,23,42,0.55)", padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 900 }}>
                Free Plan
              </div>
            </div>
            <ul style={{ marginTop: 10, marginBottom: 0, paddingLeft: 16, opacity: 0.95, lineHeight: 1.5, fontSize: 13 }}>
              <li>5 AI job matches per day</li>
              <li>Basic analytics</li>
              <li>Standard support</li>
            </ul>
            <button
              onClick={() => window.alert("Upgrade (coming soon)")}
              style={{
                marginTop: 10,
                padding: "8px 12px",
                borderRadius: 999,
                border: 0,
                background: "#ffffff",
                color: "#1d4ed8",
                fontWeight: 900,
                fontSize: 13
              }}
            >
              Upgrade to Pro
            </button>
          </div>
          </div>

          {/* Middle column */}
          <div style={{ display: "grid", gap: 16 }}>
          <div style={{ background: "#eaf2ff", borderRadius: 14, border: "1px solid #dbeafe", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>AI Job Match Assistant</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  Please describe your job search objectives, including location, industry, and job type.
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Link href="/resume" style={{ padding: "10px 12px", background: "#ffffff", borderRadius: 10, border: "1px solid #bfdbfe", fontWeight: 700 }}>
                  Upload Resume
                </Link>
                <button
                  onClick={() => window.alert("Job Description input (coming soon)")}
                  style={{ padding: "10px 12px", background: "#ffffff", borderRadius: 10, border: "1px solid #bfdbfe", fontWeight: 700 }}
                >
                  + Job Description
                </button>
              </div>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
              <input
                placeholder="Tell me about your ideal job..."
                value={assistantText}
                onChange={(e) => setAssistantText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && assistantText.trim() && !searchMut.isPending) searchMut.mutate();
                }}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid #bfdbfe" }}
              />
              <button
                disabled={!assistantText.trim() || searchMut.isPending}
                onClick={() => searchMut.mutate()}
                style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #2563eb", background: "#2563eb", color: "#fff", fontWeight: 800 }}
              >
                {searchMut.isPending ? "Searching..." : "Search"}
              </button>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: "#475569" }}>Quick search:</div>
              {quickChips.map((c) => (
                <button
                  key={c}
                  onClick={() => setAssistantText((prev) => (prev ? `${prev} ${c}` : c))}
                  style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#0b1220", color: "#fff", fontSize: 12 }}
                >
                  {c}
                </button>
              ))}
            </div>

            {searchMut.error && (
              <div style={{ marginTop: 10, color: "#b91c1c" }}>
                {searchMut.error instanceof ApiError ? `${searchMut.error.code}: ${searchMut.error.message}` : "Search failed"}
              </div>
            )}

            {jobSearchRes && !searchMut.isPending && (
              <div style={{ marginTop: 12 }}>
                {jobSearchRes.jobs.length === 0 ? (
                  <div style={{ color: "#64748b" }}>No jobs found. Try another query.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div style={{ fontWeight: 900, color: "#0f172a" }}>
                        Results: {jobSearchRes.jobs.length}/{jobSearchRes.total}
                      </div>
                      <Link href="/job-match" style={{ color: "#2563eb", fontWeight: 900 }}>
                        Open Job Search →
                      </Link>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                      {jobSearchRes.jobs.map((j) => (
                        <div key={j.id} style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: 14, padding: 12 }}>
                          <div style={{ fontWeight: 900 }}>
                            <Link href={`/jobs/${j.id}`} style={{ color: "#0f172a" }}>
                              {j.title}
                            </Link>
                          </div>
                          <div style={{ marginTop: 4, color: "#475569", fontSize: 13 }}>
                            {j.company} · {j.location || "—"}
                          </div>
                          <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <Link href={`/jobs/${j.id}`} style={{ fontWeight: 900, color: "#2563eb" }}>
                              View details →
                            </Link>
                            {j.applyUrl && (
                              <a href={j.applyUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 900, color: "#2563eb" }}>
                                Apply ↗
                              </a>
                            )}
                            <div style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>{j.source}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Application Performance</div>
              <div style={{ color: "#64748b", fontSize: 13 }}>Last 30 Days</div>
            </div>

            {metricsQ.isLoading && <p>Loading metrics...</p>}
            {metricsQ.error && (
              <p style={{ color: "#b91c1c" }}>{metricsQ.error instanceof ApiError ? metricsQ.error.message : "Failed to load metrics"}</p>
            )}
            {metricsQ.data && (
              <div
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "minmax(320px, 1fr) minmax(280px, 340px)",
                  gap: 14,
                  alignItems: "center"
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, minHeight: 95 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 12, background: "#dbeafe", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <img src="/dashboard-icons/applications.svg" alt="" width={22} height={22} style={{ width: 22, height: 22, display: "block" }} />
                      </div>
                      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                        <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, marginBottom: 4 }}>{metricsQ.data.totals.totalApplications}</div>
                        <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900, lineHeight: 1.2 }}>Total Applications</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, minHeight: 95 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 12, background: "#ede9fe", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <img src="/dashboard-icons/interviews.svg" alt="" width={22} height={22} style={{ width: 22, height: 22, display: "block" }} />
                      </div>
                      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                        <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, marginBottom: 4 }}>{metricsQ.data.totals.interviews}</div>
                        <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900, lineHeight: 1.2 }}>Interviews</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, minHeight: 95 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 12, background: "#dcfce7", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <img src="/dashboard-icons/offers.svg" alt="" width={22} height={22} style={{ width: 22, height: 22, display: "block" }} />
                      </div>
                      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                        <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, marginBottom: 4 }}>{metricsQ.data.totals.offers}</div>
                        <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900, lineHeight: 1.2 }}>Offers</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, minHeight: 95 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 12, background: "#ffedd5", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <img src="/dashboard-icons/response-rate.svg" alt="" width={22} height={22} style={{ width: 22, height: 22, display: "block" }} />
                      </div>
                      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                        <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, marginBottom: 4 }}>{metricsQ.data.totals.responseRate}%</div>
                        <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900, lineHeight: 1.2 }}>Response Rate</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    justifySelf: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 16,
                    flexWrap: "wrap"
                  }}
                >
                  <StatusPie breakdown={metricsQ.data.statusBreakdown} showLegend={false} />
                  <StatusLegend breakdown={metricsQ.data.statusBreakdown} />
                </div>
              </div>
            )}
          </div>

          {/* Productivity Toolbox (compressed to middle-bottom blank area) */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 16 }} id="toolbox">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <img src="/toolbox-icons/sparkle.svg" alt="" width={20} height={20} style={{ width: 20, height: 20, display: "block" }} />
              <div style={{ fontWeight: 900, fontSize: 18 }}>Productivity Toolbox</div>
              <Link href="/ai-tools" style={{ marginLeft: "auto", color: "#2563eb", fontWeight: 900 }}>
                View all →
              </Link>
            </div>

            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 12
              }}
            >
              {[
                { title: "Resume Optimizer", icon: "/toolbox-icons/doc.svg" },
                { title: "Cover Letter Generator", icon: "/toolbox-icons/mail.svg" },
                { title: "Salary Insights", icon: "/toolbox-icons/trend.svg" },
                { title: "Application Reminder", icon: "/toolbox-icons/download.svg" }
              ].map((t) => (
                <div
                  key={t.title}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 14,
                    padding: 12,
                    background: "#fff",
                    display: "grid",
                    gap: 10
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <img src={t.icon} alt="" width={48} height={48} style={{ width: 48, height: 48, display: "block" }} />
                    <div style={{ fontWeight: 900, fontSize: 14, lineHeight: 1.2 }}>{t.title}</div>
                  </div>
                  <button
                    onClick={() => window.location.assign("/ai-tools")}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 999,
                      border: 0,
                      background: "#2563eb",
                      color: "#fff",
                      fontWeight: 900
                    }}
                  >
                    Open Tool
                  </button>
                </div>
              ))}
            </div>
          </div>
          </div>

          {/* Right column */}
          <div style={{ display: "grid", gap: 16 }}>
          <div style={{ background: "#f1f5ff", borderRadius: 14, border: "1px solid #dbeafe", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Daily Job Matches</div>
              <div style={{ background: "#dbeafe", color: "#1d4ed8", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800 }}>
                {matches.length} New
              </div>
            </div>

            {dailyQ.isLoading && <p style={{ marginTop: 10 }}>Loading...</p>}
            {dailyQ.error && (
              <p style={{ marginTop: 10, color: "#b91c1c" }}>{dailyQ.error instanceof ApiError ? dailyQ.error.message : "Failed"}</p>
            )}

            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              {matches.map((j) => (
                <div key={j.jobId} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 12 }}>
                  <div style={{ fontWeight: 900 }}>{j.title}</div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>{j.company}</div>
                  <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{j.location || "—"}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(j.tags || []).slice(0, 3).map((t) => (
                      <span key={t} style={{ fontSize: 12, background: "#f1f5f9", padding: "2px 8px", borderRadius: 999 }}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 999, background: "#dcfce7", display: "grid", placeItems: "center", color: "#166534", fontWeight: 900 }}>
                        {Math.max(0, Math.min(99, j.matchScore))}
                      </div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>match</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link href={`/jobs/${j.jobId}`} style={{ padding: "8px 10px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 800 }}>
                        View
                      </Link>
                      <button
                        onClick={() => {
                          if (j.externalUrl) window.open(j.externalUrl, "_blank", "noopener,noreferrer");
                          applyMut.mutate(j);
                        }}
                        disabled={applyMut.isPending}
                        style={{ padding: "8px 10px", borderRadius: 999, border: "1px solid #0f172a", background: "#0f172a", color: "#fff", fontWeight: 800 }}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {applyMut.error && (
              <p style={{ marginTop: 10, color: "#b91c1c" }}>
                {applyMut.error instanceof ApiError ? `${applyMut.error.code}: ${applyMut.error.message}` : "Apply failed"}
              </p>
            )}

            <div style={{ marginTop: 12 }}>
              <Link href="/job-match" style={{ color: "#2563eb", fontWeight: 800 }}>
                Open AI Job Search →
              </Link>
            </div>
          </div>
          </div>
        </div>

      </div>
    </AppShell>
  );
}

