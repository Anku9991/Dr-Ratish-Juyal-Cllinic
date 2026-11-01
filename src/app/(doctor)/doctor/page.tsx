import Link from "next/link";
import type { Metadata } from "next";
import { requirePageRole, requireDoctorId } from "@/lib/auth";
import { getClinicSettings } from "@/lib/clinic";
import { listTodayAppointments, patientNameOf } from "@/lib/doctor-queries";
import { dateInTz, formatDateLong, formatTime12, ageFromDob } from "@/lib/time";
import { AppointmentBadge, Card, EmptyState, PageHeader } from "@/components/ui";
import { StartConsultationButton } from "@/components/client/DoctorActions";

export const metadata: Metadata = { title: "Today's appointments" };
export const dynamic = "force-dynamic";

export default async function DoctorToday() {
  const user = await requirePageRole("doctor");
  const doctorId = await requireDoctorId(user);
  const settings = await getClinicSettings();
  const today = dateInTz(new Date(), settings.timezone);
  const appts = await listTodayAppointments(doctorId, today);
  const queue = appts.filter((a) => a.status !== "completed" && a.status !== "no_show");
  const done = appts.filter((a) => a.status === "completed" || a.status === "no_show");

  return (
    <div className="space-y-8">
      <PageHeader title="Today" description={formatDateLong(today)} />
      <section>
        <h2 className="mb-3 text-lg font-semibold">Queue</h2>
        {queue.length === 0 ? (
          <EmptyState title="No appointments waiting" description="Confirmed appointments for today will appear here." />
        ) : (
          <div className="space-y-3">
            {queue.map((a) => (
              <Card key={a.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{patientNameOf(a)}</p>
                  <p className="text-sm text-muted">
                    {a.patients.patient_code} - {formatTime12(a.start_time.slice(0, 5))}
                    {ageFromDob(a.patients.date_of_birth) !== null ? ` - ${ageFromDob(a.patients.date_of_birth)} yrs` : ""}
                    {a.patients.gender ? `, ${a.patients.gender}` : ""}
                  </p>
                  {a.reason ? <p className="mt-1 text-sm text-muted">&quot;{a.reason}&quot;</p> : null}
                </div>
                <div className="flex items-center gap-3">
                  <AppointmentBadge status={a.status} />
                  <StartConsultationButton appointmentId={a.id} status={a.status} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
      {done.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Completed today</h2>
          <div className="space-y-2">
            {done.map((a) => (
              <Link key={a.id} href={`/doctor/appointments/${a.id}`} className="flex items-center justify-between rounded-[14px] border border-line bg-white p-3 text-sm hover:border-brand-500">
                <span>{patientNameOf(a)}</span>
                <AppointmentBadge status={a.status} />
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
