import { notFound } from "next/navigation";
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

export const metadata: Metadata = { title: "Payment status" };
export const dynamic = "force-dynamic";

export default async function PaymentStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const user = await requirePageRole("patient");
  const patientId = await requirePatientId(user);
  const [a, settings] = await Promise.all([getPatientAppointment(id, patientId), getClinicSettings()]);
  if (!a) notFound();
  const last = latestPayment(a);
  const captured = last && ["captured", "refunded", "partially_refunded"].includes(last.status);
  const payable = a.status === "pending_payment" && (!a.payment_expires_at || new Date(a.payment_expires_at).getTime() > Date.now());

  return (
    <div className="max-w-xl space-y-5">
      <PageHeader title="Payment status" />
      {a.status === "confirmed" || a.status === "checked_in" || a.status === "in_consultation" || a.status === "completed" ? (
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
      <Card className="space-y-3">
        {payable ? <RetryPayment appointmentId={a.id} clinicName={settings.clinic_name ?? "Clinic"} description={`Appointment ${a.appointment_number}`} label="Try payment again" /> : null}
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/patient/appointments/${a.id}`} variant="secondary">
            Appointment details
          </LinkButton>
          {captured ? (
            <LinkButton href={`/patient/appointments/${a.id}/receipt`} variant="secondary">
              Receipt
            </LinkButton>
          ) : null}
          {!payable && !captured ? <LinkButton href="/doctors">Book another time</LinkButton> : null}
        </div>
      </Card>
    </div>
  );
}
