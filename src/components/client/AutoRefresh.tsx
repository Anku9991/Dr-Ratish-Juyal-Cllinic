"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches the server component data a few times (used while waiting for the payment webhook). */
export function AutoRefresh({ seconds, times = 8 }: { seconds: number; times?: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      router.refresh();
      if (n >= times) clearInterval(t);
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds, times]);
  return null;
}
