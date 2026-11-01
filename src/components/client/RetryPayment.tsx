"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { runCheckout, type CheckoutPayload } from "./razorpay";
import { Alert, buttonStyles } from "../ui";

export function RetryPayment({ appointmentId, clinicName, description, label = "Pay now" }: { appointmentId: string; clinicName: string; description: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    const res = await api<CheckoutPayload>(`/api/appointments/${appointmentId}/pay`, "POST", {});
    if (!res.ok) {
      setBusy(false);
      setError(res.message);
      if (res.status === 410 || res.status === 409) router.refresh();
      return;
    }
    try {
      const outcome = await runCheckout(res.data, clinicName, description);
      if (outcome.kind === "paid") return router.push(`/patient/payment-status/${outcome.appointmentId}`);
      if (outcome.kind === "failed" || outcome.kind === "verify_error") setError(outcome.message);
      if (outcome.kind === "dismissed") setError("Payment was not completed. You can try again while your slot is held.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the payment window.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <button type="button" onClick={pay} disabled={busy} className={buttonStyles.primary}>
        {busy ? "Opening payment..." : label}
      </button>
    </div>
  );
}
