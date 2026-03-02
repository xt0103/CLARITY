"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { api } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { clearAccessToken } from "@/lib/auth";
import { clearProfileOverride, getProfileOverride, setProfileOverride } from "@/lib/profileOverride";
import type { MeResponse } from "@/lib/types";

type SettingsTab = "profile" | "resume" | "notifications" | "privacy" | "billing" | "account";

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") || "profile") as SettingsTab;

  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: async () => api.me()
  });

  const setTab = (tab: SettingsTab) => {
    router.push(`/settings?tab=${tab}`);
  };

  return (
    <AppShell>
      <div style={{ display: "flex", gap: "32px", maxWidth: "1400px", margin: "0 auto", padding: "24px" }}>
        {/* Left Sidebar */}
        <div style={{ width: "240px", flexShrink: 0 }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "24px", color: "#0f172a" }}>Settings</h2>
          <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {[
              { id: "profile" as SettingsTab, label: "Profile", icon: "👤" },
              { id: "resume" as SettingsTab, label: "Resume & Documents", icon: "📄" },
              { id: "notifications" as SettingsTab, label: "Notifications", icon: "🔔" },
              { id: "privacy" as SettingsTab, label: "Privacy & Security", icon: "🛡️" },
              { id: "billing" as SettingsTab, label: "Billing & Plans", icon: "💳" },
              { id: "account" as SettingsTab, label: "Account", icon: "↗️" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: activeTab === item.id ? "#2563eb" : "transparent",
                  color: activeTab === item.id ? "#ffffff" : "#334155",
                  fontWeight: 500,
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "15px",
                }}
              >
                <span style={{ fontSize: "20px" }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
            <div style={{ height: "1px", background: "#e2e8f0", margin: "16px 0" }} />
            <button
              onClick={() => {
                clearAccessToken();
                router.replace("/login");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "none",
                background: "transparent",
                color: "#dc2626",
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
                fontSize: "15px",
              }}
            >
              <span style={{ fontSize: "20px" }}>↗️</span>
              Log Out
            </button>
          </nav>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {activeTab === "profile" && <ProfileTab meQ={meQ} />}
          {activeTab === "resume" && <ResumeTab />}
          {activeTab === "notifications" && <NotificationsTab />}
          {activeTab === "privacy" && <PrivacyTab />}
          {activeTab === "billing" && <BillingTab />}
          {activeTab === "account" && <AccountTab meQ={meQ} />}
        </div>
      </div>
    </AppShell>
  );
}

