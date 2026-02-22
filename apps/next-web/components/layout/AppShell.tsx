"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { api } from "@/lib/api";
import { clearAccessToken } from "@/lib/auth";
import { getProfileOverride } from "@/lib/profileOverride";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  // AI Job Search is our primary search experience (alias route exists at /ai-job-search)
  { href: "/job-match", label: "AI Job Search" },
  { href: "/tracker", label: "Job Tracker" },
  { href: "/ai-tools", label: "Toolbox" },
  { href: "/plugin", label: "Plugin" }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: async () => api.me()
  });

  const [displayNameOverride, setDisplayNameOverride] = useState<string | null>(null);
  useEffect(() => {
    const userId = meQ.data?.user.id;
    if (!userId) return;
    const o = getProfileOverride(userId);
    setDisplayNameOverride(o.displayName || null);
  }, [meQ.data?.user.id]);

  const userLabel = displayNameOverride || meQ.data?.user.name || meQ.data?.user.email || "Account";
  const avatarLetter = (userLabel || "?").trim().charAt(0).toUpperCase();

  return (
    <div style={{ minHeight: "100vh" }}>
      <RequireAuth />
      <header
        style={{
          height: 64,
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          padding: "0 20px",
          position: "sticky",
          top: 0,
          zIndex: 10
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src="/brand/clarity-mark.svg"
            alt="CLARITY"
            width={22}
            height={22}
            style={{ width: 22, height: 22, display: "block" }}
          />
          <div style={{ fontWeight: 900, letterSpacing: 0.2 }}>CLARITY</div>
          <div style={{ color: "#64748b", fontSize: 12 }}>for Talent</div>
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: 12, justifySelf: "center" }}>
          {navItems.map((it) => {
            const active = pathname?.startsWith(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                style={{
                  padding: "10px 16px",
                  borderRadius: 999,
                  background: active ? "#2563eb" : "transparent",
                  color: active ? "#ffffff" : "#334155",
                  fontWeight: 700
                }}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/settings" style={{ display: "flex", alignItems: "center", gap: 10 }} title="Edit profile">
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: "#cbd5e1",
                display: "grid",
                placeItems: "center",
                fontWeight: 900
              }}
              aria-label="avatar"
              title={userLabel}
            >
              {avatarLetter}
            </div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{userLabel}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{meQ.data?.user.email || ""}</div>
            </div>
          </Link>
          <button
            onClick={() => {
              clearAccessToken();
              router.replace("/login");
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid #cbd5e1",
              background: "#fff",
              fontWeight: 800
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <main style={{ padding: 20 }}>{children}</main>
    </div>
  );
}

