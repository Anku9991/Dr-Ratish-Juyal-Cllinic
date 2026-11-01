"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { Alert, Field, buttonStyles, inputClass } from "../ui";

export function DoctorProfileForm({ initial }: { initial: { qualification: string; bio: string } }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await api("/api/doctor/profile", "PUT", v);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {saved ? <Alert tone="success">Profile saved.</Alert> : null}
      <Field label="Qualification" htmlFor="qualification">
        <input id="qualification" className={inputClass} value={v.qualification} onChange={(e) => setV({ ...v, qualification: e.target.value })} maxLength={200} />
      </Field>
      <Field label="Bio" htmlFor="bio" hint="Shown on your public profile.">
        <textarea id="bio" rows={4} className={inputClass} value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} maxLength={2000} />
      </Field>
      <button type="submit" disabled={busy} className={buttonStyles.primary}>
        {busy ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
