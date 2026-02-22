"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { api } from "@/lib/api";
import { setAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/apiClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        await api.register({ email, password, name });
      }
      const res = await api.login({ email, password });
      setAccessToken(res.accessToken);
      router.replace(next);
    } catch (e) {
      if (e instanceof ApiError) setError(`${e.code}: ${e.message}`);
      else setError("Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 420 }}>
      <h1>Login</h1>
      <p>Use email/password to {mode === "login" ? "sign in" : "create an account"}.</p>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={() => setMode("login")}
          style={{ padding: "8px 10px", border: "1px solid #cbd5e1", background: mode === "login" ? "#e2e8f0" : "#fff" }}
        >
          Sign in
        </button>
        <button
          onClick={() => setMode("register")}
          style={{
            padding: "8px 10px",
            border: "1px solid #cbd5e1",
            background: mode === "register" ? "#e2e8f0" : "#fff"
          }}
        >
          Register
        </button>
      </div>

      {mode === "register" && (
        <label style={{ display: "block", marginTop: 12 }}>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={{ width: "100%", padding: 8, marginTop: 6 }}
          />
        </label>
      )}

      <label style={{ display: "block", marginTop: 12 }}>
        Email
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 8, marginTop: 6 }}
        />
      </label>

      <label style={{ display: "block", marginTop: 12 }}>
        Password
        <input
          value={password}
          type="password"
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 8, marginTop: 6 }}
        />
      </label>

      {error && (
        <div style={{ marginTop: 12, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", padding: 10 }}>
          {error}
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={loading || !email || !password || (mode === "register" && !name)}
        style={{ marginTop: 16, padding: "10px 12px" }}
      >
        {loading ? "Working..." : mode === "login" ? "Sign in" : "Register & Sign in"}
      </button>
    </main>
  );
}

