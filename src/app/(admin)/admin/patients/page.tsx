import Link from "next/link";
import type { Metadata } from "next";
import { requirePageRole } from "@/lib/auth";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { EmptyState, PageHeader, TableWrap, td, th } from "@/components/ui";

export const metadata: Metadata = { title: "Patients" };

export default async function AdminPatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  await requirePageRole("admin");
  let rows: Array<{ id: string; patient_code: string; profiles: { full_name: string; mobile: string | null; email: string | null; is_active: boolean } }> = [];

  if (isSupabaseConfigured()) {
    try {
      let query = supabaseAdmin().from("patients").select("id, patient_code, profiles!inner(full_name, mobile, email, is_active)").order("created_at", { ascending: false }).limit(100);
      const term = q?.trim().replace(/[,()]/g, "");
      if (term) {
        query = query.or(`patient_code.ilike.%${term}%,profiles.full_name.ilike.%${term}%,profiles.mobile.ilike.%${term}%`);
      }
      const { data } = await query;
      if (data) rows = data as unknown as typeof rows;
    } catch {
      // offline fallback
    }
  }

  return (
    <div>
      <PageHeader title="Patients" />
      <form method="get" className="mb-4 flex gap-2">
        <input name="q" defaultValue={q ?? ""} placeholder="Search by name, ID or mobile" className="w-full max-w-xs rounded-lg border border-line bg-white px-3 py-2 text-sm sm:w-auto" />
        <button className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">Search</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No patients found" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Patient ID</th>
              <th className={th}>Mobile</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className={td}>
                  <Link href={`/admin/patients/${p.id}`} className="font-medium text-brand-700 hover:underline">
                    {p.profiles.full_name}
                  </Link>
                </td>
                <td className={td}>{p.patient_code}</td>
                <td className={td}>{p.profiles.mobile ?? "-"}</td>
                <td className={td}>{p.profiles.is_active ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
