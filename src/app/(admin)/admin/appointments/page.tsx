import type { Metadata } from "next";
import { requirePageRole } from "@/lib/auth";
import { getClinicSettings } from "@/lib/clinic";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatInstant, dateInTz } from "@/lib/time";
import { AppointmentBadge, EmptyState, PageHeader, TableWrap, td, th } from "@/components/ui";
import { AdminStatusControls } from "@/components/client/AdminStatusControls";
import type { AppointmentStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Appointments" };
const STATUSES: AppointmentStatus[] = ["pending_payment", "confirmed", "checked_in", "in_consultation", "completed", "cancelled", "no_show", "expired"];

import { clinicStore } from "@/lib/appointments-store";

export default async function AdminAppointmentsPage({ searchParams }: { searchParams: Promise<{ status?: string; date?: string }> }) {
  const { status, date } = await searchParams;
  await requirePageRole("admin");
  const settings = await getClinicSettings();
  const today = dateInTz(new Date(), settings.timezone);
  const filterDate = date ?? today;

  const localRows = clinicStore.listAll(filterDate, status).map((a) => ({
    id: a.id,
    appointment_number: a.appointment_number,
    starts_at: a.starts_at,
    status: a.status,
    doctors: { profiles: { full_name: a.doctor_name } },
    patients: { patient_code: a.patient_code, profiles: { full_name: a.patient_name } },
  }));

  let dbRows: typeof localRows = [];
  try {
    let q = supabaseAdmin()
      .from("appointments")
      .select("id, appointment_number, starts_at, status, appointment_date, doctors!inner(profiles!inner(full_name)), patients!inner(patient_code, profiles!inner(full_name))")
      .eq("appointment_date", filterDate)
      .order("starts_at");
    if (status && STATUSES.includes(status as AppointmentStatus)) q = q.eq("status", status);
    const { data } = await q;
    if (data) dbRows = data as unknown as typeof localRows;
  } catch {
    // offline fallback
  }

  const rows = [...localRows, ...dbRows];

  return (
    <div>
      <PageHeader title="Appointments" />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="date" className="mb-1 block text-xs font-medium text-muted">
            Date
          </label>
          <input id="date" type="date" name="date" defaultValue={filterDate} className="rounded-lg border border-line bg-white px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-xs font-medium text-muted">
            Status
          </label>
          <select id="status" name="status" defaultValue={status ?? ""} className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <button className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">Filter</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No appointments for this filter" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Appointment</th>
              <th className={th}>Patient</th>
              <th className={th}>Doctor</th>
              <th className={th}>When</th>
              <th className={th}>Status</th>
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className={td}>{a.appointment_number}</td>
                <td className={td}>
                  {a.patients.profiles.full_name}
                  <span className="block text-xs text-muted">{a.patients.patient_code}</span>
                </td>
                <td className={td}>{a.doctors.profiles.full_name}</td>
                <td className={`${td} whitespace-nowrap`}>{formatInstant(a.starts_at, settings.timezone)}</td>
                <td className={td}>
                  <AppointmentBadge status={a.status} />
                </td>
                <td className={td}>
                  <AdminStatusControls appointmentId={a.id} status={a.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
