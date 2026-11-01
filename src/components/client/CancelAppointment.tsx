"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { Alert, buttonStyles, inputClass } from "../ui";

export function CancelAppointment({ appointmentId, refundEligible, paid }: { appointmentId: string; refundEligible: boolean; paid: boolean }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await api(`/api/appointments/${appointmentId}/cancel`, "POST", { reason });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    dialog.current?.close();
    router.refresh();
  }

  return (
    <>
      <button type="button" className={buttonStyles.secondary} onClick={() => dialog.current?.showModal()}>
        Cancel appointment
      </button>
      <dialog ref={dialog} className="w-[min(92vw,28rem)] rounded-2xl border border-line p-0 backdrop:bg-black/40" aria-labelledby="cancel-title">
        <div className="space-y-4 p-5">
          <h2 id="cancel-title" className="text-lg font-semibold">
            Cancel this appointment?
          </h2>
          {paid ? (
            refundEligible ? (
              <Alert tone="info">You are outside the cancellation window, so the full fee will be refunded to your original payment method.</Alert>
            ) : (
              <Alert tone="warning">This is inside the clinic&apos;s cancellation window, so the fee may not be refunded.</Alert>
            )
          ) : null}
          <div>
            <label htmlFor="cancel-reason" className="mb-1 block text-sm font-medium">
              Reason (optional)
            </label>
            <textarea id="cancel-reason" rows={2} maxLength={300} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonStyles.secondary} onClick={() => dialog.current?.close()}>
              Keep appointment
            </button>
            <button type="button" className={buttonStyles.danger} disabled={busy} onClick={submit}>
              {busy ? "Cancelling..." : "Yes, cancel"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
