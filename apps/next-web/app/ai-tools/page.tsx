"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useState } from "react";

export default function AIToolsPage() {
  type IconKind = "chat" | "doc" | "download" | "mail" | "trend" | "compass" | "sparkle" | "crown" | "check";

  function IconImg({
    src,
    fallbackKind,
    color,
    size,
    alt = ""
  }: {
    src?: string;
    fallbackKind: IconKind;
    color: string;
    size: number;
    alt?: string;
  }) {
    const [failed, setFailed] = useState(false);
    if (src && !failed) {
      return (
        <img
          src={src}
          alt={alt}
          width={size}
          height={size}
          style={{ width: size, height: size, display: "block" }}
          onError={() => setFailed(true)}
        />
      );
    }
    return <Icon kind={fallbackKind} color={color} size={size} />;
  }

  function Icon({
    kind,
    color,
    size = 22
  }: {
    kind: IconKind;
    color: string;
    size?: number;
  }) {
    const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg" };
    const strokeProps = { stroke: color, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
    if (kind === "chat") {
      return (
        <svg {...common} aria-hidden="true">
          <path {...strokeProps} d="M8 9h8M8 12h6" />
          <path {...strokeProps} d="M20 12a7 7 0 0 1-7 7H9l-5 3 1.4-4.2A7 7 0 1 1 20 12Z" />
        </svg>
      );
    }
    if (kind === "doc") {
      return (
        <svg {...common} aria-hidden="true">
          <path {...strokeProps} d="M8 3h6l4 4v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path {...strokeProps} d="M14 3v4h4" />
          <path {...strokeProps} d="M9 12h6M9 16h6" />
        </svg>
      );
    }
    if (kind === "download") {
      return (
        <svg {...common} aria-hidden="true">
          <path {...strokeProps} d="M12 3v10" />
          <path {...strokeProps} d="m8.5 10.5 3.5 3.5 3.5-3.5" />
          <path {...strokeProps} d="M6 20h12" />
          <path {...strokeProps} d="M7 20v-3h10v3" />
        </svg>
      );
    }
    if (kind === "mail") {
      return (
        <svg {...common} aria-hidden="true">
          <path {...strokeProps} d="M4 6h16v12H4V6Z" />
          <path {...strokeProps} d="m4 7 8 6 8-6" />
        </svg>
      );
    }
    if (kind === "trend") {
      return (
        <svg {...common} aria-hidden="true">
          <path {...strokeProps} d="M4 16l6-6 4 4 6-8" />
          <path {...strokeProps} d="M20 6v6h-6" />
        </svg>
      );
    }
    if (kind === "sparkle") {
      return (
        <svg {...common} aria-hidden="true">
          <path {...strokeProps} d="M12 3l1.3 4.2L18 9l-4.7 1.8L12 15l-1.3-4.2L6 9l4.7-1.8L12 3Z" />
          <path {...strokeProps} d="M19.5 3.5l.6 1.8 1.9.6-1.9.6-.6 1.8-.6-1.8-1.9-.6 1.9-.6.6-1.8Z" />
        </svg>
      );
    }
    if (kind === "crown") {
      return (
        <svg {...common} aria-hidden="true">
          <path {...strokeProps} d="M5 18h14" />
          <path {...strokeProps} d="M6 18l1-10 5 5 5-5 1 10" />
          <path {...strokeProps} d="M8 7l-2-2M16 7l2-2" />
        </svg>
      );
    }
    // check
    // compass
    return (
      <svg {...common} aria-hidden="true">
        {kind === "check" ? (
          <path {...strokeProps} d="m5 13 4 4L19 7" />
        ) : (
          <>
            <path {...strokeProps} d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
            <path {...strokeProps} d="m14.5 9.5-2 6-6 2 2-6 6-2Z" />
          </>
        )}
      </svg>
    );
  }

  function IconTile({
    bg,
    stroke,
    kind,
    imgSrc
  }: {
    bg: string;
    stroke: string;
    kind: IconKind;
    imgSrc?: string;
  }) {
    return (
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 18,
          background: bg,
          display: "grid",
          placeItems: "center",
          boxShadow: "0 18px 30px rgba(15,23,42,0.14)",
          border: "1px solid rgba(15,23,42,0.06)"
        }}
        aria-hidden="true"
      >
        <IconImg src={imgSrc} fallbackKind={kind} color={stroke} size={30} />
      </div>
    );
  }

  const tools = [
    {
      key: "interview",
      title: "AI Interview Practice",
      desc: "Practice interviews with AI-powered mock scenarios and get instant feedback",
      badge: "New",
      iconBg: "#eaf2ff",
      iconFg: "#0b67ff",
      iconKind: "chat" as const,
      iconImg: "/toolbox-icons/chat.svg",
      cta: { label: "Launch Tool", kind: "launch" as const }
    },
    {
      key: "resume-customizer",
      title: "Resume Customizer",
      desc: "Tailor your resume for each job application with AI suggestions",
      iconBg: "#e8fbf0",
      iconFg: "#1aa35c",
      iconKind: "doc" as const,
      iconImg: "/toolbox-icons/doc.svg",
      cta: { label: "Launch Tool", kind: "launch" as const }
    },
    {
      key: "plugin",
      title: "Job Application Plugin",
      desc: "Chrome extension to auto-fill applications and track submissions",
      badge: "New",
      iconBg: "#fff4e6",
      iconFg: "#ff8a00",
      iconKind: "download" as const,
      iconImg: "/toolbox-icons/download.svg",
      cta: { label: "Launch Tool", kind: "launch" as const }
    },
    {
      key: "cover-letter",
      title: "Cover Letter Generator",
      desc: "Create personalized cover letters based on job descriptions",
      iconBg: "#f3ebff",
      iconFg: "#8b5cf6",
      iconKind: "mail" as const,
      iconImg: "/toolbox-icons/mail.svg",
      cta: { label: "Launch Tool", kind: "launch" as const }
    },
    {
      key: "salary",
      title: "Salary Negotiation Coach",
      desc: "Get data-driven insights and strategies for salary negotiations",
      badge: "Premium",
      iconBg: "#ffe9ea",
      iconFg: "#ef4444",
      iconKind: "trend" as const,
      iconImg: "/toolbox-icons/trend.svg",
      cta: { label: "Unlock Tool", kind: "premium" as const }
    },
    {
      key: "career",
      title: "Career Path Advisor",
      desc: "AI-powered career guidance and skill development recommendations",
      badge: "Premium",
      iconBg: "#e8f5ff",
      iconFg: "#2b8cff",
      iconKind: "compass" as const,
      iconImg: "/toolbox-icons/compass.svg",
      cta: { label: "Unlock Tool", kind: "premium" as const }
    }
  ];

  function Chip({
    children,
    tone
  }: {
    children: string;
    tone: "blue" | "orange";
  }) {
    const bg = tone === "blue" ? "#1d4ed8" : "#f59e0b";
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 999,
          background: bg,
          color: "#fff",
          fontSize: 11,
          fontWeight: 900,
          lineHeight: 1
        }}
      >
        {children}
      </span>
    );
  }

  function ToolCard({
    title,
    desc,
    badge,
    iconBg,
    iconFg,
    iconKind,
    iconImg,
    cta
  }: {
    title: string;
    desc: string;
    badge?: "New" | "Premium";
    iconBg: string;
    iconFg: string;
    iconKind: "chat" | "doc" | "download" | "mail" | "trend" | "compass";
    iconImg?: string;
    cta: { label: string; kind: "launch" | "premium" };
  }) {
    return (
      <div
        style={{
          border: "1px solid #e2e8f0",
          background: "#fff",
          borderRadius: 16,
          padding: 16,
          display: "grid",
          gap: 10,
          minHeight: 190,
          boxShadow: "0 1px 0 rgba(15, 23, 42, 0.04)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center"
            }}
            aria-hidden="true"
          >
            <IconTile bg={iconBg} stroke={iconFg} kind={iconKind} imgSrc={iconImg} />
          </div>
          {badge === "New" && <Chip tone="blue">New</Chip>}
          {badge === "Premium" && <Chip tone="orange">Premium</Chip>}
        </div>

        <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
        <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.35 }}>{desc}</div>

        <div style={{ marginTop: "auto" }}>
          <button
            onClick={() => window.alert("Coming soon")}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: 0,
              background: cta.kind === "premium" ? "#fb8c00" : "#0b1220",
              color: "#fff",
              fontWeight: 900,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 8
            }}
          >
            {cta.kind === "premium" ? "🔒" : "↗"} {cta.label}
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 34, letterSpacing: -0.2 }}>Tool Box</h1>
            <div style={{ marginTop: 8, color: "#64748b", maxWidth: 620, lineHeight: 1.5 }}>
              Powerful tools to accelerate your job search journey. From AI interview practice to automated applications.
            </div>
          </div>
          <button
            onClick={() => window.alert("Premium (coming soon)")}
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              border: 0,
              background: "linear-gradient(180deg, #0ea5e9, #1d4ed8)",
              color: "#fff",
              fontWeight: 900,
              boxShadow: "0 10px 20px rgba(29, 78, 216, 0.25)",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <IconImg src="/toolbox-icons/crown.svg" fallbackKind="crown" color="#ffffff" size={18} /> Upgrade to Premium
          </button>
        </div>

        {/* Premium banner */}
        <div
          style={{
            marginTop: 16,
            borderRadius: 18,
            padding: 18,
            background: "linear-gradient(90deg, #f59e0b, #f97316)",
            color: "#fff",
            border: "1px solid rgba(15,23,42,0.06)",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 16,
                background: "rgba(255,255,255,0.18)",
                display: "grid",
                placeItems: "center",
                fontSize: 20,
                fontWeight: 900
              }}
              aria-hidden="true"
            >
              <IconImg src="/toolbox-icons/crown.svg" fallbackKind="crown" color="#ffffff" size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Unlock Premium Tools</div>
              <div style={{ opacity: 0.92, fontSize: 12 }}>
                Get access to advanced features including salary negotiation coach and career advisor
              </div>
            </div>
          </div>
          <button
            onClick={() => window.alert("Plans (coming soon)")}
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              border: 0,
              background: "rgba(255,255,255,0.92)",
              color: "#7c2d12",
              fontWeight: 900
            }}
          >
            View Plans →
          </button>
        </div>

        {/* Tools grid */}
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
          {tools.map((t) => (
            <ToolCard
              key={t.key}
              title={t.title}
              desc={t.desc}
              badge={t.badge as any}
              iconBg={t.iconBg}
              iconFg={t.iconFg}
              iconKind={t.iconKind}
              iconImg={t.iconImg}
              cta={t.cta}
            />
          ))}
        </div>

        {/* More tools coming soon */}
        <div style={{ marginTop: 16, borderRadius: 18, border: "1px solid #e2e8f0", background: "#fff", padding: 22 }}>
          <div style={{ display: "grid", placeItems: "center", textAlign: "center", gap: 10 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: "#eff6ff",
                color: "#2563eb",
                display: "grid",
                placeItems: "center",
                fontWeight: 900
              }}
            >
              <IconImg src="/toolbox-icons/sparkle.svg" fallbackKind="sparkle" color="#2563eb" size={26} />
            </div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>More Tools Coming Soon</div>
            <div style={{ color: "#64748b", fontSize: 13, maxWidth: 720, lineHeight: 1.5 }}>
              We're constantly building new tools to help you succeed in your job search. Have a suggestion? Let us know what features you'd like to see next.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>
              <button
                onClick={() => window.alert("Feature request (coming soon)")}
                style={{ padding: "10px 14px", borderRadius: 12, border: 0, background: "#2563eb", color: "#fff", fontWeight: 900 }}
              >
                Request a Feature
              </button>
              <button
                onClick={() => window.alert("Roadmap (coming soon)")}
                style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 900 }}
              >
                View Roadmap
              </button>
            </div>
          </div>
        </div>

        {/* Free vs Premium */}
        <div style={{ marginTop: 16, borderRadius: 18, border: "1px solid #e2e8f0", background: "#fff", padding: 18 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Free vs Premium Tools</div>

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
            <div style={{ borderRadius: 14, border: "1px solid #e2e8f0", padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 900 }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, background: "#e2e8f0", display: "grid", placeItems: "center" }}>
                  <IconImg src="/toolbox-icons/check.svg" fallbackKind="check" color="#0f172a" size={16} />
                </span>
                Free Tools
              </div>
              <ul style={{ marginTop: 12, marginBottom: 0, paddingLeft: 18, color: "#0f172a" }}>
                <li style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 900 }}>AI Interview Practice</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Basic features included</div>
                </li>
                <li style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 900 }}>Resume Customizer</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Basic features included</div>
                </li>
                <li style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 900 }}>Job Application Plugin</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Basic features included</div>
                </li>
                <li>
                  <div style={{ fontWeight: 900 }}>Cover Letter Generator</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Basic features included</div>
                </li>
              </ul>
            </div>

            <div style={{ borderRadius: 14, border: "1px solid #e2e8f0", padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 900 }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, background: "#ffedd5", display: "grid", placeItems: "center" }}>
                  <IconImg src="/toolbox-icons/crown.svg" fallbackKind="crown" color="#9a3412" size={16} />
                </span>
                Premium Tools
              </div>
              <ul style={{ marginTop: 12, marginBottom: 0, paddingLeft: 18, color: "#0f172a" }}>
                <li style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 900 }}>Salary Negotiation Coach</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Advanced features & priority support</div>
                </li>
                <li style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 900 }}>Career Path Advisor</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Advanced features & priority support</div>
                </li>
                <li>
                  <div style={{ fontWeight: 900 }}>Unlimited usage on all tools</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>No daily limits or restrictions</div>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div style={{ height: 24 }} />
      </div>
    </AppShell>
  );
}

