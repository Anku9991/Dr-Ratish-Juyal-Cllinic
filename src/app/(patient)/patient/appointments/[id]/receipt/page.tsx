import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requirePageRole, requirePatientId } from "@/lib/auth";
import { getClinicSettings } from "@/lib/clinic";
import { doctorNameOf, getPatientAppointment, paidPayment } from "@/lib/queries";
import { formatINR } from "@/lib/money";
import { formatInstant } from "@/lib/time";
import { Card, DefinitionList, LinkButton, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/client/PrintButton";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Payment receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length < 5) notFound();
  const user = await requirePageRole("patient");
  const patientId = await requirePatientId(user);
  
  let patientCode = "P-101";
  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabaseAdmin().from("patients").select("patient_code").eq("id", patientId).maybeSingle();
      if (data?.patient_code) patientCode = data.patient_code;
    } catch {
      // Offline fallback
    }
  }

  const [a, settings] = await Promise.all([
    getPatientAppointment(id, patientId),
    getClinicSettings(),
  ]);
  const paid = a ? paidPayment(a) : undefined;
  if (!a || !paid) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment receipt"
        actions={
          <div className="no-print flex gap-2">
            <LinkButton href={`/patient/appointments/${a.id}`} variant="secondary">
              Back
            </LinkButton>
            <PrintButton />
          </div>
        }
      />
      <Card className="space-y-5">
        <div>
          <p className="text-lg font-semibold">{settings.clinic_name ?? "Clinic"}</p>
          {settings.address ? <p className="whitespace-pre-line text-sm text-muted">{settings.address}</p> : null}
          {settings.phone ? <p className="text-sm text-muted">{settings.phone}</p> : null}
        </div>
        <DefinitionList
          items={[
            ["Receipt number", paid.receipt_number],
            ["Paid on", paid.verified_at ? formatInstant(paid.verified_at, settings.timezone) : "-"],
            ["Patient", `${user.fullName} (${patientCode})`],
            ["Appointment", `${a.appointment_number} with ${doctorNameOf(a)}`],
            ["Consultation date", formatInstant(a.starts_at, settings.timezone)],
            ["Payment method", paid.failure_reason === "Pay at Clinic Counter (Cash)" ? "Cash (Pay at Clinic Counter)" : (paid.method ? paid.method.toUpperCase() : "Online (Razorpay)")],
            ["Payment status", paid.status === "captured" ? "Paid in Full" : "Pending Cash Collection at Reception Counter"],
            ["Razorpay payment ID", paid.razorpay_payment_id || "-"],
            ["Amount", <span key="amt" className="text-base font-bold text-ink">{formatINR(paid.amount)}</span>],
            ["Refunded", paid.refunded_amount ? formatINR(paid.refunded_amount) : "-"],
          ]}
        />
      </Card>
    </div>
  );
}
