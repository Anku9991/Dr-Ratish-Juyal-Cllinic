"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { buttonStyles } from "../ui";
import { cn } from "@/lib/cn";

interface Props {
  url: string;
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  children: ReactNode;
  variant?: keyof typeof buttonStyles;
  confirm?: string;
  className?: string;
  onDone?: () => void;
}

/** A button that calls an API route, shows the error inline, and refreshes the page data on success. */
export function ApiButton({ url, method = "POST", body, children, variant = "secondary", confirm, className, onDone }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    setError(null);
    const res = await api(url, method, body ?? {});
    setBusy(false);
    if (!res.ok) return setError(res.message);
    onDone?.();
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={run} disabled={busy} className={cn(buttonStyles[variant], className)}>
        {busy ? "Working..." : children}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </span>
  );
}
