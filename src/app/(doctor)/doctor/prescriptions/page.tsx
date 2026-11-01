import Link from "next/link";
import type { Metadata } from "next";
import { requirePageRole, requireDoctorId } from "@/lib/auth";
import { getClinicSettings } from "@/lib/clinic";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatInstant } from "@/lib/time";
import { Badge, EmptyState, PageHeader, TableWrap, td, th } from "@/components/ui";

export const metadata: Metadata = { title: "Issued prescriptions" };

export default async function DoctorPrescriptionsPage() {
  const user = await requirePageRole("doctor");
  const doctorId = await requireDoctorId(user);
  const settings = await getClinicSettings();
  const { data } = await supabaseAdmin()
    .from("prescriptions")
    .select("id, prescription_number, status, issued_at, patients!inner(patient_code, profiles!inner(full_name))")
    .eq("doctor_id", doctorId)
    .neq("status", "draft")
    .order("issued_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as Array<{ id: string; prescription_number: string; status: string; issued_at: string; patients: { patient_code: string; profiles: { full_name: string } } }>;
  return (
    <div>
      <PageHeader title="Issued prescriptions" />
      {rows.length === 0 ? (
        <EmptyState title="No prescriptions issued yet" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Prescription</th>
              <th className={th}>Patient</th>
              <th className={th}>Issued</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={td}>
                  <Link href={`/doctor/prescriptions/${r.id}`} className="font-medium text-brand-700 hover:underline">
                    {r.prescription_number}
                  </Link>
                </td>
                <td className={td}>
                  {r.patients.profiles.full_name}
                  <span className="block text-xs text-muted">{r.patients.patient_code}</span>
                </td>
                <td className={`${td} whitespace-nowrap`}>{r.issued_at ? formatInstant(r.issued_at, settings.timezone) : "-"}</td>
                <td className={td}>
                  <Badge tone={r.status === "issued" ? "success" : r.status === "amended" ? "warning" : "danger"}>{r.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
