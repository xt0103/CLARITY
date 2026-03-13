"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { assistantClient, type ChatResponse, type UIAction } from "@/lib/assistantClient";
import type { JobListResponse } from "@/lib/types";
import { CompanyLogo } from "@/lib/companyLogo";

type SearchSession = {
  id: string;
  query: string;
  title: string;
  createdAt: number;
  resultsCount: number | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

export default function JobMatchPage() {
  const searchParams = useSearchParams();
  const [queryText, setQueryText] = useState("");
  const [result, setResult] = useState<JobListResponse | null>(null);
  const [viewMode, setViewMode] = useState<"home" | "search">("home");
  const [sessions, setSessions] = useState<SearchSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const pendingSessionIdRef = useRef<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [initialQueryProcessed, setInitialQueryProcessed] = useState(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when chatMessages change
  useEffect(() => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

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

  /**
   * 判断用户输入是搜索查询还是聊天问题
   * 返回 true 表示是搜索查询，应该直接调用本地搜索
   * 返回 false 表示是聊天问题，应该调用 OpenAI API
   */
  function isSearchQuery(input: string): boolean {
    const text = input.trim().toLowerCase();
    if (!text) return false;

    // 明确的聊天问题关键词（优先级最高）
    const strongChatKeywords = [
      "如何", "怎么", "为什么", "怎样", "怎么办",
      "what", "how", "why", "when", "where",
      "建议", "应该", "可以", "能否", "能不能",
      "advice", "suggest", "recommend", "should", "can", "could",
      "准备", "面试", "简历", "求职", "找工作",
      "prepare", "interview", "resume", "career", "job search",
      "?", "？", "吗", "呢", "吧"
    ];

    // 检查是否包含明确的聊天关键词
    const hasStrongChatKeyword = strongChatKeywords.some(keyword => text.includes(keyword));
    
    // 检查是否以问号结尾
    const endsWithQuestion = text.endsWith("?") || text.endsWith("？");
    
    // 检查是否包含岗位相关关键词（搜索查询的特征）
    const jobKeywords = [
      "engineer", "developer", "manager", "analyst", "designer", "intern",
      "工程师", "开发", "经理", "分析师", "设计师", "实习生",
      "software", "product", "data", "frontend", "backend", "full stack",
      "软件", "产品", "数据", "前端", "后端", "全栈",
      "python", "java", "javascript", "react", "node", "aws", "docker",
      "找", "搜索", "查找", "search", "find", "look for"
    ];
    const hasJobKeyword = jobKeywords.some(keyword => text.includes(keyword));

    // 判断逻辑（优先级从高到低）：
    // 1. 如果包含明确的聊天关键词（如"如何"、"准备面试"），一定是聊天问题
    if (hasStrongChatKeyword) {
      // 除非是"找XX岗位"这样的明确搜索意图
      if (hasJobKeyword && (text.includes("找") || text.includes("search") || text.includes("find"))) {
        return true; // "找软件工程师" 这样的搜索
      }
      return false; // 聊天问题
    }

    // 2. 如果以问号结尾，通常是聊天问题（除非是"找XX?"这样的搜索）
    if (endsWithQuestion && !hasJobKeyword) {
      return false; // 聊天问题
    }

    // 3. 如果包含岗位关键词且没有聊天特征，是搜索查询
    if (hasJobKeyword && !endsWithQuestion) {
      return true; // 搜索查询
    }

    // 4. 如果很短（<20字符）且不包含问号，可能是搜索查询
    if (text.length < 20 && !endsWithQuestion && text.split(/\s+/).length <= 3) {
      return true; // 短搜索查询
    }

    // 5. 其他情况视为聊天问题
    return false;
  }

  const searchMut = useMutation({
    mutationFn: async (q: string) => {
      const query = (q || "").trim();
      return { query, data: await api.searchJobs({ query, withMatch: true, limit: 50, offset: 0 }) };
    },
    onSuccess: ({ query, data }) => {
      setResult(data);
      setViewMode("search");
      const sid = pendingSessionIdRef.current;
      if (sid) {
        setSessions((prev) => prev.map((s) => (s.id === sid ? { ...s, resultsCount: data.jobs.length } : s)));
      }
      // 添加用户消息到聊天记录（本地搜索模式）
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: query,
        timestamp: Date.now()
      };
      // 添加一个简单的助手回复
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.jobs.length > 0 
          ? `我找到了 ${data.jobs.length} 个匹配的岗位。请查看右侧的搜索结果。`
          : `没有找到匹配的岗位。请尝试调整搜索关键词。`,
        timestamp: Date.now()
      };
      setChatMessages((prev) => [...prev, userMsg, assistantMsg]);
    }
  });

  const assistantMut = useMutation({
    mutationFn: async (message: string) => {
      console.log("[Assistant] Sending message:", message);
      
      try {
        // 统一走 assistant 接口，由后端决定是快速搜索还是 LLM 聊天
        const response = await assistantClient.chat({
          message,
          conversationId: conversationId || undefined,
          context: {
            searchState: {
              queryText: queryText,
              filters: {}
            },
            // 不再传递 isChatQuestion，由后端判断
            // Additional context can be added here if needed
            // e.g., user preferences, interests, etc.
          }
        });
        console.log("[Assistant] Response received:", response);
        return { response, sentMessage: message };
      } catch (error) {
        console.error("[Assistant] Error:", error);
        throw error;
      }
    },
    onError: (error, variables) => {
      console.error("[Assistant] Mutation error:", error);
      // Show error to user
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `抱歉，发送失败：${error instanceof Error ? error.message : "未知错误"}`,
        timestamp: Date.now()
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    },
    onSuccess: ({ response, sentMessage }) => {
      console.log("[Assistant] Success, response:", response);
      setConversationId(response.conversationId);
      
      // Add messages to chat - use sentMessage from mutation variables
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: sentMessage,
        timestamp: Date.now()
      };
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.assistantText || "抱歉，没有收到回复。",
        timestamp: Date.now()
      };
      setChatMessages((prev) => [...prev, userMsg, assistantMsg]);
      
      // Process UI actions
      for (const action of response.uiActions) {
        if (action.type === "SET_SEARCH_RESULTS") {
          setResult({
            jobs: action.payload.jobs,
            total: action.payload.total,
            limit: 50,
            offset: 0
          });
          setViewMode("search");
        } else if (action.type === "SET_SEARCH_QUERY") {
          setQueryText(action.payload.queryText || "");
        } else if (action.type === "HIGHLIGHT_JOB") {
          // Could scroll to job or open detail
          // For now, just log
          console.log("Highlight job:", action.payload.jobId);
        } else if (action.type === "SHOW_TOAST") {
          // Show toast notification
          window.alert(action.payload.message);
        }
      }
      
      // Update session
      const sid = pendingSessionIdRef.current || String(Date.now());
      const jobsCount = response.uiActions.find(a => a.type === "SET_SEARCH_RESULTS")?.payload?.jobs?.length || result?.jobs.length || 0;
      setSessions((prev) => {
        const existing = prev.find((s) => s.id === sid);
        if (existing) {
          return prev.map((s) => 
            s.id === sid 
              ? { ...s, resultsCount: jobsCount }
              : s
          );
        } else {
          return [
            {
              id: sid,
              query: chatInput.trim(),
              title: chatInput.trim().slice(0, 50),
              createdAt: Date.now(),
              resultsCount: jobsCount
            },
            ...prev
          ];
        }
      });
    }
  });

  const qc = useQueryClient();
  const favoriteMut = useMutation({
    mutationFn: async ({ jobId, isFavorite }: { jobId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        return api.favoriteJob(jobId);
      } else {
        return api.unfavoriteJob(jobId);
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["jobs"] });
    }
  });

  const chips = useMemo(
    () => ["Software Engineer", "Remote", "Full-time", "Singapore", "San Francisco", "Python"],
    []
  );

  // Check URL query parameter on mount and when searchParams change
  useEffect(() => {
    const urlQuery = searchParams?.get("query");
    if (urlQuery && !initialQueryProcessed) {
      const decodedQuery = decodeURIComponent(urlQuery);
      setQueryText(decodedQuery);
      setChatInput(decodedQuery);
      setViewMode("search");
      setInitialQueryProcessed(true);
      // Trigger search with the query from URL
      searchMut.mutate(decodedQuery);
      // Also send to assistant
      setTimeout(() => {
        assistantMut.mutate(decodedQuery);
      }, 100);
    } else if (!urlQuery && !initialQueryProcessed) {
      // Initial load: stay in home mode, don't auto-trigger search
      // Top recommendations will be loaded when user first interacts or when we add a separate query
      setViewMode("home");
      pendingSessionIdRef.current = null;
      setInitialQueryProcessed(true);
      // Load top 8 recommendations for home view (sorted by match score)
      // Only load if we don't have result yet
      if (!result) {
        api.searchJobs({ query: "", withMatch: true, limit: 50, offset: 0 })
          .then((data) => {
            // Sort by match score and take top 8
            const sorted = data.jobs
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
            setResult({ ...data, jobs: sorted });
          })
          .catch((err) => {
            console.error("[Initial load] Failed to load recommendations:", err);
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
    console.log("[doSearch] Input:", qq);
    
    if (!qq) {
      console.log("[doSearch] Empty query, resetting to home");
      setViewMode("home");
      pendingSessionIdRef.current = null;
      // 空查询也走 assistant 接口，让后端决定
      assistantMut.mutate("");
      return;
    }
    
    // Update state BEFORE making API calls
    setQueryText(qq);
    setStopped(false);
    setViewMode("search");
    const sid = startSession(qq);
    pendingSessionIdRef.current = sid;

    // 统一走 assistant 接口，由后端决定是快速搜索还是 LLM 聊天
    console.log("[doSearch] Calling assistantMut (unified path)");
    assistantMut.mutate(qq);
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
                        <CompanyLogo companyName={j.company} logoUrl={j.companyLogoUrl} size={62} />
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
                            onClick={() => {
                              const isFavorite = j.isFavorite || false;
                              favoriteMut.mutate({ jobId: j.id, isFavorite: !isFavorite });
                            }}
                            disabled={favoriteMut.isPending}
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 999,
                              border: "1px solid #cbd5e1",
                              background: "#fff",
                              fontWeight: 900,
                              fontSize: 18,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer"
                            }}
                            aria-label={j.isFavorite ? "Unfavorite" : "Favorite"}
                            title={j.isFavorite ? "Unfavorite" : "Favorite"}
                          >
                            {j.isFavorite ? "★" : "☆"}
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
                        setViewMode("search");
                        assistantMut.mutate(s.query);
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

              <div 
                ref={chatContainerRef}
                style={{ padding: 14, overflowY: "auto" }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {chatMessages.length === 0 ? (
                    // Welcome message when no messages
                    <div style={{ background: "#0b2a5b", color: "#fff", padding: 14, borderRadius: 14, maxWidth: 360 }}>
                      <div style={{ fontWeight: 900 }}>欢迎使用 AI Job Assistant</div>
                      <div style={{ opacity: 0.92, marginTop: 6, lineHeight: 1.4, fontSize: 13 }}>
                        你可以输入岗位关键词搜索，或提问求职相关问题。我会帮你找到合适的岗位或提供求职建议。
                      </div>
                    </div>
                  ) : (
                    // Render actual chat messages
                    chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                          maxWidth: "70%",
                        }}
                      >
                        <div
                          style={{
                            background: msg.role === "user" ? "#fff" : "#0b2a5b",
                            color: msg.role === "user" ? "#0f172a" : "#fff",
                            padding: 14,
                            borderRadius: 14,
                            border: msg.role === "user" ? "1px solid #e2e8f0" : "none",
                            boxShadow: msg.role === "user" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                          }}
                        >
                          <div
                            style={{
                              lineHeight: 1.4,
                              fontSize: 13,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  
                  {/* Loading indicator */}
                  {(assistantMut.isPending || searchMut.isPending) && (
                    <div style={{ alignSelf: "flex-start", maxWidth: "70%" }}>
                      <div
                        style={{
                          background: "#0b2a5b",
                          color: "#fff",
                          padding: 14,
                          borderRadius: 14,
                        }}
                      >
                        <div style={{ lineHeight: 1.4, fontSize: 13, opacity: 0.92 }}>
                          正在思考中...
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Scroll anchor */}
                  <div ref={chatMessagesEndRef} />
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
                      if (e.key === "Enter" && chatInput.trim() && !assistantMut.isPending && !searchMut.isPending) {
                        e.preventDefault();
                        const msg = chatInput.trim();
                        setChatInput("");
                        doSearch(msg);
                      }
                    }}
                    placeholder="Please describe your job search objectives..."
                    style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid #e2e8f0" }}
                  />
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      const msg = chatInput.trim();
                      if (!msg || assistantMut.isPending || searchMut.isPending) {
                        console.log("[Button] Cannot send:", { msg, assistantPending: assistantMut.isPending, searchPending: searchMut.isPending });
                        return;
                      }
                      console.log("[Button] Sending:", msg);
                      setChatInput("");
                      doSearch(msg);
                    }}
                    disabled={!chatInput.trim() || (assistantMut.isPending || searchMut.isPending)}
                    style={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: 999, 
                      border: 0, 
                      background: (!chatInput.trim() || assistantMut.isPending || searchMut.isPending) ? "#94a3b8" : "#2563eb", 
                      color: "#fff", 
                      fontWeight: 900,
                      cursor: (!chatInput.trim() || assistantMut.isPending || searchMut.isPending) ? "not-allowed" : "pointer"
                    }}
                    aria-label="send"
                  >
                    {assistantMut.isPending || searchMut.isPending ? "..." : "↑"}
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
                  return (
                    <div key={j.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 16 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 14, alignItems: "center" }}>
                        <CompanyLogo companyName={j.company} logoUrl={j.companyLogoUrl} size={46} />
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
                          <button
                            onClick={() => {
                              const isFavorite = j.isFavorite || false;
                              favoriteMut.mutate({ jobId: j.id, isFavorite: !isFavorite });
                            }}
                            disabled={favoriteMut.isPending}
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 999,
                              border: "1px solid #cbd5e1",
                              background: "#fff",
                              fontWeight: 900,
                              fontSize: 18,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer"
                            }}
                            aria-label={j.isFavorite ? "Unfavorite" : "Favorite"}
                            title={j.isFavorite ? "Unfavorite" : "Favorite"}
                          >
                            {j.isFavorite ? "★" : "☆"}
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

