"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { getAccessToken } from "@/lib/auth";

export function RequireAuth() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      const next = encodeURIComponent(pathname || "/dashboard");
      router.replace(`/login?next=${next}`);
    }
  }, [router, pathname]);

  return null;
}

