"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import type { JobListResponse } from "@/lib/types";

type SearchSession = {
  id: string;
  query: string;
  title: string;
  createdAt: number;
  resultsCount: number | null;
};

export default function JobMatchPage() {
  const [queryText, setQueryText] = useState("");
  const [result, setResult] = useState<JobListResponse | null>(null);
  const [viewMode, setViewMode] = useState<"home" | "search">("home");
  const [sessions, setSessions] = useState<SearchSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const pendingSessionIdRef = useRef<string | null>(null);
  const [stopped, setStopped] = useState(false);

  function uniq(xs: string[]) {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const x of xs) {
      const k = (x || "").trim();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(k);
    }
    return out;
  }

  const searchMut = useMutation({
    mutationFn: async (q: string) => api.searchJobs({ query: (q || "").trim(), withMatch: true, limit: 50, offset: 0 }),
    onSuccess: (data) => {
      setResult(data);
      const sid = pendingSessionIdRef.current;
      if (sid) {
        setSessions((prev) => prev.map((s) => (s.id === sid ? { ...s, resultsCount: data.jobs.length } : s)));
      }
    }
  });

  const chips = useMemo(
    () => ["Software Engineer", "Remote", "Full-time", "Singapore", "San Francisco", "Python"],
    []
  );

  // Default recommendations on first load (empty query = list active jobs)
  useEffect(() => {
    // Avoid re-triggering if user already searched.
    if (result) return;
    setViewMode("home");
    pendingSessionIdRef.current = null;
    searchMut.mutate("");
    // We intentionally only run this once for homepage recommendations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topJobs = useMemo(() => {
    if (!result?.jobs) return [];
    // Sort by match score desc. Jobs without match score sink to bottom, but keep stable order among ties.
    return result.jobs
      .map((j, idx) => ({ j, idx }))
      .sort((a, b) => {
        const as = a.j.match?.matchScore;
        const bs = b.j.match?.matchScore;
        const av = typeof as === "number" ? as : -1;
        const bv = typeof bs === "number" ? bs : -1;
        if (bv !== av) return bv - av;
        return a.idx - b.idx;
      })
      .slice(0, 8)
      .map((x) => x.j);
  }, [result]);

  const jobsToRender = useMemo(() => {
    if (!result?.jobs) return [];
    if (viewMode === "home") return topJobs;
    return result.jobs;
  }, [result, topJobs, viewMode]);

  function makeTitle(q: string) {
    const words = (q || "").trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 4).join(" ") || "Search";
  }

  function startSession(q: string) {
    const id = String(Date.now());
    const s: SearchSession = { id, query: q, title: makeTitle(q), createdAt: Date.now(), resultsCount: null };
    setSessions((prev) => [s, ...prev]);
    setActiveSessionId(id);
    pendingSessionIdRef.current = id;
    return id;
  }

  function doSearch(q: string) {
    const qq = (q || "").trim();
    setQueryText(q);
    setChatInput(q);
    setStopped(false);
    if (!qq) {
      setViewMode("home");
      pendingSessionIdRef.current = null;
      searchMut.mutate("");
      return;
    }
    setViewMode("search");
    const sid = startSession(qq);
    pendingSessionIdRef.current = sid;
    searchMut.mutate(qq);
  }

  function pickTags(j: NonNullable<JobListResponse["jobs"]>[number]) {
    const tags = uniq([
      ...((j.jobKeywords?.skills || []).slice(0, 2) as string[]),
      ...((j.jobKeywords?.tools || []).slice(0, 2) as string[]),
      ...((j.jobKeywords?.domain || []).slice(0, 1) as string[])
    ]);
    return tags.slice(0, 3);
  }

  function Ring({
    pct,
    stroke,
    label
  }: {
    pct: number;
    stroke: string;
    label: string;
  }) {
    const size = 54;
    const sw = 6;
    const r = (size - sw) / 2;
    const c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    const seg = (p / 100) * c;
    return (
      <div style={{ display: "grid", justifyItems: "center", gap: 4 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`${label}-${p}`}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth={sw} fill="transparent" />
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={stroke}
              strokeWidth={sw}
              fill="transparent"
              strokeDasharray={`${seg} ${c - seg}`}
              strokeLinecap="round"
            />
          </g>
          <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" style={{ fontWeight: 900, fill: "#0f172a", fontSize: 14 }}>
            {p}%
          </text>
        </svg>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>{label}</div>
      </div>
    );
  }

  const activeSession = useMemo(() => sessions.find((s) => s.id === activeSessionId) || null, [sessions, activeSessionId]);

  return (
    <AppShell>
      {viewMode === "home" ? (
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        {/* Hero */}
        <div
          style={{
            background: "#eaf2ff",
            border: "1px solid #dbeafe",
            borderRadius: 18,
            padding: "56px 20px 40px",
            position: "relative"
          }}
        >
          <button
            onClick={() => window.alert("Chat history (coming soon)")}
            style={{
              position: "absolute",
              right: 18,
              top: 18,
              padding: "10px 14px",
              borderRadius: 999,
              border: 0,
              background: "#0b1220",
              color: "#fff",
              fontWeight: 900
            }}
          >
            Chat History
          </button>

          <div style={{ maxWidth: 980, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ maxWidth: 860, width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 999,
                      background: "#0b1220",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 900,
                      flex: "0 0 auto"
                    }}
                    aria-hidden="true"
                  >
                    ⌕
                  </div>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 900 }}>AI Job Match Assistant</div>
                    <div style={{ color: "#64748b", marginTop: 4 }}>
                      Please describe your job search objectives, including location, industry, and job type.
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 18,
                    background: "#fff",
                    border: "1px solid #dbeafe",
                    borderRadius: 14,
                    padding: 14
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      value={queryText}
                      onChange={(e) => setQueryText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !searchMut.isPending) doSearch(queryText);
                      }}
                      placeholder="Tell me about your ideal job..."
                      style={{
                        flex: "1 1 420px",
                        padding: 14,
                        borderRadius: 12,
                        border: "1px solid #cbd5e1",
                        outline: "none"
                      }}
                    />
                    <button
                      onClick={() => doSearch(queryText)}
                      disabled={searchMut.isPending}
                      style={{
                        padding: "14px 18px",
                        borderRadius: 12,
                        border: 0,
                        background: "#2563eb",
                        color: "#fff",
                        fontWeight: 900,
                        minWidth: 110
                      }}
                    >
                      {searchMut.isPending ? "Searching..." : "Search"}
                    </button>
                  </div>

                  <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                    <Link
                      href="/resume"
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1px solid #bfdbfe",
                        background: "#fff",
                        fontWeight: 900,
                        color: "#0f172a"
                      }}
                    >
                      Upload Resume
                    </Link>
                    <button
                      onClick={() => window.alert("Job Description input (coming soon)")}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1px solid #bfdbfe",
                        background: "#fff",
                        fontWeight: 900,
                        color: "#0f172a"
                      }}
                    >
                      + Job Description
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ color: "#475569" }}>Quick search:</div>
                  {chips.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        // Select keywords without triggering a search / UI switch.
                        setQueryText((prev) => {
                          const p = (prev || "").trim();
                          if (!p) return c;
                          if (p.toLowerCase().includes(c.toLowerCase())) return p;
                          return `${p} ${c}`;
                        });
                        setChatInput((prev) => {
                          const p = (prev || "").trim();
                          if (!p) return c;
                          if (p.toLowerCase().includes(c.toLowerCase())) return p;
                          return `${p} ${c}`;
                        });
                      }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: "1px solid #0b1220",
                        background: "#0b1220",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 900
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                {searchMut.error && (
                  <div style={{ marginTop: 12, color: "#b91c1c" }}>
                    {searchMut.error instanceof ApiError ? `${searchMut.error.code}: ${searchMut.error.message}` : "Search failed"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div style={{ maxWidth: 980, margin: "26px auto 0" }}>
          <div style={{ textAlign: "center", fontWeight: 900, fontSize: 22 }}>Daily personalized job recommendations</div>
          <div style={{ height: 1, background: "#93c5fd", margin: "14px auto 0", maxWidth: 720 }} />

          {!result && !searchMut.isPending && (
            <div style={{ marginTop: 18, color: "#64748b", textAlign: "center" }}>
              Tip: run ingestion first (`python -m scripts.run_ingest --all`), then search here.
            </div>
          )}

          {result && result.jobs.length === 0 && !searchMut.isPending && (
            <div style={{ marginTop: 18, color: "#64748b", textAlign: "center" }}>No jobs found. Try another query.</div>
          )}

          {result && result.jobs.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
                {jobsToRender.map((j) => {
                  const tags = pickTags(j);
                  const score = j.match?.matchScore ?? null;
                  const logoLetter = (j.company || "?").trim().charAt(0).toUpperCase();
                  return (
                    <div
                      key={j.id}
                      style={{
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 16,
                        padding: 14,
                        boxShadow: "0 1px 0 rgba(15, 23, 42, 0.04)"
                      }}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div
                          style={{
                            width: 62,
                            height: 62,
                            borderRadius: 14,
                            background: "#e2e8f0",
                            display: "grid",
                            placeItems: "center",
                            fontWeight: 900,
                            color: "#334155",
                            flex: "0 0 auto"
                          }}
                          aria-label="company-logo"
                        >
                          {logoLetter}
                        </div>
                        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                          <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.2, marginBottom: 4 }}>
                            <Link href={`/jobs/${j.id}`} style={{ color: "#0b1220" }}>
                              {j.title}
                            </Link>
                          </div>
                          <div style={{ color: "#2563eb", fontWeight: 900, fontSize: 13 }}>{j.company}</div>
                          <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                            {j.location || "—"}
                          </div>
                        </div>
                        <Link
                          href={`/jobs/${j.id}`}
                          style={{
                            padding: "10px 14px",
                            borderRadius: 999,
                            border: "1px solid #cbd5e1",
                            background: "#fff",
                            fontWeight: 900,
                            flex: "0 0 auto"
                          }}
                        >
                          View
                        </Link>
                      </div>

                      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {tags.map((t, idx) => (
                          <span key={`${j.id}-tag-${idx}-${t}`} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, border: "1px solid #e2e8f0", background: "#fff" }}>
                            {t}
                          </span>
                        ))}
                      </div>

                      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 999,
                              background: "#dcfce7",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 900,
                              color: "#166534"
                            }}
                            title={score == null ? "Upload/parse resume to see match" : `Match: ${score}%`}
                          >
                            {score == null ? "—" : Math.max(0, Math.min(99, score))}
                          </div>
                          <div style={{ color: "#64748b", fontSize: 12 }}>match</div>
                        </div>

                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <button
                            onClick={() => {
                              if (j.applyUrl) window.open(j.applyUrl, "_blank", "noopener,noreferrer");
                              else window.alert("No apply link for this job yet.");
                            }}
                            style={{
                              padding: "10px 16px",
                              borderRadius: 999,
                              border: 0,
                              background: "#0b1220",
                              color: "#fff",
                              fontWeight: 900,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8
                            }}
                          >
                            Apply ↗
                          </button>
                          <button
                            onClick={() => window.alert("Saved (coming soon)")}
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 999,
                              border: "1px solid #cbd5e1",
                              background: "#fff",
                              fontWeight: 900
                            }}
                            aria-label="save"
                          >
                            ⌁
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 18, textAlign: "center" }}>
                <Link href="/job-match" style={{ color: "#2563eb", fontWeight: 900 }}>
                  Open AI Job Search →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
      ) : (
        <div style={{ maxWidth: 1440, margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "260px minmax(420px, 520px) minmax(520px, 1fr)",
              gap: 16,
              alignItems: "start"
            }}
          >
            {/* Left: history */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 16,
                overflow: "hidden",
                height: "calc(100vh - 120px)"
              }}
            >
              <div style={{ padding: 14, borderBottom: "1px solid #e2e8f0" }}>
                <button
                  onClick={() => window.alert("Chat history actions (coming soon)")}
                  style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 900 }}
                >
                  Chat History
                </button>
              </div>
              <div style={{ padding: 10, display: "grid", gap: 10, overflowY: "auto", height: "100%" }}>
                {sessions.length === 0 && <div style={{ color: "#64748b", padding: 10 }}>No history yet.</div>}
                {sessions.map((s) => {
                  const active = s.id === activeSessionId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setActiveSessionId(s.id);
                        pendingSessionIdRef.current = s.id;
                        setStopped(false);
                        setQueryText(s.query);
                        setChatInput(s.query);
                        searchMut.mutate(s.query);
                      }}
                      style={{
                        textAlign: "left",
                        border: active ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                        background: active ? "#eff6ff" : "#fff",
                        borderRadius: 14,
                        padding: 12,
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(s.createdAt))}
                        </div>
                        <span style={{ fontSize: 11, background: "#dbeafe", color: "#1d4ed8", padding: "2px 8px", borderRadius: 999, fontWeight: 900 }}>
                          {s.resultsCount == null ? "…" : `${s.resultsCount} results`}
                        </span>
                      </div>
                      <div style={{ marginTop: 10, fontWeight: 900, color: "#0f172a", lineHeight: 1.25 }}>{s.title}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Middle: assistant */}
            <div
              style={{
                background: "#eaf2ff",
                border: "1px solid #dbeafe",
                borderRadius: 16,
                overflow: "hidden",
                height: "calc(100vh - 120px)",
                display: "grid",
                gridTemplateRows: "auto 1fr auto"
              }}
            >
              <div style={{ padding: 14, borderBottom: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                <button
                  onClick={() => {
                    setViewMode("home");
                    setQueryText("");
                    setChatInput("");
                    setActiveSessionId(null);
                    pendingSessionIdRef.current = null;
                    searchMut.mutate("");
                  }}
                  style={{ border: 0, background: "transparent", fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10 }}
                >
                  ← <span style={{ fontSize: 16 }}>AI Job Assistant</span>
                </button>
              </div>

              <div style={{ padding: 14, overflowY: "auto" }}>
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ background: "#0b2a5b", color: "#fff", padding: 14, borderRadius: 14, maxWidth: 360 }}>
                    <div style={{ fontWeight: 900 }}>I understand your search.</div>
                    <div style={{ opacity: 0.92, marginTop: 6, lineHeight: 1.4, fontSize: 13 }}>
                      Let me help refine your search to find the best matches.
                    </div>
                  </div>

                  <div style={{ justifySelf: "end", background: "#fff", padding: 14, borderRadius: 14, maxWidth: 360, border: "1px solid #e2e8f0" }}>
                    <div style={{ color: "#0f172a", lineHeight: 1.4, fontSize: 13 }}>
                      {(activeSession?.query || queryText || "").trim()}
                    </div>
                  </div>

                  <div style={{ background: "#0b2a5b", color: "#fff", padding: 14, borderRadius: 14, maxWidth: 360 }}>
                    <div style={{ fontWeight: 900 }}>Great!</div>
                    <div style={{ opacity: 0.92, marginTop: 6, lineHeight: 1.4, fontSize: 13 }}>
                      {searchMut.isPending && !stopped
                        ? "Searching and analyzing your matches…"
                        : `Found ${result?.jobs?.length ?? 0} roles matching your criteria. Review the top matches on the right.`}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: 12, borderTop: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    onClick={() => window.alert("Attach (coming soon)")}
                    style={{ width: 38, height: 38, borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 900 }}
                    aria-label="attach"
                  >
                    +
                  </button>
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && chatInput.trim() && !searchMut.isPending) doSearch(chatInput);
                    }}
                    placeholder="Please describe your job search objectives..."
                    style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid #e2e8f0" }}
                  />
                  <button
                    onClick={() => doSearch(chatInput)}
                    disabled={!chatInput.trim() || searchMut.isPending}
                    style={{ width: 40, height: 40, borderRadius: 999, border: 0, background: "#2563eb", color: "#fff", fontWeight: 900 }}
                    aria-label="send"
                  >
                    ↑
                  </button>
                </div>
              </div>
            </div>

            {/* Right: results */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 16,
                overflow: "hidden",
                height: "calc(100vh - 120px)",
                display: "grid",
                gridTemplateRows: "auto 1fr auto"
              }}
            >
              <div style={{ padding: 14, borderBottom: "1px solid #e2e8f0", background: "#fff", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ color: "#475569", fontSize: 13, fontWeight: 900, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Searching for: {(activeSession?.query || queryText || "").trim()}
                </div>
                {searchMut.isPending && !stopped ? (
                  <div style={{ width: 18, height: 18, borderRadius: 999, border: "2px solid #cbd5e1", borderTopColor: "#2563eb", animation: "spin 1s linear infinite" }} />
                ) : null}
              </div>

              <div style={{ padding: 14, overflowY: "auto", display: "grid", gap: 14 }}>
                {searchMut.error && (
                  <div style={{ color: "#b91c1c" }}>
                    {searchMut.error instanceof ApiError ? `${searchMut.error.code}: ${searchMut.error.message}` : "Search failed"}
                  </div>
                )}
                {result?.jobs?.map((j) => {
                  const match = typeof j.match?.matchScore === "number" ? j.match.matchScore : 0;
                  const success = Math.max(0, Math.min(100, Math.round(match * 0.9)));
                  const tags = pickTags(j);
                  const logoLetter = (j.company || "?").trim().charAt(0).toUpperCase();
                  return (
                    <div key={j.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 16 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 14, alignItems: "center" }}>
                        <div style={{ width: 46, height: 46, borderRadius: 14, background: "#e2e8f0", display: "grid", placeItems: "center", fontWeight: 900 }}>
                          {logoLetter}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 900, fontSize: 18, lineHeight: 1.2 }}>
                            <Link href={`/jobs/${j.id}`} style={{ color: "#0f172a" }}>
                              {j.title}
                            </Link>
                          </div>
                          <div style={{ color: "#64748b", marginTop: 4, fontSize: 13 }}>{j.company}</div>
                        </div>
                        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                          <Ring pct={match} stroke="#2563eb" label="Match Rate" />
                          <Ring pct={success} stroke="#22c55e" label="Success Rate" />
                        </div>
                      </div>

                      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", color: "#475569", fontSize: 12, fontWeight: 900 }}>
                        <span>{j.company}</span>
                        <span>·</span>
                        <span>{j.location || "—"}</span>
                      </div>

                      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {tags.map((t, idx) => (
                          <span key={`${j.id}-t-${idx}`} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, background: "#eff6ff", color: "#2563eb", fontWeight: 900, border: "1px solid #bfdbfe" }}>
                            {t}
                          </span>
                        ))}
                      </div>

                      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <button
                          onClick={() => {
                            if (j.applyUrl) window.open(j.applyUrl, "_blank", "noopener,noreferrer");
                            else window.alert("No apply link for this job yet.");
                          }}
                          style={{ padding: "10px 16px", borderRadius: 999, border: 0, background: "#0b1220", color: "#fff", fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 8 }}
                        >
                          Apply ↗
                        </button>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button style={{ width: 40, height: 40, borderRadius: 999, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 900 }} onClick={() => window.alert("Saved (coming soon)")}>
                            ⌁
                          </button>
                          <button style={{ width: 40, height: 40, borderRadius: 999, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 900 }} onClick={() => window.alert("Notes (coming soon)")}>
                            ⎘
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: 14, borderTop: "1px solid #e2e8f0", background: "#fff", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  onClick={() => doSearch(activeSession?.query || queryText)}
                  disabled={searchMut.isPending}
                  style={{ padding: "12px 18px", borderRadius: 999, border: 0, background: "#2563eb", color: "#fff", fontWeight: 900 }}
                >
                  Regenerate
                </button>
                <button
                  onClick={() => setStopped(true)}
                  style={{ padding: "12px 18px", borderRadius: 999, border: 0, background: "#0b1220", color: "#fff", fontWeight: 900 }}
                >
                  Stop
                </button>
              </div>
            </div>
          </div>

          {/* tiny CSS for spinner */}
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </AppShell>
  );
}

