const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export type ApiErrorPayload = {
  error: { code: string; message: string; details?: unknown };
};

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(args: { status: number; code: string; message: string; details?: unknown }) {
    super(args.message);
    this.status = args.status;
    this.code = args.code;
    this.details = args.details;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers);
  const body = init?.body;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (!isFormData) {
    headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");
  }

  // Auth: automatically attach token from localStorage (key: looogo_token)
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("looogo_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers
  });

  if (!res.ok) {
    // 401: clear token and redirect to /login (except for auth endpoints themselves)
    if (
      res.status === 401 &&
      typeof window !== "undefined" &&
      path !== "/api/auth/login" &&
      path !== "/api/auth/register"
    ) {
      try {
        window.localStorage.removeItem("looogo_token");
      } catch {
        // ignore
      }
      // Hard redirect (works outside React components too)
      window.location.assign("/login");
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as ApiErrorPayload;
      if (data?.error?.code) {
        throw new ApiError({
          status: res.status,
          code: data.error.code,
          message: data.error.message || "Request failed",
          details: data.error.details
        });
      }
    }
    const text = await res.text();
    throw new ApiError({ status: res.status, code: "INTERNAL_ERROR", message: text || "Request failed" });
  }

  // 204 no content
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

