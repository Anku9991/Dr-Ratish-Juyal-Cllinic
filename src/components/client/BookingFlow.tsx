"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { SlotPicker } from "./SlotPicker";
import { runCheckout, type CheckoutPayload } from "./razorpay";
import { Alert, Field, buttonStyles, inputClass } from "../ui";
import { formatDateLong, formatTime12 } from "@/lib/time";

interface Props {
  doctorId: string;
  doctorName: string;
  feeLabel: string;
  clinicName: string;
  today: string;
  horizonDays: number;
  initialDate: string | null;
  initialTime: string | null;
}

interface Hold {
  holdToken: string;
  expiresAt: string;
}

export function BookingFlow({ doctorId, doctorName, feeLabel, clinicName, today, horizonDays, initialDate, initialTime }: Props) {
  const router = useRouter();
  const [date, setDate] = useState<string | null>(initialDate);
  const [time, setTime] = useState<string | null>(initialTime);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ appointmentId: string; expiresAt: string | null } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!pending?.expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pending?.expiresAt]);

  const secondsLeft = pending?.expiresAt ? Math.max(0, Math.floor((new Date(pending.expiresAt).getTime() - now) / 1000)) : null;
  const expired = secondsLeft === 0;

  async function pay(existing?: CheckoutPayload) {
    if (!date || !time) return;
    setBusy(true);
    setError(null);
    try {
      let order = existing;
      if (!order) {
        const hold = await api<Hold>("/api/booking/hold", "POST", { doctorId, date, startTime: time });
        if (!hold.ok) {
          setBusy(false);
          setError(hold.message);
          if (hold.status === 409) setTime(null);
          return;
        }
        const checkout = await api<CheckoutPayload>("/api/booking/checkout", "POST", { holdToken: hold.data.holdToken, reason });
        if (!checkout.ok) {
          setBusy(false);
          setError(checkout.message);
          return;
        }
        order = checkout.data;
        setPending({ appointmentId: order.appointmentId, expiresAt: order.expiresAt });
        setNow(Date.now());
      }
      const outcome = await runCheckout(order, clinicName, `${doctorName} - ${formatDateLong(date)}, ${formatTime12(time)}`);
      if (outcome.kind === "paid") return router.push(`/patient/payment-status/${outcome.appointmentId}`);
      if (outcome.kind === "dismissed") setError("Payment was not completed. Your slot is held for a few minutes, so you can try again.");
      else setError(outcome.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
    setBusy(false);
  }

  async function retry() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    const res = await api<CheckoutPayload>(`/api/appointments/${pending.appointmentId}/pay`, "POST", {});
    setBusy(false);
    if (!res.ok) return setError(res.message);
    await pay(res.data);
  }

  async function release() {
    if (!pending) return;
    await api(`/api/appointments/${pending.appointmentId}/cancel`, "POST", {});
    setPending(null);
    setError(null);
    setTime(null);
  }

  const canPay = Boolean(date && time) && !busy;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-base font-semibold">1. Date and time</h2>
        <SlotPicker
          doctorId={doctorId}
          today={today}
          horizonDays={horizonDays}
          date={date}
          time={time}
          onSelect={(d, t) => {
            if (pending) return;
            setDate(d);
            setTime(t);
            setError(null);
          }}
        />
      </div>

      <div>
        <h2 className="mb-2 text-base font-semibold">2. Reason for visit (optional)</h2>
        <Field label="What would you like the doctor to know?" htmlFor="reason">
          <textarea id="reason" rows={3} maxLength={500} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} disabled={Boolean(pending)} />
        </Field>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {pending ? (
        <Alert tone={expired ? "warning" : "info"} title={expired ? "Your slot reservation expired" : "Slot reserved for you"}>
          {expired ? (
            "Please choose a time again."
          ) : (
            <>Complete the payment within {Math.floor((secondsLeft ?? 0) / 60)}:{String((secondsLeft ?? 0) % 60).padStart(2, "0")} to confirm the appointment.</>
          )}
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {!pending ? (
          <button type="button" className={buttonStyles.primary} disabled={!canPay} onClick={() => pay()}>
            {busy ? "Please wait..." : `Pay ${feeLabel} and book`}
          </button>
        ) : expired ? (
          <button type="button" className={buttonStyles.primary} onClick={() => { setPending(null); setTime(null); setError(null); }}>
            Choose another time
          </button>
        ) : (
          <>
            <button type="button" className={buttonStyles.primary} disabled={busy} onClick={retry}>
              {busy ? "Please wait..." : "Try payment again"}
            </button>
            <button type="button" className={buttonStyles.secondary} disabled={busy} onClick={release}>
              Release this slot
            </button>
          </>
        )}
        {date && time ? (
          <p className="text-sm text-muted">
            {formatDateLong(date)} at {formatTime12(time)}
          </p>
        ) : null}
      </div>
      <p className="text-xs text-muted">Your appointment is confirmed only after the payment is verified. Payments are processed securely by Razorpay.</p>
    </div>
  );
}
