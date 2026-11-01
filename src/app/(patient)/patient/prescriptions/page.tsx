import Link from "next/link";
import type { Metadata } from "next";
import { requirePageRole, requirePatientId } from "@/lib/auth";
import { getClinicSettings } from "@/lib/clinic";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatInstant } from "@/lib/time";
import { EmptyState, PageHeader, TableWrap, td, th } from "@/components/ui";

export const metadata: Metadata = { title: "Prescriptions" };

export default async function PrescriptionsPage() {
  const user = await requirePageRole("patient");
  const patientId = await requirePatientId(user);
  const settings = await getClinicSettings();
  const { data } = await supabaseAdmin()
    .from("prescriptions")
    .select("id, prescription_number, issued_at, doctors!inner(speciality, profiles!inner(full_name))")
    .eq("patient_id", patientId)
    .eq("status", "issued")
    .order("issued_at", { ascending: false });
  const rows = (data ?? []) as unknown as Array<{ id: string; prescription_number: string; issued_at: string; doctors: { speciality: string; profiles: { full_name: string } } }>;
  return (
    <div>
      <PageHeader title="Prescriptions" description="Prescriptions issued by your doctors." />
      {rows.length === 0 ? (
        <EmptyState title="No prescriptions yet" description="When a doctor issues a prescription after your consultation, it appears here as a PDF." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Prescription</th>
              <th className={th}>Doctor</th>
              <th className={th}>Issued</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={td}>
                  <Link className="font-medium text-brand-700 hover:underline" href={`/patient/prescriptions/${r.id}`}>
                    {r.prescription_number}
                  </Link>
                </td>
                <td className={td}>
                  {r.doctors.profiles.full_name}
                  <span className="block text-xs text-muted">{r.doctors.speciality}</span>
                </td>
                <td className={`${td} whitespace-nowrap`}>{formatInstant(r.issued_at, settings.timezone)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
