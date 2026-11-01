import Link from "next/link";
import type { Metadata } from "next";
import { requirePageRole, requirePatientId } from "@/lib/auth";
import { getClinicSettings } from "@/lib/clinic";
import { doctorNameOf, listPatientAppointments } from "@/lib/queries";
import { formatInstant } from "@/lib/time";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Alert, AppointmentBadge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };

export default async function PatientDashboard() {
  const user = await requirePageRole("patient");
  const patientId = await requirePatientId(user);
  const [appts, settings] = await Promise.all([
    listPatientAppointments(patientId),
    getClinicSettings(),
  ]);

  let patient: { patient_code?: string; date_of_birth?: string | null; gender?: string | null } | null = null;
  try {
    const res = await supabaseAdmin().from("patients").select("patient_code, date_of_birth, gender").eq("id", patientId).maybeSingle();
    patient = res.data;
  } catch {
    patient = null;
  }

  const now = Date.now();
  const upcoming = appts
    .filter((a) => ["confirmed", "checked_in", "in_consultation", "pending_payment"].includes(a.status) && new Date(a.ends_at).getTime() > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const profileIncomplete = !patient?.date_of_birth || !patient?.gender;

  return (
    <div className="space-y-6">
      <PageHeader title={`Hello, ${user.fullName.split(" ")[0]}`} description={patient ? `Your patient ID is ${patient.patient_code}.` : undefined} actions={<LinkButton href="/doctors">Book an appointment</LinkButton>} />
      {profileIncomplete ? (
        <Alert tone="info" title="Complete your profile">
          Your doctor sees your age and gender on prescriptions.{" "}
          <Link href="/patient/profile" className="font-medium underline">
            Add your details
          </Link>
        </Alert>
      ) : null}
      <section aria-labelledby="up">
        <h2 id="up" className="mb-3 text-lg font-semibold">
          Upcoming appointments
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState title="No upcoming appointments" description="Choose a doctor and a time that suits you." action={<LinkButton href="/doctors">Find a doctor</LinkButton>} />
        ) : (
          <div className="space-y-3">
            {upcoming.map((a) => (
              <Card key={a.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{doctorNameOf(a)}</p>
                  <p className="text-sm text-muted">{a.doctors.speciality}</p>
                  <p className="mt-1 text-sm">{formatInstant(a.starts_at, settings.timezone)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <AppointmentBadge status={a.status} />
                  <LinkButton href={`/patient/appointments/${a.id}`} variant="secondary">
                    View
                  </LinkButton>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
