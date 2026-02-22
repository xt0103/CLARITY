"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AIJobSearchAliasPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/job-match");
  }, [router]);
  return null;
}

