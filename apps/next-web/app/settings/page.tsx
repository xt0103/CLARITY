"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { clearProfileOverride, getProfileOverride, setProfileOverride } from "@/lib/profileOverride";

export default function SettingsPage() {
  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: async () => api.me()
  });

  const [displayName, setDisplayName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const userId = meQ.data?.user.id;
    if (!userId) return;
    const o = getProfileOverride(userId);
    setDisplayName(o.displayName || meQ.data?.user.name || "");
  }, [meQ.data?.user.id, meQ.data?.user.name]);

  return (
    <AppShell>
      <h1>Settings</h1>
      <div style={{ maxWidth: 720 }}>
        <h2 style={{ marginTop: 18 }}>Profile</h2>

        {meQ.isLoading && <p>Loading…</p>}
        {meQ.error && (
          <p style={{ color: "#b91c1c" }}>
            {meQ.error instanceof ApiError ? `${meQ.error.code}: ${meQ.error.message}` : "Failed to load profile"}
          </p>
        )}

        {meQ.data && (
          <>
            <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.4 }}>
              Note: the API contract currently supports <b>GET /api/me</b> only (no profile update endpoint),
              so changes here update your <b>UI display name locally</b> for this browser.
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 900 }}>Email</div>
                <input value={meQ.data.user.email} disabled style={{ padding: 10, borderRadius: 10, border: "1px solid #e2e8f0" }} />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 900 }}>Display name</div>
                <input
                  value={displayName}
                  onChange={(e) => {
                    setSaved(false);
                    setDisplayName(e.target.value);
                  }}
                  placeholder="Your name"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #e2e8f0" }}
                />
              </label>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => {
                    setProfileOverride(meQ.data.user.id, { displayName: displayName.trim() || undefined });
                    setSaved(true);
                  }}
                  style={{ padding: "10px 12px", fontWeight: 900 }}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    clearProfileOverride(meQ.data.user.id);
                    setDisplayName(meQ.data?.user.name || "");
                    setSaved(true);
                  }}
                  style={{ padding: "10px 12px" }}
                >
                  Reset to server name
                </button>
              </div>
              {saved && <div style={{ color: "#166534", fontWeight: 800 }}>Saved.</div>}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

