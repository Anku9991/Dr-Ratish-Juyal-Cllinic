import Link from "next/link";
import type { Metadata } from "next";
import { requirePageRole } from "@/lib/auth";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { formatRupees } from "@/lib/money";
import { Badge, EmptyState, LinkButton, PageHeader, TableWrap, td, th } from "@/components/ui";
import { CLINIC_DOCTORS } from "@/lib/firebase/data";

export const metadata: Metadata = { title: "Doctors" };

export default async function AdminDoctorsPage() {
  await requirePageRole("admin");
  let rows: Array<{ id: string; doctor_code: string; speciality: string; consultation_fee: number; is_active: boolean; profiles: { full_name: string } }> = [];

  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabaseAdmin().from("doctors").select("id, doctor_code, speciality, consultation_fee, is_active, profiles!inner(full_name)").order("created_at", { ascending: false });
      if (data) rows = data as unknown as typeof rows;
    } catch {
      // offline fallback
    }
  }

  if (rows.length === 0) {
    rows = CLINIC_DOCTORS.map((d) => ({
      id: d.id,
      doctor_code: d.doctor_code,
      speciality: d.speciality,
      consultation_fee: Number(d.consultation_fee),
      is_active: true,
      profiles: { full_name: d.full_name },
    }));
  }
  return (
    <div>
      <PageHeader title="Doctors" actions={<LinkButton href="/admin/doctors/new">Add doctor</LinkButton>} />
      {rows.length === 0 ? (
        <EmptyState title="No doctors yet" action={<LinkButton href="/admin/doctors/new">Add your first doctor</LinkButton>} />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Code</th>
              <th className={th}>Speciality</th>
              <th className={th}>Fee</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td className={td}>
                  <Link href={`/admin/doctors/${d.id}`} className="font-medium text-brand-700 hover:underline">
                    {d.profiles.full_name}
                  </Link>
                </td>
                <td className={td}>{d.doctor_code}</td>
                <td className={td}>{d.speciality}</td>
                <td className={td}>{formatRupees(d.consultation_fee)}</td>
                <td className={td}>
                  <Badge tone={d.is_active ? "success" : "neutral"}>{d.is_active ? "Active" : "Inactive"}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
