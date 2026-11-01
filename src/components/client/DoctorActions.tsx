"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { buttonStyles, Alert } from "../ui";
import type { AppointmentStatus } from "@/lib/status";

export function StartConsultationButton({ appointmentId, status }: { appointmentId: string; status: AppointmentStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    if (status === "confirmed") {
      const r1 = await api(`/api/doctor/appointments/${appointmentId}/status`, "POST", { status: "checked_in" });
      if (!r1.ok) {
        setBusy(false);
        return setError(r1.message);
      }
    }
    router.push(`/doctor/appointments/${appointmentId}`);
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={start} disabled={busy} className={buttonStyles.primary}>
        {status === "in_consultation" ? "Continue consultation" : "Start consultation"}
      </button>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </span>
  );
}

export function NoShowButton({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        className={buttonStyles.secondary}
        onClick={async () => {
          if (!window.confirm("Mark this patient as a no-show?")) return;
          setBusy(true);
          const res = await api(`/api/doctor/appointments/${appointmentId}/status`, "POST", { status: "no_show" });
          setBusy(false);
          if (!res.ok) return setError(res.message);
          router.push("/doctor");
          router.refresh();
        }}
      >
        Mark no-show
      </button>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </span>
  );
}
