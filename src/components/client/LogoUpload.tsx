"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, buttonStyles } from "../ui";

export function LogoUpload({ hasLogo }: { hasLogo: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/logo", { method: "POST", body: form });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setError(j?.error?.message ?? "Upload failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">{hasLogo ? "A logo is on file. Upload a new image to replace it." : "No logo uploaded yet. It appears on the site and prescriptions."}</p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex items-center gap-2">
        <input ref={inputRef} type="file" accept="image/png,image/jpeg" className="text-sm" />
        <button type="button" className={buttonStyles.secondary} disabled={busy} onClick={upload}>
          {busy ? "Uploading..." : "Upload"}
        </button>
      </div>
    </div>
  );
}