function ProfileTab({ meQ }: { meQ: ReturnType<typeof useQuery<MeResponse>> }) {
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const user = meQ.data?.user;
    if (!user?.id) return;
    const o = getProfileOverride(user.id);
    // Load saved values from localStorage, or use defaults
    setDisplayName(o.displayName || user.name || "");
    setFullName(o.fullName || user.name || "");
    setPhone(o.phone || "");
    setLocation(o.location || "");
    setJobTitle(o.jobTitle || "");
    setLinkedin(o.linkedin || "");
    setAvatarUrl(o.avatarUrl || null);
  }, [meQ.data?.user?.id, meQ.data?.user?.name]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB");
      return;
    }
    
    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setAvatarUrl(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
  };

  const handleSave = () => {
    const userId = meQ.data?.user?.id;
    if (!userId) return;
    
    setProfileOverride(userId, {
      displayName: fullName.trim() || undefined,
      fullName: fullName.trim() || undefined,
      phone: phone.trim() || undefined,
      location: location.trim() || undefined,
      jobTitle: jobTitle.trim() || undefined,
      linkedin: linkedin.trim() || undefined,
      avatarUrl: avatarUrl || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px", color: "#0f172a" }}>Profile</h1>
      <p style={{ fontSize: "16px", color: "#64748b", marginBottom: "32px" }}>Manage your personal information and professional details.</p>
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: avatarUrl ? "transparent" : "#cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", fontWeight: 700, color: "#64748b", overflow: "hidden", flexShrink: 0 }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              displayName[0]?.toUpperCase() || "D"
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "12px" }}>Upload a professional photo to make your profile stand out.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: "none" }}
                ref={fileInputRef}
              />
              <button
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                style={{ background: "#2563eb", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
              >
                Upload New Photo
              </button>
              {avatarUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  style={{ background: "transparent", color: "#64748b", border: "1px solid #e2e8f0", padding: "10px 20px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "20px", color: "#0f172a" }}>Basic Information</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 500, color: "#334155" }}>Full Name</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "15px" }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 500, color: "#334155" }}>Email</span>
            <div style={{ position: "relative" }}>
              <input value={meQ.data?.user.email || ""} disabled style={{ padding: "12px 12px 12px 40px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "15px", background: "#f8fafc", width: "100%" }} />
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}>✉️</span>
            </div>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 500, color: "#334155" }}>Phone Number</span>
            <div style={{ position: "relative" }}>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ padding: "12px 12px 12px 40px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "15px", width: "100%" }} />
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}>📞</span>
            </div>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 500, color: "#334155" }}>Location</span>
            <div style={{ position: "relative" }}>
              <input value={location} onChange={(e) => setLocation(e.target.value)} style={{ padding: "12px 12px 12px 40px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "15px", width: "100%" }} />
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}>📍</span>
            </div>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 500, color: "#334155" }}>Current Job Title</span>
            <div style={{ position: "relative" }}>
              <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} style={{ padding: "12px 12px 12px 40px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "15px", width: "100%" }} />
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}>💼</span>
            </div>
          </label>
        </div>
        <button onClick={handleSave} style={{ marginTop: "24px", background: "#2563eb", color: "white", border: "none", padding: "12px 24px", borderRadius: "8px", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}>Save Changes</button>
        {saved && <div style={{ marginTop: "12px", color: "#166534", fontSize: "14px", fontWeight: 500 }}>Changes saved successfully.</div>}
      </div>
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "20px", color: "#0f172a" }}>Social Links</h2>
        <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <span style={{ fontSize: "14px", fontWeight: 500, color: "#334155" }}>LinkedIn</span>
          <div style={{ position: "relative" }}>
            <input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} style={{ padding: "12px 12px 12px 40px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "15px", width: "100%" }} />
            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}>💼</span>
          </div>
        </label>
        <button onClick={handleSave} style={{ marginTop: "20px", background: "#2563eb", color: "white", border: "none", padding: "12px 24px", borderRadius: "8px", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}>Save Changes</button>
        {saved && <div style={{ marginTop: "12px", color: "#166534", fontSize: "14px", fontWeight: 500 }}>Changes saved successfully.</div>}
      </div>
    </div>
  );
}

