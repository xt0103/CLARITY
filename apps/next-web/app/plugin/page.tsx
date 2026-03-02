"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useState } from "react";

function PlatformCard({ name, type, iconUrl, fallback }: { name: string; type: string; iconUrl: string; fallback: string }) {
  const [imgError, setImgError] = useState(false);
  
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        padding: "20px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "4px",
        }}
      >
        {!imgError ? (
          <img
            src={iconUrl}
            alt={name}
            style={{
              width: "48px",
              height: "48px",
              objectFit: "contain",
              filter: "none", // Ensure no color filters are applied
            }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            style={{
              width: "48px",
              height: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
              background: "#f1f5f9",
              borderRadius: "8px",
            }}
          >
            {fallback}
          </div>
        )}
      </div>
      <div style={{ fontSize: "15px", fontWeight: 600, color: "#0f172a" }}>
        {name}
      </div>
      <div
        style={{
          fontSize: "12px",
          background: "#e0f2fe",
          color: "#2563eb",
          padding: "4px 10px",
          borderRadius: "20px",
          display: "inline-block",
          fontWeight: 500,
        }}
      >
        {type}
      </div>
    </div>
  );
}

export default function PluginPage() {
  return (
    <AppShell>
      <div style={{ width: "100%", maxWidth: "1400px", margin: "0 auto", padding: "0 24px" }}>
        {/* Hero Section */}
        <div
          style={{
            background: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)",
            borderRadius: "24px",
            padding: "80px 60px",
            marginTop: "24px",
            marginBottom: "80px",
            display: "flex",
            alignItems: "center",
            gap: "60px",
            color: "white",
          }}
        >
          {/* Left Side */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "inline-block",
                background: "rgba(255, 255, 255, 0.2)",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 500,
                marginBottom: "20px",
              }}
            >
              Browser Extension
            </div>
            <h1
              style={{
                fontSize: "56px",
                fontWeight: 700,
                lineHeight: 1.2,
                margin: "0 0 24px 0",
                color: "white",
              }}
            >
              Auto-Fill Job Applications in Seconds
            </h1>
            <p
              style={{
                fontSize: "20px",
                lineHeight: 1.6,
                marginBottom: "32px",
                color: "rgba(255, 255, 255, 0.9)",
              }}
            >
              Save hours of repetitive work. CLARITY Plugin automatically fills out job
              applications with your information across 100+ job boards and company websites.
            </p>
            <div style={{ display: "flex", gap: "16px", marginBottom: "32px" }}>
              <a
                href="/jobhunting.zip"
                download="jobhunting.zip"
                style={{
                  background: "#ffffff",
                  color: "#2563eb",
                  border: "none",
                  padding: "14px 28px",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  textDecoration: "none",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M10 2L3 7V17H8V12H12V17H17V7L10 2Z"
                    fill="currentColor"
                  />
                </svg>
                Download for Chrome
              </a>
              <button
                style={{
                  background: "transparent",
                  color: "white",
                  border: "2px solid rgba(255, 255, 255, 0.3)",
                  padding: "14px 28px",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path d="M8 6L14 10L8 14V6Z" fill="currentColor" />
                </svg>
                Watch Demo
              </button>
            </div>
            <div style={{ display: "flex", gap: "32px", fontSize: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="7" r="3" fill="currentColor" />
                  <path d="M5 17C5 13 7 11 10 11C13 11 15 13 15 17" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
                <span>10,000+ users</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M16 6L8 14L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
                <span>Free to use</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M10 2L3 5V10C3 13 6 16 10 17C14 16 17 13 17 10V5L10 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
                <span>100% secure</span>
              </div>
            </div>
          </div>

          {/* Right Side - Browser Mockup */}
          <div style={{ flex: 1, position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div
              style={{
                background: "white",
                borderRadius: "16px",
                padding: "0",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
                overflow: "hidden",
                width: "100%",
                maxWidth: "500px",
              }}
            >
              {/* Browser Title Bar */}
              <div
                style={{
                  background: "#f8f9fa",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                {/* Traffic Light Buttons */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: "#ff5f57",
                    }}
                  />
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: "#ffbd2e",
                    }}
                  />
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: "#28ca42",
                    }}
                  />
                </div>
                {/* URL Bar */}
                <div
                  style={{
                    flex: 1,
                    background: "#e8eaed",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    fontSize: "13px",
                    color: "#5f6368",
                    textAlign: "center",
                  }}
                >
                  jobs.google.com/application
                </div>
              </div>
              {/* Form Content */}
              <div style={{ padding: "24px", background: "white" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      {/* Blue Circle with Checkmark */}
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background: "#2563eb",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path
                            d="M15 4.5L6.75 12.75L3 9"
                            stroke="white"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      {/* Light Blue Bar */}
                      <div
                        style={{
                          flex: 1,
                          height: "40px",
                          background: "#dbeafe",
                          borderRadius: "8px",
                        }}
                      />
                      {/* Auto-filled Text */}
                      <span
                        style={{
                          fontSize: "14px",
                          color: "#2563eb",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Auto-filled
                      </span>
                    </div>
                  ))}
                </div>
                {/* Submit Button */}
                <button
                  style={{
                    width: "100%",
                    background: "#2563eb",
                    color: "white",
                    border: "none",
                    padding: "14px",
                    borderRadius: "8px",
                    fontSize: "16px",
                    fontWeight: 600,
                    cursor: "pointer",
                    marginTop: "24px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Submit Application
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Choose Your Browser Section */}
        <div style={{ marginBottom: "80px" }}>
          <h2
            style={{
              fontSize: "36px",
              fontWeight: 700,
              textAlign: "center",
              marginBottom: "40px",
              color: "#0f172a",
            }}
          >
            Choose Your Browser
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "24px",
              maxWidth: "900px",
              margin: "0 auto",
            }}
          >
            {[
              { name: "Chrome", available: true },
              { name: "Edge", available: true },
              { name: "Firefox", available: false },
            ].map((browser) => (
              <div
                key={browser.name}
                style={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "32px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "16px",
                  position: "relative",
                }}
              >
                {!browser.available && (
                  <div
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      background: "#fef3c7",
                      color: "#92400e",
                      padding: "4px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    Coming Soon
                  </div>
                )}
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "16px",
                  }}
                >
                  <img
                    src={`/plugin-icons/${browser.name.toLowerCase()}.svg`}
                    alt={browser.name}
                    style={{
                      width: "64px",
                      height: "64px",
                      objectFit: "contain",
                    }}
                    onError={(e) => {
                      // Fallback to colored circle if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `<div style="width: 64px; height: 64px; border-radius: 12px; background: ${
                          browser.name === "Chrome" ? "#4285F4" : browser.name === "Edge" ? "#0078D4" : "#FF7139"
                        }; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 600; color: white;">${browser.name[0]}</div>`;
                      }
                    }}
                  />
                </div>
                <div style={{ fontSize: "20px", fontWeight: 600, color: "#0f172a" }}>
                  {browser.name}
                </div>
                {browser.available ? (
                  <a
                    href="/jobhunting.zip"
                    download="jobhunting.zip"
                    style={{
                      width: "100%",
                      background: "#2563eb",
                      color: "white",
                      border: "none",
                      padding: "12px",
                      borderRadius: "8px",
                      fontSize: "16px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      textDecoration: "none",
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M10 2V10M10 10L14 6M10 10L6 6M3 10V16C3 17.1 3.9 18 5 18H15C16.1 18 17 17.1 17 16V10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                    Download
                  </a>
                ) : (
                  <button
                    style={{
                      width: "100%",
                      background: "#e2e8f0",
                      color: "#64748b",
                      border: "none",
                      padding: "12px",
                      borderRadius: "8px",
                      fontSize: "16px",
                      fontWeight: 600,
                      cursor: "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                    disabled
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M10 2V10M10 10L14 6M10 10L6 6M3 10V16C3 17.1 3.9 18 5 18H15C16.1 18 17 17.1 17 16V10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                    Not available
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Key Features Section */}
        <div style={{ marginBottom: "80px" }}>
          <h2
            style={{
              fontSize: "36px",
              fontWeight: 700,
              textAlign: "center",
              marginBottom: "40px",
              color: "#0f172a",
            }}
          >
            Key Features
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "24px",
              maxWidth: "1000px",
              margin: "0 auto",
            }}
          >
            {[
              {
                icon: (
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                      stroke="#2563eb"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ),
                title: "Auto-Fill Applications",
                description: "Automatically populate job application forms with your saved information.",
              },
              {
                icon: (
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2L3 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"
                      stroke="#10b981"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ),
                title: "Secure & Private",
                description: "All your data is encrypted and stored locally on your device.",
              },
              {
                icon: (
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                      stroke="#2563eb"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
                      stroke="#2563eb"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ),
                title: "Smart Resume Matching",
                description: "Detects job requirements and highlights matching qualifications.",
              },
              {
                icon: (
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#2563eb" strokeWidth="2" />
                    <path
                      d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
                      stroke="#2563eb"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ),
                title: "Multi-Platform Support",
                description: "Works across 100+ job boards and company career pages.",
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                style={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "32px",
                  display: "flex",
                  gap: "20px",
                }}
              >
                <div style={{ flexShrink: 0, display: "flex", alignItems: "flex-start" }}>
                  {feature.icon}
                </div>
                <div>
                  <h3 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px", color: "#0f172a" }}>
                    {feature.title}
                  </h3>
                  <p style={{ fontSize: "16px", color: "#64748b", lineHeight: 1.6 }}>
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works Section */}
        <div style={{ marginBottom: "80px" }}>
          <h2
            style={{
              fontSize: "36px",
              fontWeight: 700,
              textAlign: "center",
              marginBottom: "40px",
              color: "#0f172a",
            }}
          >
            How It Works
          </h2>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "40px",
              maxWidth: "1000px",
              margin: "0 auto",
              position: "relative",
            }}
          >
            {[
              {
                step: "1",
                title: "Install the Extension",
                description: "Download and add CLARITY Plugin to your browser in seconds.",
              },
              {
                step: "2",
                title: "Set Up Your Profile",
                description: "Enter your personal information, resume, and preferences once.",
              },
              {
                step: "3",
                title: "Start Applying",
                description: "Visit any job posting and let the plugin auto-fill your information.",
              },
            ].map((item, idx) => (
              <div key={idx} style={{ flex: 1, textAlign: "center", position: "relative" }}>
                {idx < 2 && (
                  <div
                    style={{
                      position: "absolute",
                      right: "-20px",
                      top: "40px",
                      width: "40px",
                      height: "2px",
                      background: "#e2e8f0",
                    }}
                  />
                )}
                <div
                  style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "50%",
                    background: "#2563eb",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "32px",
                    fontWeight: 700,
                    margin: "0 auto 20px",
                  }}
                >
                  {item.step}
                </div>
                <h3 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px", color: "#0f172a" }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: "16px", color: "#64748b", lineHeight: 1.6 }}>
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Works Across 100+ Platforms Section */}
        <div style={{ marginBottom: "80px" }}>
          <h2
            style={{
              fontSize: "36px",
              fontWeight: 700,
              textAlign: "center",
              marginBottom: "16px",
              color: "#0f172a",
            }}
          >
            Works Across 100+ Platforms
          </h2>
          <p
            style={{
              fontSize: "18px",
              textAlign: "center",
              color: "#64748b",
              marginBottom: "40px",
            }}
          >
            CLARITY Plugin supports major job boards, company career pages, and applicant tracking
            systems (ATS).
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "16px",
              maxWidth: "1000px",
              margin: "0 auto 32px",
            }}
          >
            {[
              { name: "LinkedIn", type: "Job Board", iconUrl: "https://cdn.worldvectorlogo.com/logos/linkedin-2.svg", fallback: "💼" },
              { name: "Indeed", type: "Job Board", iconUrl: "https://cdn.worldvectorlogo.com/logos/indeed.svg", fallback: "🔍" },
              { name: "Glassdoor", type: "Job Board", iconUrl: "https://cdn.worldvectorlogo.com/logos/glassdoor.svg", fallback: "🏢" },
              { name: "Google Careers", type: "Company", iconUrl: "https://cdn.worldvectorlogo.com/logos/google-2015.svg", fallback: "🔵" },
              { name: "Amazon Jobs", type: "Company", iconUrl: "https://cdn.worldvectorlogo.com/logos/amazon-2.svg", fallback: "📦" },
              { name: "Microsoft Careers", type: "Company", iconUrl: "https://cdn.worldvectorlogo.com/logos/microsoft-5.svg", fallback: "🪟" },
              { name: "Meta Careers", type: "Company", iconUrl: "https://cdn.worldvectorlogo.com/logos/meta-2.svg", fallback: "M" },
              { name: "Apple Jobs", type: "Company", iconUrl: "https://cdn.worldvectorlogo.com/logos/apple-11.svg", fallback: "🍎" },
              { name: "Workday", type: "ATS", iconUrl: "https://cdn.worldvectorlogo.com/logos/workday.svg", fallback: "⚡" },
              { name: "Greenhouse", type: "ATS", iconUrl: "https://cdn.worldvectorlogo.com/logos/greenhouse-2.svg", fallback: "🌱" },
              { name: "Lever", type: "ATS", iconUrl: "https://cdn.worldvectorlogo.com/logos/lever.svg", fallback: "⚙️" },
              { name: "BambooHR", type: "ATS", iconUrl: "https://cdn.worldvectorlogo.com/logos/bamboohr.svg", fallback: "🎋" },
            ].map((platform, idx) => (
              <PlatformCard
                key={idx}
                name={platform.name}
                type={platform.type}
                iconUrl={platform.iconUrl}
                fallback={platform.fallback}
              />
            ))}
          </div>
          <div style={{ textAlign: "center" }}>
            <a
              href="#"
              style={{
                color: "#2563eb",
                fontSize: "16px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                textDecoration: "none",
              }}
            >
              View All Supported Sites
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 12L10 8L6 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
