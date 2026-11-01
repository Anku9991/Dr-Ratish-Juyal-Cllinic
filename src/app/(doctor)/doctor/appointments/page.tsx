import Link from "next/link";
import type { Metadata } from "next";
import { requirePageRole, requireDoctorId } from "@/lib/auth";
import { getClinicSettings } from "@/lib/clinic";
import { listUpcomingAppointments, patientNameOf } from "@/lib/doctor-queries";
import { dateInTz, formatInstant } from "@/lib/time";
import { AppointmentBadge, EmptyState, PageHeader, TableWrap, td, th } from "@/components/ui";

export const metadata: Metadata = { title: "Upcoming appointments" };

export default async function DoctorUpcoming() {
  const user = await requirePageRole("doctor");
  const doctorId = await requireDoctorId(user);
  const settings = await getClinicSettings();
  const today = dateInTz(new Date(), settings.timezone);
  const appts = await listUpcomingAppointments(doctorId, today);
  return (
    <div>
      <PageHeader title="Upcoming appointments" />
      {appts.length === 0 ? (
        <EmptyState title="No upcoming appointments" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Patient</th>
              <th className={th}>When</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {appts.map((a) => (
              <tr key={a.id}>
                <td className={td}>
                  <Link href={`/doctor/appointments/${a.id}`} className="font-medium text-brand-700 hover:underline">
                    {patientNameOf(a)}
                  </Link>
                  <span className="block text-xs text-muted">{a.patients.patient_code}</span>
                </td>
                <td className={`${td} whitespace-nowrap`}>{formatInstant(a.starts_at, settings.timezone)}</td>
                <td className={td}>
                  <AppointmentBadge status={a.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
