import type { Metadata } from "next";
import { requirePageRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClinicSettings } from "@/lib/clinic";
import { formatINR, paiseToRupees } from "@/lib/money";
import { formatInstant } from "@/lib/time";
import { EmptyState, PageHeader, PaymentBadge, TableWrap, td, th } from "@/components/ui";
import { RefundForm } from "@/components/client/RefundForm";

export const metadata: Metadata = { title: "Payments" };

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  await requirePageRole("admin");
  const settings = await getClinicSettings();
  let q = supabaseAdmin()
    .from("payments")
    .select("id, receipt_number, amount, status, refunded_amount, refund_required, created_at, verified_at, appointments!inner(appointment_number, patients!inner(patient_code, profiles!inner(full_name))))")
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter === "refund_due") q = q.eq("refund_required", true);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    receipt_number: string;
    amount: number;
    status: string;
    refunded_amount: number;
    refund_required: boolean;
    created_at: string;
    appointments: { appointment_number: string; patients: { patient_code: string; profiles: { full_name: string } } };
  }>;

  return (
    <div>
      <PageHeader title="Payments" description={filter === "refund_due" ? "Showing payments awaiting refund." : undefined} />
      {rows.length === 0 ? (
        <EmptyState title="No payments found" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Receipt</th>
              <th className={th}>Patient</th>
              <th className={th}>Appointment</th>
              <th className={th}>Amount</th>
              <th className={th}>Status</th>
              <th className={th}>Date</th>
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className={td}>{p.receipt_number}</td>
                <td className={td}>
                  {p.appointments.patients.profiles.full_name}
                  <span className="block text-xs text-muted">{p.appointments.patients.patient_code}</span>
                </td>
                <td className={td}>{p.appointments.appointment_number}</td>
                <td className={td}>
                  {formatINR(p.amount)}
                  {p.refunded_amount ? <span className="block text-xs text-muted">Refunded {formatINR(p.refunded_amount)}</span> : null}
                </td>
                <td className={td}>
                  <PaymentBadge status={p.status} />
                  {p.refund_required ? <span className="mt-1 block text-xs font-medium text-red-600">Refund due</span> : null}
                </td>
                <td className={`${td} whitespace-nowrap`}>{formatInstant(p.created_at, settings.timezone)}</td>
                <td className={td}>{["captured", "partially_refunded"].includes(p.status) && p.amount > p.refunded_amount ? <RefundForm paymentId={p.id} maxRupees={paiseToRupees(p.amount - p.refunded_amount)} /> : "-"}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
