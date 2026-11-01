"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { SlotPicker } from "./SlotPicker";
import { runCheckout, type CheckoutPayload } from "./razorpay";
import { Alert, Field, buttonStyles, inputClass } from "../ui";
import { formatDateLong, formatTime12 } from "@/lib/time";
import { Banknote, CreditCard, QrCode, CheckCircle2, ShieldCheck, Clock } from "lucide-react";

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

type PaymentOption = "cash" | "card" | "razorpay";

export function BookingFlow({
  doctorId,
  doctorName,
  feeLabel,
  clinicName,
  today,
  horizonDays,
  initialDate,
  initialTime,
}: Props) {
  const router = useRouter();
  const [date, setDate] = useState<string | null>(initialDate);
  const [time, setTime] = useState<string | null>(initialTime);
  const [reason, setReason] = useState("");
  const [paymentOption, setPaymentOption] = useState<PaymentOption>("cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ appointmentId: string; expiresAt: string | null } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!pending?.expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pending?.expiresAt]);

  const secondsLeft = pending?.expiresAt
    ? Math.max(0, Math.floor((new Date(pending.expiresAt).getTime() - now) / 1000))
    : null;
  const expired = secondsLeft === 0;

  // Handle Cash at Counter or Card Direct Booking
  async function handleDirectBooking(method: "cash" | "card") {
    if (!date || !time) return;
    setBusy(true);
    setError(null);

    try {
      const res = await api<{
        appointmentId: string;
        appointmentNumber: string;
        token: number;
        status: string;
      }>("/api/booking/direct-book", "POST", {
        doctorId,
        date,
        startTime: time,
        reason: reason.trim() || undefined,
        paymentMethod: method,
      });

      if (!res.ok) {
        setError(res.message || "Failed to confirm appointment. Please try again.");
        setBusy(false);
        return;
      }

      // Successfully booked! Redirect to confirmation/status page
      router.push(`/patient/payment-status/${res.data.appointmentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  // Handle Online Razorpay Booking
  async function payWithRazorpay(existing?: CheckoutPayload) {
    if (!date || !time) return;
    setBusy(true);
    setError(null);

    try {
      let order = existing;
      if (!order) {
        // Try hold + checkout
        const hold = await api<Hold>("/api/booking/hold", "POST", { doctorId, date, startTime: time });
        if (!hold.ok) {
          setBusy(false);
          setError(hold.message || "Failed to reserve slot. It may have already been booked.");
          if (hold.status === 409) setTime(null);
          return;
        }

        const checkout = await api<CheckoutPayload>("/api/booking/checkout", "POST", {
          holdToken: hold.data.holdToken,
          reason,
        });

        if (!checkout.ok) {
          setBusy(false);
          setError(checkout.message);
          return;
        }

        order = checkout.data;
        setPending({ appointmentId: order.appointmentId, expiresAt: order.expiresAt });
        setNow(Date.now());
      }

      const outcome = await runCheckout(
        order,
        clinicName,
        `${doctorName} - ${formatDateLong(date)}, ${formatTime12(time)}`
      );

      if (outcome.kind === "paid") {
        return router.push(`/patient/payment-status/${outcome.appointmentId}`);
      }
      if (outcome.kind === "dismissed") {
        setError("Payment was cancelled. You can try again or switch to 'Pay in Cash at Counter'.");
      } else {
        setError(outcome.message);
      }
    } catch {
      // Graceful fallback option
      setError("Online payment gateway could not open. You can confirm instantly with 'Pay at Clinic Counter (Cash)'.");
    }
    setBusy(false);
  }

  async function handleBookingSubmit() {
    if (paymentOption === "cash") {
      await handleDirectBooking("cash");
    } else if (paymentOption === "card") {
      await handleDirectBooking("card");
    } else {
      await payWithRazorpay();
    }
  }

  async function retryRazorpay() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    const res = await api<CheckoutPayload>(`/api/appointments/${pending.appointmentId}/pay`, "POST", {});
    setBusy(false);
    if (!res.ok) return setError(res.message);
    await payWithRazorpay(res.data);
  }

  async function release() {
    if (!pending) return;
    await api(`/api/appointments/${pending.appointmentId}/cancel`, "POST", {});
    setPending(null);
    setError(null);
    setTime(null);
  }

  const canBook = Boolean(date && time) && !busy;

  return (
    <div className="space-y-6">
      {/* 1. Date and Time */}
      <div>
        <h2 className="mb-2 text-base font-semibold text-ink flex items-center gap-2">
          <span>1. Date and time</span>
          <span className="text-xs font-normal text-muted">(12:00 PM – 05:00 PM OPD)</span>
        </h2>
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

      {/* 2. Reason for Visit */}
      <div>
        <h2 className="mb-2 text-base font-semibold text-ink">2. Reason for visit (optional)</h2>
        <Field label="What symptoms or health concern would you like the doctor to know?" htmlFor="reason">
          <textarea
            id="reason"
            rows={2}
            maxLength={500}
            className={inputClass}
            placeholder="e.g. Headache, stroke rehabilitation, back/neck pain, numbness, nerve consultation..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={Boolean(pending)}
          />
        </Field>
      </div>

      {/* 3. Payment Method Selection (Cash, Card, Razorpay) */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-ink flex items-center gap-2">
          <span>3. Choose payment mode</span>
          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            Cash, Card & Online supported
          </span>
        </h2>

        <div className="grid gap-3 sm:grid-cols-3">
          {/* Option 1: Cash at Counter */}
          <button
            type="button"
            onClick={() => {
              setPaymentOption("cash");
              setError(null);
            }}
            className={`relative flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
              paymentOption === "cash"
                ? "border-emerald-600 bg-emerald-50/50 shadow-sm"
                : "border-line bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <Banknote className="h-5 w-5" />
              </div>
              {paymentOption === "cash" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <div className="h-4 w-4 rounded-full border border-slate-300" />
              )}
            </div>
            <div className="inline-block self-start mb-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-emerald-100 text-emerald-800">
              Recommended for OPD
            </div>
            <span className="font-semibold text-sm text-ink">Pay in Cash at Counter</span>
            <span className="mt-1 text-xs text-muted leading-relaxed">
              Pay upon arrival at clinic reception. Instant confirmed booking with Token number.
            </span>
          </button>

          {/* Option 2: Card / POS */}
          <button
            type="button"
            onClick={() => {
              setPaymentOption("card");
              setError(null);
            }}
            className={`relative flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
              paymentOption === "card"
                ? "border-blue-600 bg-blue-50/50 shadow-sm"
                : "border-line bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <CreditCard className="h-5 w-5" />
              </div>
              {paymentOption === "card" ? (
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
              ) : (
                <div className="h-4 w-4 rounded-full border border-slate-300" />
              )}
            </div>
            <div className="inline-block self-start mb-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-blue-100 text-blue-800">
              Card / Swipe POS
            </div>
            <span className="font-semibold text-sm text-ink">Debit / Credit Card</span>
            <span className="mt-1 text-xs text-muted leading-relaxed">
              Pay via Visa, MasterCard or RuPay card at clinic counter or POS machine.
            </span>
          </button>

          {/* Option 3: Razorpay (UPI / QR / NetBanking) */}
          <button
            type="button"
            onClick={() => {
              setPaymentOption("razorpay");
              setError(null);
            }}
            className={`relative flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
              paymentOption === "razorpay"
                ? "border-brand-600 bg-brand-50/50 shadow-sm"
                : "border-line bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                <QrCode className="h-5 w-5" />
              </div>
              {paymentOption === "razorpay" ? (
                <CheckCircle2 className="h-5 w-5 text-brand-600" />
              ) : (
                <div className="h-4 w-4 rounded-full border border-slate-300" />
              )}
            </div>
            <div className="inline-block self-start mb-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-purple-100 text-purple-800">
              UPI / QR Online
            </div>
            <span className="font-semibold text-sm text-ink">Razorpay Online</span>
            <span className="mt-1 text-xs text-muted leading-relaxed">
              Google Pay, PhonePe, Paytm, UPI QR, or NetBanking online.
            </span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="space-y-2">
          <Alert tone="danger">{error}</Alert>
          {paymentOption === "razorpay" ? (
            <button
              type="button"
              onClick={() => {
                setPaymentOption("cash");
                setError(null);
              }}
              className="text-xs font-semibold text-emerald-700 underline hover:text-emerald-800"
            >
              Switch to &apos;Pay in Cash at Counter&apos; instead
            </button>
          ) : null}
        </div>
      ) : null}

      {pending ? (
        <Alert
          tone={expired ? "warning" : "info"}
          title={expired ? "Your slot reservation expired" : "Slot reserved for you"}
        >
          {expired ? (
            "Please choose a time again."
          ) : (
            <>
              Complete the payment within {Math.floor((secondsLeft ?? 0) / 60)}:
              {String((secondsLeft ?? 0) % 60).padStart(2, "0")} to confirm the appointment.
            </>
          )}
        </Alert>
      ) : null}

      {/* Booking CTA Bar */}
      <div className="rounded-xl border border-line bg-slate-50 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs text-muted block">Selected Consultation</span>
            <p className="text-sm font-semibold text-ink">
              {doctorName} • <span className="text-brand-700">{feeLabel}</span>
            </p>
            {date && time ? (
              <p className="text-xs text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {formatDateLong(date)} at {formatTime12(time)}
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!pending ? (
              <button
                type="button"
                className={`${buttonStyles.primary} ${
                  paymentOption === "cash"
                    ? "!bg-emerald-600 hover:!bg-emerald-700"
                    : paymentOption === "card"
                    ? "!bg-blue-600 hover:!bg-blue-700"
                    : "!bg-brand-600 hover:!bg-brand-700"
                } px-5 py-2.5 font-semibold text-sm shadow-sm`}
                disabled={!canBook}
                onClick={handleBookingSubmit}
              >
                {busy
                  ? "Confirming booking..."
                  : paymentOption === "cash"
                  ? `Confirm & Pay ${feeLabel} in Cash at Counter`
                  : paymentOption === "card"
                  ? `Book & Pay ${feeLabel} via Card`
                  : `Pay ${feeLabel} via Razorpay`}
              </button>
            ) : expired ? (
              <button
                type="button"
                className={buttonStyles.primary}
                onClick={() => {
                  setPending(null);
                  setTime(null);
                  setError(null);
                }}
              >
                Choose another time
              </button>
            ) : (
              <>
                <button type="button" className={buttonStyles.primary} disabled={busy} onClick={retryRazorpay}>
                  {busy ? "Please wait..." : "Try payment again"}
                </button>
                <button type="button" className={buttonStyles.secondary} disabled={busy} onClick={release}>
                  Release this slot
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted border-t border-slate-200/80 pt-2.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span>
            {paymentOption === "cash"
              ? "Cash mode: Your slot and queue token are confirmed immediately. Pay at the clinic counter upon arrival."
              : paymentOption === "card"
              ? "Card mode: Slot confirmed. You can swipe your card at clinic counter or pay online."
              : "Razorpay mode: Secure 256-bit encrypted online payment verification."}
          </span>
        </div>
      </div>
    </div>
  );
}
