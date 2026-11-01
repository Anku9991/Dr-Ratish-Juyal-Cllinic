import type { Metadata } from "next";
import { requirePageRole } from "@/lib/auth";
import { getClinicSettings } from "@/lib/clinic";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatInstant } from "@/lib/time";
import { EmptyState, PageHeader, TableWrap, td, th } from "@/components/ui";

export const metadata: Metadata = { title: "Audit logs" };

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePageRole("admin");
  const { q } = await searchParams;
  const settings = await getClinicSettings();
  let query = supabaseAdmin().from("audit_logs").select("id, action, entity_type, entity_id, created_at, profiles(full_name)").order("created_at", { ascending: false }).limit(200);
  if (q?.trim()) query = query.ilike("action", `%${q.trim()}%`);
  const { data } = await query;
  const rows = (data ?? []) as unknown as Array<{ id: string; action: string; entity_type: string; entity_id: string | null; created_at: string; profiles: { full_name: string } | null }>;

  return (
    <div>
      <PageHeader title="Audit logs" description="A record of sensitive actions across the system." />
      <form method="get" className="mb-4 flex gap-2">
        <input name="q" defaultValue={q ?? ""} placeholder="Filter by action, e.g. prescription" className="w-full max-w-xs rounded-lg border border-line bg-white px-3 py-2 text-sm sm:w-auto" />
        <button className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">Filter</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No audit entries found" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>When</th>
              <th className={th}>Actor</th>
              <th className={th}>Action</th>
              <th className={th}>Entity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={`${td} whitespace-nowrap`}>{formatInstant(r.created_at, settings.timezone)}</td>
                <td className={td}>{r.profiles?.full_name ?? "System"}</td>
                <td className={td}>{r.action}</td>
                <td className={td}>
                  {r.entity_type}
                  {r.entity_id ? <span className="text-muted"> #{r.entity_id.slice(0, 8)}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