function ResumeTab() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ["resumes"],
    queryFn: async () => api.listResumes()
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => api.uploadResume(file),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["resumes"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
      if (fileInputRef.current) fileInputRef.current.value = "";
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

  const deleteMut = useMutation({
    mutationFn: async (resumeId: string) => {
      await api.deleteResume(resumeId);
      return resumeId;
    },
    onMutate: (id) => setBusyId(id),
    onSettled: () => setBusyId(null),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["resumes"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
    }
  });

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMut.mutate(file);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return dateString;
    }
  };

  const handleDownload = async (resumeId: string, fileName: string) => {
    try {
      const detail = await api.getResumeDetail(resumeId);
      // Note: The API doesn't return file content directly, so we can't download the actual file
      // This would require a separate download endpoint. For now, we'll just show an alert.
      alert(`Download functionality requires a backend endpoint. Resume ID: ${resumeId}, File: ${fileName}`);
    } catch (error) {
      alert("Failed to download resume");
    }
  };

  const handleView = async (resumeId: string) => {
    try {
      const detail = await api.getResumeDetail(resumeId);
      if (detail.textContent) {
        // Open in new window or show in modal
        const newWindow = window.open();
        if (newWindow) {
          newWindow.document.write(`<pre style="padding: 20px; font-family: monospace; white-space: pre-wrap;">${detail.textContent}</pre>`);
        }
      } else {
        alert("No text content available for this resume");
      }
    } catch (error) {
      alert("Failed to view resume");
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px", color: "#0f172a" }}>
        Resume & Documents
      </h1>
      <p style={{ fontSize: "16px", color: "#64748b", marginBottom: "32px" }}>
        Upload and manage your resumes for different job applications.
      </p>

      {/* Upload Section */}
      <div
        style={{
          background: "#f8fafc",
          border: "2px dashed #cbd5e1",
          borderRadius: "12px",
          padding: "48px",
          textAlign: "center",
          marginBottom: "32px",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>📤</div>
        <h3 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px", color: "#0f172a" }}>
          Upload Your Resume
        </h3>
        <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "20px" }}>
          Drag and drop your file here, or{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleFileSelect();
            }}
            style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}
          >
            click to browse
          </a>
        </p>
        <button
          onClick={handleFileSelect}
          disabled={uploadMut.isPending}
          style={{
            background: uploadMut.isPending ? "#94a3b8" : "#2563eb",
            color: "white",
            border: "none",
            padding: "12px 24px",
            borderRadius: "8px",
            fontSize: "15px",
            fontWeight: 600,
            cursor: uploadMut.isPending ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>📁</span>
          {uploadMut.isPending ? "Uploading..." : "Choose File"}
        </button>
        {uploadMut.error && (
          <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "12px" }}>
            {uploadMut.error instanceof ApiError
              ? `${uploadMut.error.code}: ${uploadMut.error.message}`
              : "Upload failed"}
          </p>
        )}
        {uploadMut.isSuccess && (
          <p style={{ color: "#166534", fontSize: "13px", marginTop: "12px" }}>Upload successful!</p>
        )}
        <p style={{ fontSize: "12px", color: "#64748b", marginTop: "16px" }}>
          Supported formats: PDF, DOC, DOCX (Max 10MB)
        </p>
      </div>

      {/* Resumes List */}
      {listQ.isLoading && (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>Loading resumes...</div>
      )}
      {listQ.error && (
        <div
          style={{
            padding: "16px",
            background: "#fee2e2",
            borderRadius: "8px",
            color: "#b91c1c",
            marginBottom: "24px",
          }}
        >
          {listQ.error instanceof ApiError
            ? `${listQ.error.code}: ${listQ.error.message}`
            : "Failed to load resumes"}
        </div>
      )}

      {listQ.data && (
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "20px", color: "#0f172a" }}>
            Your Resumes ({listQ.data.resumes.length})
          </h2>
          {listQ.data.resumes.length === 0 ? (
            <div
              style={{
                background: "white",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "48px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              <p>No resumes uploaded yet. Upload your first resume above.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {listQ.data.resumes.map((resume) => (
                <div
                  key={resume.id}
                  style={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                  }}
                >
                  <div style={{ fontSize: "32px" }}>📄</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "15px", fontWeight: 500, color: "#0f172a" }}>
                        {resume.fileName}
                      </span>
                      {resume.isDefault && (
                        <span
                          style={{
                            background: "#2563eb",
                            color: "white",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        >
                          Default
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "13px", color: "#64748b" }}>
                      Uploaded {formatDate(resume.createdAt)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      onClick={() => handleDownload(resume.id, resume.fileName)}
                      disabled={busyId === resume.id}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: busyId === resume.id ? "not-allowed" : "pointer",
                        padding: "8px",
                        borderRadius: "6px",
                        opacity: busyId === resume.id ? 0.5 : 1,
                      }}
                      title="Download"
                    >
                      ⬇️
                    </button>
                    <button
                      onClick={() => handleView(resume.id)}
                      disabled={busyId === resume.id}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: busyId === resume.id ? "not-allowed" : "pointer",
                        padding: "8px",
                        borderRadius: "6px",
                        opacity: busyId === resume.id ? 0.5 : 1,
                      }}
                      title="View"
                    >
                      👁️
                    </button>
                    {!resume.isDefault && (
                      <button
                        onClick={() => setDefaultMut.mutate(resume.id)}
                        disabled={busyId === resume.id || setDefaultMut.isPending}
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: busyId === resume.id || setDefaultMut.isPending ? "not-allowed" : "pointer",
                          padding: "8px",
                          borderRadius: "6px",
                          opacity: busyId === resume.id || setDefaultMut.isPending ? 0.5 : 1,
                        }}
                        title="Set as default"
                      >
                        ✓
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${resume.fileName}"?`)) {
                          deleteMut.mutate(resume.id);
                        }
                      }}
                      disabled={busyId === resume.id || deleteMut.isPending}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: busyId === resume.id || deleteMut.isPending ? "not-allowed" : "pointer",
                        padding: "8px",
                        borderRadius: "6px",
                        opacity: busyId === resume.id || deleteMut.isPending ? 0.5 : 1,
                      }}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      <div
        style={{
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: "12px",
          padding: "20px",
          marginTop: "32px",
          display: "flex",
          gap: "16px",
        }}
      >
        <div style={{ fontSize: "24px" }}>ℹ️</div>
        <div>
          <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px", color: "#0f172a" }}>
            Tips for a Great Resume
          </h3>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "14px", color: "#334155", lineHeight: 1.6 }}>
            <li>Keep your resume updated with your latest experience</li>
            <li>Tailor your resume to match job requirements</li>
            <li>Use clear, professional formatting</li>
            <li>Include relevant keywords from job descriptions</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const [emailNotifs, setEmailNotifs] = useState({ newMatches: true, appUpdates: true, interviewReminders: true, weeklySummary: false });
  const [pushNotifs, setPushNotifs] = useState({ newMatches: true, appUpdates: true, interviewReminders: true });
  return <div><h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px", color: "#0f172a" }}>Notifications</h1><p style={{ fontSize: "16px", color: "#64748b", marginBottom: "32px" }}>Manage how you receive updates and alerts.</p><div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", marginBottom: "24px" }}><h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "24px", color: "#0f172a" }}>Email Notifications</h2><div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>{[{ key: "newMatches" as const, title: "New job matches", desc: "Get notified when new jobs match your preferences." }, { key: "appUpdates" as const, title: "Application updates", desc: "Updates on your job applications." }, { key: "interviewReminders" as const, title: "Interview reminders", desc: "Reminders for upcoming interviews." }, { key: "weeklySummary" as const, title: "Weekly summary", desc: "Weekly digest of your job search activity." }].map((item) => (<div key={item.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: "15px", fontWeight: 500, marginBottom: "4px", color: "#0f172a" }}>{item.title}</div><div style={{ fontSize: "14px", color: "#64748b" }}>{item.desc}</div></div><Toggle checked={emailNotifs[item.key]} onChange={(checked) => setEmailNotifs({ ...emailNotifs, [item.key]: checked })} /></div>))}</div></div><div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px" }}><h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "24px", color: "#0f172a" }}>Push Notifications</h2><div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>{[{ key: "newMatches" as const, title: "New job matches", desc: "Browser notifications for new opportunities." }, { key: "appUpdates" as const, title: "Application updates", desc: "Real-time updates on applications." }, { key: "interviewReminders" as const, title: "Interview reminders", desc: "Get notified before your scheduled interviews." }].map((item) => (<div key={item.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: "15px", fontWeight: 500, marginBottom: "4px", color: "#0f172a" }}>{item.title}</div><div style={{ fontSize: "14px", color: "#64748b" }}>{item.desc}</div></div><Toggle checked={pushNotifs[item.key]} onChange={(checked) => setPushNotifs({ ...pushNotifs, [item.key]: checked })} /></div>))}</div></div></div>;
}

function PrivacyTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileVisibility, setProfileVisibility] = useState(true);
  const [showApplicationHistory, setShowApplicationHistory] = useState(false);
  return <div><h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px", color: "#0f172a" }}>Privacy & Security</h1><p style={{ fontSize: "16px", color: "#64748b", marginBottom: "32px" }}>Control your data and account security.</p><div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", marginBottom: "24px" }}><h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "20px", color: "#0f172a" }}>Change Password</h2><div style={{ display: "flex", flexDirection: "column", gap: "16px" }}><label style={{ display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "14px", fontWeight: 500, color: "#334155" }}>Current Password</span><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={{ padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "15px" }} /></label><label style={{ display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "14px", fontWeight: 500, color: "#334155" }}>New Password</span><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "15px" }} /></label><label style={{ display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "14px", fontWeight: 500, color: "#334155" }}>Confirm New Password</span><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "15px" }} /></label></div><button style={{ marginTop: "20px", background: "#2563eb", color: "white", border: "none", padding: "12px 24px", borderRadius: "8px", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}>Update Password</button></div><div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px" }}><h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "20px", color: "#0f172a" }}>Privacy Settings</h2><div style={{ display: "flex", flexDirection: "column", gap: "20px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: "15px", fontWeight: 500, marginBottom: "4px", color: "#0f172a" }}>Profile visibility</div><div style={{ fontSize: "14px", color: "#64748b" }}>Allow recruiters to view your profile</div></div><Toggle checked={profileVisibility} onChange={setProfileVisibility} /></div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: "15px", fontWeight: 500, marginBottom: "4px", color: "#0f172a" }}>Show application history</div><div style={{ fontSize: "14px", color: "#64748b" }}>Display your application activity to recruiters</div></div><Toggle checked={showApplicationHistory} onChange={setShowApplicationHistory} /></div></div></div></div>;
}

function BillingTab() {
  return <div><h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px", color: "#0f172a" }}>Billing & Plans</h1><p style={{ fontSize: "16px", color: "#64748b", marginBottom: "32px" }}>Manage your subscription and billing information.</p><div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "48px", textAlign: "center" }}><p style={{ fontSize: "16px", color: "#64748b" }}>Coming soon...</p></div></div>;
}

