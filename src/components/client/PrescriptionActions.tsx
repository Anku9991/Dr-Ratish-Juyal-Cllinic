"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { Alert, buttonStyles, inputClass } from "../ui";

export function AmendPrescription({ prescriptionId }: { prescriptionId: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await api<{ appointmentId: string | null }>(`/api/doctor/prescriptions/${prescriptionId}/amend`, "POST", { reason });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    if (res.data.appointmentId) router.push(`/doctor/appointments/${res.data.appointmentId}`);
    else router.refresh();
  }

  return (
    <>
      <button type="button" className={buttonStyles.secondary} onClick={() => dialog.current?.showModal()}>
        Amend
      </button>
      <dialog ref={dialog} className="w-[min(92vw,28rem)] rounded-2xl border border-line p-0 backdrop:bg-black/40">
        <div className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Amend this prescription</h2>
          <p className="text-sm text-muted">This keeps the original as a superseded record and opens a new draft for you to edit and re-issue.</p>
          <div>
            <label htmlFor="amend-reason" className="mb-1 block text-sm font-medium">
              Reason
            </label>
            <textarea id="amend-reason" rows={2} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonStyles.secondary} onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="button" className={buttonStyles.primary} disabled={busy || reason.trim().length < 5} onClick={submit}>
              {busy ? "Working..." : "Continue"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

export function CancelPrescription({ prescriptionId }: { prescriptionId: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await api(`/api/doctor/prescriptions/${prescriptionId}/cancel`, "POST", { reason });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    dialog.current?.close();
    router.refresh();
  }

  return (
    <>
      <button type="button" className={buttonStyles.danger} onClick={() => dialog.current?.showModal()}>
        Cancel prescription
      </button>
      <dialog ref={dialog} className="w-[min(92vw,28rem)] rounded-2xl border border-line p-0 backdrop:bg-black/40">
        <div className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Cancel this prescription?</h2>
          <p className="text-sm text-muted">This marks it not valid. The patient will no longer be able to use it.</p>
          <div>
            <label htmlFor="cancel-rx-reason" className="mb-1 block text-sm font-medium">
              Reason
            </label>
            <textarea id="cancel-rx-reason" rows={2} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonStyles.secondary} onClick={() => dialog.current?.close()}>
              Keep
            </button>
            <button type="button" className={buttonStyles.danger} disabled={busy || reason.trim().length < 5} onClick={submit}>
              {busy ? "Working..." : "Yes, cancel"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
