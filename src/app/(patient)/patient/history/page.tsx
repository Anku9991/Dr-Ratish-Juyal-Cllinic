import type { Metadata } from "next";
import { requirePageRole, requirePatientId } from "@/lib/auth";
import { getClinicSettings } from "@/lib/clinic";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatDateLong, formatInstant } from "@/lib/time";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Consultation history" };


export default async function HistoryPage() {
  const user = await requirePageRole("patient");
  const patientId = await requirePatientId(user);
  const settings = await getClinicSettings();
  const { data } = await supabaseAdmin()
    .from("consultations")
    .select("id, diagnosis, advice, follow_up_date, finalized_at, appointments!inner(appointment_number, starts_at, doctors!inner(profiles!inner(full_name)))")
    .eq("patient_id", patientId)
    .eq("status", "finalized") // drafts are the doctor's working notes
    .order("finalized_at", { ascending: false });
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    diagnosis: string | null;
    advice: string | null;
    follow_up_date: string | null;
    appointments: { appointment_number: string; starts_at: string; doctors: { profiles: { full_name: string } } };
  }>;

  return (
    <div>
      <PageHeader title="Consultation history" description="Summaries of your completed consultations." />
      {rows.length === 0 ? (
        <EmptyState title="No consultations yet" description="After a doctor completes a consultation, the summary appears here." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <p className="font-medium">{r.appointments.doctors.profiles.full_name}</p>
              <p className="text-sm text-muted">
                {r.appointments.appointment_number} - {formatInstant(r.appointments.starts_at, settings.timezone)}
              </p>
              {r.diagnosis ? (
                <p className="mt-3 text-sm">
                  <span className="text-muted">Diagnosis: </span>
                  {r.diagnosis}
                </p>
              ) : null}
              {r.advice ? <p className="mt-1 whitespace-pre-line text-sm text-muted">{r.advice}</p> : null}
              {r.follow_up_date ? <p className="mt-2 text-sm font-medium">Follow-up: {formatDateLong(r.follow_up_date)}</p> : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