function AccountTab({ meQ }: { meQ: ReturnType<typeof useQuery<MeResponse>> }) {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return dateString;
    }
  };

  if (meQ.isLoading) {
    return (
      <div>
        <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px", color: "#0f172a" }}>Account</h1>
        <p style={{ fontSize: "16px", color: "#64748b", marginBottom: "32px" }}>
          Manage your account settings and preferences.
        </p>
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "48px", textAlign: "center" }}>
          <p style={{ fontSize: "16px", color: "#64748b" }}>Loading account information...</p>
        </div>
      </div>
    );
  }

  if (meQ.error) {
    return (
      <div>
        <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px", color: "#0f172a" }}>Account</h1>
        <p style={{ fontSize: "16px", color: "#64748b", marginBottom: "32px" }}>
          Manage your account settings and preferences.
        </p>
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #fecaca",
            borderRadius: "12px",
            padding: "24px",
            color: "#b91c1c",
          }}
        >
          <p style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>Error loading account information</p>
          <p style={{ fontSize: "14px" }}>
            {meQ.error instanceof ApiError
              ? `${meQ.error.code}: ${meQ.error.message}`
              : "Failed to load account information"}
          </p>
        </div>
      </div>
    );
  }

  const user = meQ.data?.user;
  if (!user) {
    return (
      <div>
        <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px", color: "#0f172a" }}>Account</h1>
        <p style={{ fontSize: "16px", color: "#64748b", marginBottom: "32px" }}>
          Manage your account settings and preferences.
        </p>
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "48px", textAlign: "center" }}>
          <p style={{ fontSize: "16px", color: "#64748b" }}>No account information available.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px", color: "#0f172a" }}>Account</h1>
      <p style={{ fontSize: "16px", color: "#64748b", marginBottom: "32px" }}>
        View your account information and manage account settings.
      </p>

      {/* Account Information */}
      <div
        style={{
          background: "white",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "24px",
        }}
      >
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "20px", color: "#0f172a" }}>
          Account Information
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 500, color: "#64748b" }}>User ID</span>
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                fontSize: "15px",
                background: "#f8fafc",
                fontFamily: "monospace",
                color: "#334155",
              }}
            >
              {user.id}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 500, color: "#64748b" }}>Email Address</span>
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                fontSize: "15px",
                background: "#f8fafc",
                color: "#334155",
              }}
            >
              {user.email}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 500, color: "#64748b" }}>Display Name</span>
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                fontSize: "15px",
                background: "#f8fafc",
                color: "#334155",
              }}
            >
              {user.name || "Not set"}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 500, color: "#64748b" }}>Account Created</span>
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                fontSize: "15px",
                background: "#f8fafc",
                color: "#334155",
              }}
            >
              {formatDate(user.createdAt)}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 500, color: "#64748b" }}>Default Resume</span>
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                fontSize: "15px",
                background: "#f8fafc",
                color: "#334155",
              }}
            >
              {user.defaultResumeId || "No default resume set"}
            </div>
          </div>
        </div>
      </div>

      {/* Account Actions */}
      <div
        style={{
          background: "white",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "24px",
        }}
      >
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "20px", color: "#0f172a" }}>
          Account Actions
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              padding: "16px",
              background: "#fef3c7",
              border: "1px solid #fde68a",
              borderRadius: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "4px", color: "#92400e" }}>
                Delete Account
              </div>
              <div style={{ fontSize: "14px", color: "#a16207" }}>
                Permanently delete your account and all associated data. This action cannot be undone.
              </div>
            </div>
            <button
              onClick={() => {
                if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
                  alert("Account deletion is not yet implemented. Please contact support.");
                }
              }}
              style={{
                background: "#dc2626",
                color: "white",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div
        style={{
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: "12px",
          padding: "20px",
          marginTop: "24px",
          display: "flex",
          gap: "16px",
        }}
      >
        <div style={{ fontSize: "24px" }}>ℹ️</div>
        <div>
          <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px", color: "#0f172a" }}>
            About Your Account
          </h3>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "14px", color: "#334155", lineHeight: 1.6 }}>
            <li>Your account information is securely stored and encrypted</li>
            <li>To update your email or name, please contact support</li>
            <li>Account deletion is permanent and cannot be reversed</li>
            <li>For security reasons, some account changes require verification</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <button onClick={() => onChange(!checked)} style={{ width: "48px", height: "28px", borderRadius: "14px", border: "none", background: checked ? "#2563eb" : "#cbd5e1", cursor: "pointer", position: "relative", transition: "background 0.2s", padding: "2px" }}><div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "white", transform: checked ? "translateX(20px)" : "translateX(0)", transition: "transform 0.2s" }} /></button>;
}
