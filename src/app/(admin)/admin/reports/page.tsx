import type { Metadata } from "next";
import { requirePageRole } from "@/lib/auth";
import { getClinicSettings } from "@/lib/clinic";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { addDays, dateInTz, formatDateLong } from "@/lib/time";
import { formatINR } from "@/lib/money";
import { Card, PageHeader, TableWrap, td, th } from "@/components/ui";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requirePageRole("admin");
  const settings = await getClinicSettings();
  const today = dateInTz(new Date(), settings.timezone);
  const { from, to } = await searchParams;
  const rangeFrom = from || addDays(today, -29);
  const rangeTo = to || today;

  const admin = supabaseAdmin();
  const [{ data: appts }, { data: payments }, { data: byDoctor }] = await Promise.all([
    admin.from("appointments").select("status").gte("appointment_date", rangeFrom).lte("appointment_date", rangeTo),
    admin.from("payments").select("amount, status, refunded_amount").gte("created_at", `${rangeFrom}T00:00:00Z`).lt("created_at", `${addDays(rangeTo, 1)}T00:00:00Z`),
    admin
      .from("appointments")
      .select("doctor_id, status, doctors!inner(speciality, profiles!inner(full_name))")
      .gte("appointment_date", rangeFrom)
      .lte("appointment_date", rangeTo)
      .in("status", ["completed", "confirmed", "checked_in", "in_consultation"]),
  ]);

  const apptCounts = new Map<string, number>();
  for (const a of appts ?? []) apptCounts.set(a.status as string, (apptCounts.get(a.status as string) ?? 0) + 1);

  const revenue = (payments ?? []).filter((p) => ["captured", "refunded", "partially_refunded"].includes(p.status as string)).reduce((s, p) => s + (p.amount as number), 0);
  const refunds = (payments ?? []).reduce((s, p) => s + (p.refunded_amount as number), 0);

  const doctorAgg = new Map<string, { name: string; speciality: string; count: number }>();
  for (const row of (byDoctor ?? []) as unknown as Array<{ doctor_id: string; doctors: { speciality: string; profiles: { full_name: string } } }>) {
    const key = row.doctor_id;
    const cur = doctorAgg.get(key) ?? { name: row.doctors.profiles.full_name, speciality: row.doctors.speciality, count: 0 };
    cur.count += 1;
    doctorAgg.set(key, cur);
  }
  const doctorRows = [...doctorAgg.values()].sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description={`${formatDateLong(rangeFrom)} to ${formatDateLong(rangeTo)}`} />
      <form method="get" className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="from" className="mb-1 block text-xs font-medium text-muted">
            From
          </label>
          <input id="from" type="date" name="from" defaultValue={rangeFrom} className="rounded-lg border border-line bg-white px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="to" className="mb-1 block text-xs font-medium text-muted">
            To
          </label>
          <input id="to" type="date" name="to" defaultValue={rangeTo} max={today} className="rounded-lg border border-line bg-white px-3 py-2 text-sm" />
        </div>
        <button className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">Update</button>
      </form>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">Revenue collected</p>
          <p className="mt-1 text-2xl font-semibold">{formatINR(revenue)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Refunded</p>
          <p className="mt-1 text-2xl font-semibold">{formatINR(refunds)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Net</p>
          <p className="mt-1 text-2xl font-semibold">{formatINR(revenue - refunds)}</p>
        </Card>
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Appointments by status</h2>
        <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {[...apptCounts.entries()].map(([status, count]) => (
            <li key={status} className="rounded-lg border border-line p-3">
              <span className="block text-xs capitalize text-muted">{status.replace("_", " ")}</span>
              <span className="text-lg font-semibold">{count}</span>
            </li>
          ))}
          {apptCounts.size === 0 ? <li className="text-muted">No appointments in this range.</li> : null}
        </ul>
      </Card>
      <div>
        <h2 className="mb-3 text-lg font-semibold">By doctor</h2>
        {doctorRows.length === 0 ? (
          <p className="text-sm text-muted">No data for this range.</p>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th className={th}>Doctor</th>
                <th className={th}>Speciality</th>
                <th className={th}>Appointments</th>
              </tr>
            </thead>
            <tbody>
              {doctorRows.map((d) => (
                <tr key={d.name}>
                  <td className={td}>{d.name}</td>
                  <td className={td}>{d.speciality}</td>
                  <td className={td}>{d.count}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </div>
    </div>
  );
}
