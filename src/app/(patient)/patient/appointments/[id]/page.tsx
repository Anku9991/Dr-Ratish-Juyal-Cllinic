import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { requirePageRole, requirePatientId } from "@/lib/auth";
import { getClinicSettings } from "@/lib/clinic";
import { doctorNameOf, getPatientAppointment, latestPayment, paidPayment } from "@/lib/queries";
import { formatINR } from "@/lib/money";
import { formatInstant } from "@/lib/time";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Alert, AppointmentBadge, Card, DefinitionList, LinkButton, PageHeader, PaymentBadge } from "@/components/ui";
import { CancelAppointment } from "@/components/client/CancelAppointment";
import { RetryPayment } from "@/components/client/RetryPayment";

export const metadata: Metadata = { title: "Appointment details" };

export default async function AppointmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const user = await requirePageRole("patient");
  const patientId = await requirePatientId(user);
  const [a, settings] = await Promise.all([getPatientAppointment(id, patientId), getClinicSettings()]);
  if (!a) notFound();

  const paid = paidPayment(a);
  const last = latestPayment(a);
  const { data: rx } = await supabaseAdmin()
    .from("prescriptions")
    .select("id, prescription_number")
    .eq("patient_id", patientId)
    .eq("status", "issued")
    .in("consultation_id", (await supabaseAdmin().from("consultations").select("id").eq("appointment_id", a.id)).data?.map((c) => c.id as string) ?? []);
  const hoursLeft = (new Date(a.starts_at).getTime() - Date.now()) / 3_600_000;
  const canCancel = ["pending_payment", "confirmed"].includes(a.status);
  const payable = a.status === "pending_payment" && (!a.payment_expires_at || new Date(a.payment_expires_at).getTime() > Date.now());

  return (
    <div className="space-y-6">
      <PageHeader title={`Appointment ${a.appointment_number}`} actions={<AppointmentBadge status={a.status} />} />
      <Card>
        <DefinitionList
          items={[
            ["Doctor", doctorNameOf(a)],
            ["Speciality", a.doctors.speciality],
            ["When", formatInstant(a.starts_at, settings.timezone)],
            ["Reason for visit", a.reason],
          ]}
        />
      </Card>

      {a.status === "pending_payment" ? (
        <Card className="space-y-3">
          <h2 className="font-semibold">Payment pending</h2>
          {payable ? (
            <>
              <p className="text-sm text-muted">Your slot is held for a few minutes. It is confirmed once the payment is verified.</p>
              <RetryPayment appointmentId={a.id} clinicName={settings.clinic_name ?? "Clinic"} description={`Appointment ${a.appointment_number}`} />
            </>
          ) : (
            <Alert tone="warning">The payment window has ended. Please book a new time.</Alert>
          )}
        </Card>
      ) : null}

      {a.status === "expired" ? <Alert tone="warning" title="This booking expired">The payment was not completed in time, so the slot was released. If money was deducted it will be refunded automatically.</Alert> : null}
      {a.status === "cancelled" ? <Alert tone="danger" title="Appointment cancelled">{a.cancel_reason ?? "This appointment was cancelled."}</Alert> : null}

      <Card className="space-y-3">
        <h2 className="font-semibold">Payment</h2>
        {last ? (
          <DefinitionList
            items={[
              ["Amount", formatINR(last.amount)],
              ["Status", <PaymentBadge key="s" status={last.status} />],
              ["Receipt number", last.receipt_number],
              ["Refunded", last.refunded_amount ? formatINR(last.refunded_amount) : "-"],
            ]}
          />
        ) : (
          <p className="text-sm text-muted">No payment has been started for this appointment.</p>
        )}
        {paid ? <LinkButton href={`/patient/appointments/${a.id}/receipt`} variant="secondary">View receipt</LinkButton> : null}
      </Card>

      {rx && rx.length > 0 ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Prescription</h2>
            <p className="text-sm text-muted">{rx[0]?.prescription_number}</p>
          </div>
          <LinkButton href={`/patient/prescriptions/${rx[0]?.id}`}>View prescription</LinkButton>
        </Card>
      ) : null}

      {canCancel ? (
        <div>
          <CancelAppointment appointmentId={a.id} paid={Boolean(paid)} refundEligible={hoursLeft >= settings.cancellation_window_hours} />
        </div>
      ) : null}
    </div>
  );
}
