import Link from "next/link";
import type { Metadata } from "next";
import { requirePageRole, requirePatientId } from "@/lib/auth";
import { getClinicSettings } from "@/lib/clinic";
import { doctorNameOf, listPatientAppointments, paidPayment } from "@/lib/queries";
import { formatInstant } from "@/lib/time";
import { formatINR } from "@/lib/money";
import { AppointmentBadge, EmptyState, LinkButton, PageHeader, TableWrap, td, th } from "@/components/ui";

export const metadata: Metadata = { title: "My appointments" };

export default async function AppointmentsPage() {
  const user = await requirePageRole("patient");
  const patientId = await requirePatientId(user);
  const [appts, settings] = await Promise.all([listPatientAppointments(patientId), getClinicSettings()]);
  return (
    <div>
      <PageHeader title="My appointments" actions={<LinkButton href="/doctors">Book new</LinkButton>} />
      {appts.length === 0 ? (
        <EmptyState title="You have no appointments yet" description="Once you book, your appointments and receipts appear here." action={<LinkButton href="/doctors">Find a doctor</LinkButton>} />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Appointment</th>
              <th className={th}>Doctor</th>
              <th className={th}>When</th>
              <th className={th}>Status</th>
              <th className={th}>Paid</th>
            </tr>
          </thead>
          <tbody>
            {appts.map((a) => {
              const paid = paidPayment(a);
              return (
                <tr key={a.id}>
                  <td className={td}>
                    <Link href={`/patient/appointments/${a.id}`} className="font-medium text-brand-700 hover:underline">
                      {a.appointment_number}
                    </Link>
                  </td>
                  <td className={td}>{doctorNameOf(a)}</td>
                  <td className={`${td} whitespace-nowrap`}>{formatInstant(a.starts_at, settings.timezone)}</td>
                  <td className={td}>
                    <AppointmentBadge status={a.status} />
                  </td>
                  <td className={td}>{paid ? formatINR(paid.amount) : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
