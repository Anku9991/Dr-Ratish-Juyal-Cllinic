import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { z } from "zod";
import { requirePageRole, requirePatientId } from "@/lib/auth";
import { getClinicSettings } from "@/lib/clinic";
import { doctorNameOf, getPatientAppointment, latestPayment } from "@/lib/queries";
import { formatINR } from "@/lib/money";
import { formatInstant } from "@/lib/time";
import { Alert, Card, LinkButton, PageHeader } from "@/components/ui";
import { RetryPayment } from "@/components/client/RetryPayment";
import { AutoRefresh } from "@/components/client/AutoRefresh";
import { Banknote, CheckCircle2, Clock, Tv } from "lucide-react";

export const metadata: Metadata = { title: "Payment & Booking Status" };
export const dynamic = "force-dynamic";

export default async function PaymentStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const user = await requirePageRole("patient");
  const patientId = await requirePatientId(user);
  const [a, settings] = await Promise.all([getPatientAppointment(id, patientId), getClinicSettings()]);
  if (!a) notFound();

  const last = latestPayment(a);
  const isCashAtCounter = last?.failure_reason === "Pay at Clinic Counter (Cash)" || (a as unknown as { payment_method?: string }).payment_method === "cash";
  const captured = last && ["captured", "refunded", "partially_refunded"].includes(last.status);
  const isConfirmed = a.status === "confirmed" || a.status === "checked_in" || a.status === "in_consultation" || a.status === "completed";
  const payable = a.status === "pending_payment" && (!a.payment_expires_at || new Date(a.payment_expires_at).getTime() > Date.now());

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Appointment & Payment Status" />

      {/* Confirmed - Cash at Counter Special Display */}
      {isConfirmed && isCashAtCounter ? (
        <div className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 via-white to-teal-50/40 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-emerald-950">Appointment Confirmed!</h2>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 mt-0.5">
                <Banknote className="h-4 w-4" />
                <span>Payment Mode: Pay in Cash at Clinic Counter</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-xl border border-emerald-200/90 bg-white/90 p-4 text-sm">
            <div>
              <span className="text-muted block text-xs font-medium">Consulting Doctor</span>
              <span className="font-semibold text-ink text-base">{doctorNameOf(a)}</span>
              <span className="text-xs text-muted block">{a.doctors.speciality}</span>
            </div>
            <div>
              <span className="text-muted block text-xs font-medium">Appointment Number</span>
              <span className="font-bold text-brand-700 text-base">{a.appointment_number}</span>
              <span className="text-xs text-emerald-700 font-medium block">Status: Confirmed Slot</span>
            </div>
            <div>
              <span className="text-muted block text-xs font-medium">OPD Session</span>
              <span className="font-semibold text-ink">{formatInstant(a.starts_at, settings.timezone)}</span>
            </div>
            <div>
              <span className="text-muted block text-xs font-medium">Amount to Pay at Desk</span>
              <span className="font-bold text-emerald-700 text-base">{formatINR(last?.amount ?? 100000)}</span>
              <span className="text-[11px] text-muted block">Direct Cash / Counter</span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-amber-900">
              <Clock className="h-4 w-4 text-amber-700" />
              <span>OPD Instructions (12:00 PM – 05:00 PM)</span>
            </div>
            <p className="leading-relaxed">
              Please arrive 15 minutes before your consultation at <strong>Dr. Ratish Juyal Clinic, Lucknow</strong>. Pay the consultation fee in cash at the reception desk to collect your consultation slip and token.
            </p>
          </div>
        </div>
      ) : isConfirmed ? (
        <Alert tone="success" title="Payment received - your appointment is confirmed">
          {doctorNameOf(a)} on {formatInstant(a.starts_at, settings.timezone)}. {last ? `Receipt ${last.receipt_number}, ${formatINR(last.amount)}.` : null}
        </Alert>
      ) : a.status === "pending_payment" && captured ? (
        <Alert tone="info" title="Payment received, confirming your slot">
          This normally takes a few seconds.
          <AutoRefresh seconds={4} />
        </Alert>
      ) : a.status === "pending_payment" ? (
        <Alert tone={last?.status === "failed" ? "danger" : "warning"} title={last?.status === "failed" ? "Payment failed" : "Payment not completed"}>
          {last?.failure_reason ?? "We have not received your payment yet."} {payable ? "Your slot is still held, so you can try again." : ""}
        </Alert>
      ) : a.status === "cancelled" && captured ? (
        <Alert tone="warning" title="Payment received but the slot was no longer available">
          Your payment will be refunded in full by the clinic. Please choose another time.
        </Alert>
      ) : (
        <Alert tone="warning" title="This booking is not active">
          The slot reservation ended. If money was deducted, it is refunded automatically.
        </Alert>
      )}

      {/* Action Buttons */}
      <Card className="space-y-4">
        {payable ? (
          <RetryPayment
            appointmentId={a.id}
            clinicName={settings.clinic_name ?? "Clinic"}
            description={`Appointment ${a.appointment_number}`}
            label="Try payment again"
          />
        ) : null}

        <div className="flex flex-wrap gap-2.5">
          <LinkButton href={`/patient/appointments/${a.id}`} className="font-semibold shadow-xs">
            View Appointment Details
          </LinkButton>
          <Link
            href="/queue"
            target="_blank"
            className="rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5 text-slate-700"
          >
            <Tv className="h-4 w-4 text-brand-600" />
            <span>Open Waiting TV</span>
          </Link>
          {captured ? (
            <LinkButton href={`/patient/appointments/${a.id}/receipt`} variant="secondary">
              Receipt
            </LinkButton>
          ) : null}
          <LinkButton href="/patient" variant="ghost">
            Back to Dashboard
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}
