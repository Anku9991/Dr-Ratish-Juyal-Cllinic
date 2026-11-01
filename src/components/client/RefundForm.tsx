"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { Alert, buttonStyles, inputClass } from "../ui";

export function RefundForm({ paymentId, maxRupees }: { paymentId: string; maxRupees: number }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [amount, setAmount] = useState(String(maxRupees));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await api(`/api/admin/payments/${paymentId}/refund`, "POST", { amountRupees: Number(amount), reason });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    dialog.current?.close();
    router.refresh();
  }

  return (
    <>
      <button type="button" className={buttonStyles.secondary} onClick={() => dialog.current?.showModal()}>
        Refund
      </button>
      <dialog ref={dialog} className="w-[min(92vw,26rem)] rounded-2xl border border-line p-0 backdrop:bg-black/40">
        <div className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Refund payment</h2>
          <div>
            <label htmlFor="refund-amount" className="mb-1 block text-sm font-medium">
              Amount (INR, max {maxRupees.toFixed(2)})
            </label>
            <input id="refund-amount" type="number" step="0.01" max={maxRupees} min={0.01} className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label htmlFor="refund-reason" className="mb-1 block text-sm font-medium">
              Reason
            </label>
            <textarea id="refund-reason" rows={2} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonStyles.secondary} onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="button" className={buttonStyles.primary} disabled={busy || reason.trim().length < 3} onClick={submit}>
              {busy ? "Processing..." : "Process refund"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
