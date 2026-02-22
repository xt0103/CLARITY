"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "@/lib/api";
import type { ApplicationStatus, PlatformSource, Priority } from "@/lib/types";
import { ApiError } from "@/lib/apiClient";

function _statusLabel(status: ApplicationStatus): string {
  switch (status) {
    case "APPLIED":
      return "Applied";
    case "UNDER_REVIEW":
      return "Under Review";
    case "INTERVIEW":
      return "Interview";
    case "OFFER":
      return "Offer";
    case "REJECTED":
      return "Rejected";
  }
}

function _statusBadgeStyle(status: ApplicationStatus): { bg: string; fg: string; border: string } {
  switch (status) {
    case "APPLIED":
      return { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" };
    case "UNDER_REVIEW":
      return { bg: "#fefce8", fg: "#a16207", border: "#fde68a" };
    case "INTERVIEW":
      return { bg: "#ecfeff", fg: "#0e7490", border: "#a5f3fc" };
    case "OFFER":
      return { bg: "#f0fdf4", fg: "#166534", border: "#bbf7d0" };
    case "REJECTED":
      return { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" };
  }
}

function _priorityBadgeStyle(p: Priority | null | undefined): { bg: string; fg: string; border: string; label: string } {
  if (!p) return { bg: "#f1f5f9", fg: "#475569", border: "#e2e8f0", label: "—" };
  switch (p) {
    case "HIGH":
      return { bg: "#fff1f2", fg: "#be123c", border: "#fecdd3", label: "High" };
    case "MEDIUM":
      return { bg: "#fff7ed", fg: "#c2410c", border: "#fed7aa", label: "Medium" };
    case "LOW":
      return { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe", label: "Low" };
  }
}

function _platformLabel(s: PlatformSource): string {
  switch (s) {
    case "LINKEDIN":
      return "LinkedIn";
    case "OFFICIAL":
      return "Company Website";
    case "REFERRAL":
      return "Referral";
    case "OTHER":
      return "Other";
  }
}

export default function TrackerPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const [search, setSearch] = useState("");

  const listQ = useQuery({
    queryKey: ["applications"],
    queryFn: async () => api.listApplications()
  });

  const patchMut = useMutation({
    mutationFn: async (args: { id: string; status: ApplicationStatus }) =>
      api.patchApplication(args.id, { status: args.status }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["applications"] });
      await qc.invalidateQueries({ queryKey: ["metrics"] });
    }
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => api.deleteApplication(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["applications"] });
      await qc.invalidateQueries({ queryKey: ["metrics"] });
    }
  });

  const apps = listQ.data?.applications || [];
  const appsFiltered = apps.filter((a) => {
    if (status && a.status !== status) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const hay = `${a.snapshotCompany} ${a.snapshotTitle} ${a.snapshotLocation || ""} ${a.platformSource}`.toLowerCase();
    return hay.includes(q);
  });

  const counts: Record<ApplicationStatus, number> = {
    APPLIED: 0,
    UNDER_REVIEW: 0,
    INTERVIEW: 0,
    OFFER: 0,
    REJECTED: 0
  };
  for (const a of apps) counts[a.status] += 1;

  const summaryCards: Array<{
    status: ApplicationStatus;
    title: string;
    subtitle: string;
    bg: string;
    dot: string;
  }> = [
    { status: "APPLIED", title: "Applied", subtitle: "Applications sent", bg: "#eff6ff", dot: "#2563eb" },
    { status: "UNDER_REVIEW", title: "Under Review", subtitle: "Being reviewed", bg: "#fff7ed", dot: "#f97316" },
    { status: "INTERVIEW", title: "Interview", subtitle: "Interview scheduled", bg: "#f5f3ff", dot: "#7c3aed" },
    { status: "OFFER", title: "Offer", subtitle: "Offers received", bg: "#f0fdf4", dot: "#22c55e" },
    { status: "REJECTED", title: "Rejected", subtitle: "Not selected", bg: "#f1f5f9", dot: "#0b1220" }
  ];

  return (
    <AppShell>
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Job Tracker</h1>
          <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
            Track applications, update stages, and keep links + notes in one place.
          </div>
        </div>
      </div>

      {listQ.isLoading && <p>Loading...</p>}
      {listQ.error && (
        <p style={{ color: "#b91c1c" }}>
          {listQ.error instanceof ApiError ? `${listQ.error.code}: ${listQ.error.message}` : "Failed to load"}
        </p>
      )}

      {listQ.data && listQ.data.applications.length === 0 && (
        <div style={{ marginTop: 14, color: "#64748b" }}>
          No applications yet. Apply to a job from the Job Detail page to create your first record.
        </div>
      )}

      {listQ.data && listQ.data.applications.length > 0 && (
        <div style={{ marginTop: 18 }}>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 14 }}>
            {summaryCards.map((c) => (
              <button
                key={c.status}
                onClick={() => setStatus((prev) => (prev === c.status ? "" : c.status))}
                style={{
                  textAlign: "left",
                  border: status === c.status ? "2px solid #2563eb" : "1px solid #e2e8f0",
                  background: c.bg,
                  borderRadius: 16,
                  padding: 18,
                  cursor: "pointer"
                }}
                title="Click to filter table"
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{c.title}</div>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      background: c.dot,
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 900
                    }}
                  >
                    {counts[c.status]}
                  </div>
                </div>
                <div style={{ marginTop: 10, color: "#64748b", fontSize: 12 }}>{c.subtitle}</div>
              </button>
            ))}
          </div>

          {/* Search / toolbar */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                border: "1px solid #e2e8f0",
                background: "#fff",
                padding: "10px 12px",
                borderRadius: 14,
                minWidth: 320
              }}
            >
              <span style={{ color: "#94a3b8" }}>⌕</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search applications..."
                style={{ border: 0, outline: "none", width: "100%", fontSize: 14 }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  fontWeight: 800,
                  color: "#334155"
                }}
                title="Filter by stage"
              >
                <option value="">All stages</option>
                <option value="APPLIED">Applied</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="INTERVIEW">Interview</option>
                <option value="OFFER">Offer</option>
                <option value="REJECTED">Rejected</option>
              </select>

              <button
                onClick={() => listQ.refetch()}
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 900 }}
              >
                Refresh
              </button>
              <button style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", fontWeight: 900 }}>
                Filter
              </button>
              <button style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", fontWeight: 900 }}>
                Columns
              </button>
              <button style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", fontWeight: 900 }}>
                …
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ marginTop: 14, border: "1px solid #e2e8f0", borderRadius: 16, background: "#fff", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 980 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#64748b", fontSize: 12 }}>
                  <th style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontWeight: 900 }}>Company</th>
                  <th style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontWeight: 900 }}>Role / Job Title</th>
                  <th style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontWeight: 900 }}>Platform Source</th>
                  <th style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontWeight: 900 }}>Date Applied</th>
                  <th style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontWeight: 900 }}>Location</th>
                  <th style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontWeight: 900 }}>Priority</th>
                  <th style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontWeight: 900 }}>Status</th>
                  <th style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontWeight: 900, width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {appsFiltered.map((a) => {
                  const pri = _priorityBadgeStyle(a.priority);
                  const st = _statusBadgeStyle(a.status);
                  const avatar = (a.snapshotCompany || "?").trim().charAt(0).toUpperCase();
                  return (
                    <tr key={a.id}>
                      <td style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 999,
                              background: "#eef2ff",
                              color: "#1d4ed8",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 900
                            }}
                            aria-label="company avatar"
                            title={a.snapshotCompany}
                          >
                            {avatar}
                          </div>
                          <div style={{ fontWeight: 800, color: "#0f172a" }}>{a.snapshotCompany}</div>
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
                        <div style={{ fontWeight: 800, color: "#0f172a" }}>{a.snapshotTitle}</div>
                        <div style={{ marginTop: 6, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          {a.snapshotExternalUrl ? (
                            <a href={a.snapshotExternalUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 900, color: "#2563eb" }}>
                              Apply link ↗
                            </a>
                          ) : (
                            <span style={{ fontSize: 12, color: "#94a3b8" }}>No link</span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
                        <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: 999, background: "#f1f5f9", color: "#334155", fontSize: 12, fontWeight: 800 }}>
                          {_platformLabel(a.platformSource)}
                        </span>
                      </td>

                      <td style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>{a.dateApplied}</td>

                      <td style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>{a.snapshotLocation || "—"}</td>

                      <td style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "6px 10px",
                            borderRadius: 999,
                            fontWeight: 900,
                            background: pri.bg,
                            color: pri.fg,
                            border: `1px solid ${pri.border}`,
                            fontSize: 12
                          }}
                        >
                          {pri.label}
                        </span>
                      </td>

                      <td style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "6px 10px",
                              borderRadius: 999,
                              fontWeight: 900,
                              background: st.bg,
                              color: st.fg,
                              border: `1px solid ${st.border}`,
                              fontSize: 12
                            }}
                          >
                            {_statusLabel(a.status)}
                          </span>
                          <select
                            value={a.status}
                            onChange={(e) => patchMut.mutate({ id: a.id, status: e.target.value as ApplicationStatus })}
                            disabled={patchMut.isPending || deleteMut.isPending}
                            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 800, fontSize: 12 }}
                            title="Update status"
                          >
                            <option value="APPLIED">Applied</option>
                            <option value="UNDER_REVIEW">Under Review</option>
                            <option value="INTERVIEW">Interview</option>
                            <option value="OFFER">Offer</option>
                            <option value="REJECTED">Rejected</option>
                          </select>
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>
                        <button
                          onClick={() => {
                            const ok = window.confirm("Delete this application? This is a soft delete.");
                            if (!ok) return;
                            deleteMut.mutate(a.id);
                          }}
                          disabled={deleteMut.isPending}
                          style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 900 }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ padding: "12px 16px", color: "#64748b", fontSize: 12, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                Showing <b>{appsFiltered.length}</b> of <b>{apps.length}</b>
                {status ? ` · filter=${_statusLabel(status)}` : ""}
                {search.trim() ? ` · query="${search.trim()}"` : ""}
              </div>
              <div>
                total: {listQ.data.total} · page: {listQ.data.page} · pageSize: {listQ.data.pageSize}
              </div>
            </div>
          </div>
        </div>
      )}

      {patchMut.error && (
        <p style={{ color: "#b91c1c" }}>
          {patchMut.error instanceof ApiError ? `${patchMut.error.code}: ${patchMut.error.message}` : "Failed to update"}
        </p>
      )}

      {deleteMut.error && (
        <p style={{ color: "#b91c1c" }}>
          {deleteMut.error instanceof ApiError ? `${deleteMut.error.code}: ${deleteMut.error.message}` : "Failed to delete"}
        </p>
      )}
    </AppShell>
  );
}

