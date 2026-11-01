import Link from "next/link";
import type { Metadata } from "next";
import { requirePageRole, requirePatientId } from "@/lib/auth";
import { getClinicSettings } from "@/lib/clinic";
import { doctorNameOf, listPatientAppointments } from "@/lib/queries";
import { formatInstant } from "@/lib/time";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { reportsStore } from "@/lib/reports-store";
import { Alert, AppointmentBadge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import {
  Calendar,
  Clock,
  Activity,
  Upload,
  ArrowRight,
  Pill,
} from "lucide-react";

export const metadata: Metadata = { title: "Patient Dashboard — Dr. Ratish Juyal Clinic" };

export default async function PatientDashboard() {
  const user = await requirePageRole("patient");
  const patientId = await requirePatientId(user);
  const [appts, settings] = await Promise.all([
    listPatientAppointments(patientId),
    getClinicSettings(),
  ]);

  const patientReports = reportsStore.listByPatient(patientId);

  let patient: { patient_code?: string; date_of_birth?: string | null; gender?: string | null } | null = null;
  if (isSupabaseConfigured()) {
    try {
      const res = await supabaseAdmin().from("patients").select("patient_code, date_of_birth, gender").eq("id", patientId).maybeSingle();
      patient = res.data;
    } catch {
      patient = null;
    }
  }

  const patientCode = patient?.patient_code || (patientId.startsWith("patient-") ? "P-1001" : `P-${patientId.slice(0, 6).toUpperCase()}`);

  const now = Date.now();
  const upcoming = appts
    .filter((a) => ["confirmed", "checked_in", "in_consultation", "pending_payment"].includes(a.status) && new Date(a.ends_at).getTime() > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const profileIncomplete = !patient?.date_of_birth || !patient?.gender;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user.fullName.split(" ")[0]}`}
        description={`Your Patient UHID is ${patientCode} • Dr. Ratish Juyal Neuro & Spine Clinic, Lucknow`}
        actions={<LinkButton href="/patient/book">+ Book Appointment</LinkButton>}
      />

      {profileIncomplete ? (
        <Alert tone="info" title="Complete your profile">
          Your doctor sees your age and gender on prescriptions.{" "}
          <Link href="/patient/profile" className="font-medium underline">
            Add your details
          </Link>
        </Alert>
      ) : null}

      {/* 4 Essential Quick-Action Modules */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/patient/book"
          className="group rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50/80 to-white p-5 transition hover:shadow-md hover:border-brand-400"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-xs group-hover:scale-105 transition">
            <Calendar className="h-5 w-5" />
          </div>
          <h3 className="mt-3 font-bold text-ink group-hover:text-brand-700">Book Appointment</h3>
          <p className="mt-1 text-xs text-muted">
            Choose doctor, live time slot, and cash or online payment.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
            Book now <ArrowRight className="h-3 w-3" />
          </span>
        </Link>

        <Link
          href="/patient/reports"
          className="group rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-5 transition hover:shadow-md hover:border-emerald-400"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs group-hover:scale-105 transition">
            <Upload className="h-5 w-5" />
          </div>
          <h3 className="mt-3 font-bold text-ink group-hover:text-emerald-700">Medical Reports</h3>
          <p className="mt-1 text-xs text-muted">
            Upload Brain/Spine MRI, CT & pathology for doctor review.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
            Upload & view ({patientReports.length}) <ArrowRight className="h-3 w-3" />
          </span>
        </Link>

        <Link
          href="/patient/history"
          className="group rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-white p-5 transition hover:shadow-md hover:border-blue-400"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs group-hover:scale-105 transition">
            <Activity className="h-5 w-5" />
          </div>
          <h3 className="mt-3 font-bold text-ink group-hover:text-blue-700">Medical History</h3>
          <p className="mt-1 text-xs text-muted">
            View chronological visits, past diagnoses, and vitals track.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
            View timeline <ArrowRight className="h-3 w-3" />
          </span>
        </Link>

        <Link
          href="/patient/prescriptions"
          className="group rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/80 to-white p-5 transition hover:shadow-md hover:border-purple-400"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-xs group-hover:scale-105 transition">
            <Pill className="h-5 w-5" />
          </div>
          <h3 className="mt-3 font-bold text-ink group-hover:text-purple-700">Prescriptions</h3>
          <p className="mt-1 text-xs text-muted">
            Download PDF prescriptions with digital signature & advice.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-purple-700">
            View prescriptions <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
      </div>

      {/* OPD Timings Notice */}
      <div className="rounded-xl border border-line bg-slate-50 p-4 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Clock className="h-4 w-4 text-brand-600 shrink-0" />
          <span>
            <strong>OPD Timings:</strong> Monday to Saturday: <strong>12:00 PM – 05:00 PM</strong> (Dr. Ratish Juyal & Dr. Amit K. Sharma PT)
          </span>
        </div>
        <span className="font-semibold text-brand-700">Clinic Helpline: +91 94530 25888</span>
      </div>

      {/* Upcoming Appointments Section */}
      <section aria-labelledby="upcoming-appointments">
        <div className="flex items-center justify-between mb-3">
          <h2 id="upcoming-appointments" className="text-lg font-semibold text-ink">
            Upcoming Appointments
          </h2>
          {upcoming.length > 0 ? (
            <Link href="/patient/appointments" className="text-xs font-semibold text-brand-700 hover:underline">
              View all ({appts.length}) →
            </Link>
          ) : null}
        </div>

        {upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming appointments"
            description="Choose a doctor and an available slot that suits your schedule."
            action={<LinkButton href="/patient/book">Book an Appointment</LinkButton>}
          />
        ) : (
          <div className="space-y-3">
            {upcoming.map((a) => (
              <Card key={a.id} className="flex flex-wrap items-center justify-between gap-4 p-5 hover:border-slate-300 transition">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-ink">{doctorNameOf(a)}</p>
                    <AppointmentBadge status={a.status} />
                  </div>
                  <p className="text-xs text-muted">{a.doctors.speciality}</p>
                  <p className="text-xs text-slate-700 font-medium">
                    When: {formatInstant(a.starts_at, settings.timezone)}
                  </p>
                  {a.reason ? (
                    <p className="text-xs text-slate-500 italic">Reason: {a.reason}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <LinkButton href={`/patient/appointments/${a.id}/receipt`} variant="secondary">
                    Receipt
                  </LinkButton>
                  <LinkButton href={`/patient/appointments/${a.id}`}>
                    Manage
                  </LinkButton>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Uploaded Medical Reports Preview */}
      <section aria-labelledby="recent-reports">
        <div className="flex items-center justify-between mb-3">
          <h2 id="recent-reports" className="text-lg font-semibold text-ink">
            Recent Medical Reports ({patientReports.length})
          </h2>
          <Link href="/patient/reports" className="text-xs font-semibold text-brand-700 hover:underline">
            Manage Reports →
          </Link>
        </div>

        {patientReports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-surface/50 p-6 text-center text-xs text-muted">
            No medical reports uploaded yet. Upload Brain/Spine MRI scans or blood tests for your doctor in the Medical Reports section.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {patientReports.slice(0, 3).map((r) => (
              <div key={r.id} className="rounded-xl border border-line bg-white p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                    {r.category}
                  </span>
                  <span className="text-[11px] text-muted">{r.fileSizeFormatted}</span>
                </div>
                <h4 className="font-bold text-ink text-xs line-clamp-1">{r.title}</h4>
                <p className="text-[11px] text-muted">Date: {r.reportDate}</p>
                <div className="pt-1 flex items-center justify-between text-xs">
                  <Link href="/patient/reports" className="font-semibold text-brand-700 hover:underline">
                    Preview & Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
