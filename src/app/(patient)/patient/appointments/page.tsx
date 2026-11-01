import type { Metadata } from "next";
import { requirePageRole, requirePatientId } from "@/lib/auth";
import { getClinicSettings } from "@/lib/clinic";
import { listPatientAppointments } from "@/lib/queries";
import { LinkButton, PageHeader } from "@/components/ui";
import { PatientAppointmentsManager } from "@/components/client/PatientAppointmentsManager";

export const metadata: Metadata = {
  title: "My Appointments — Dr. Ratish Juyal Clinic",
  description: "View and manage your upcoming, completed, and cancelled OPD consultations.",
};

export default async function AppointmentsPage() {
  const user = await requirePageRole("patient");
  const patientId = await requirePatientId(user);
  const [appts, settings] = await Promise.all([
    listPatientAppointments(patientId),
    getClinicSettings(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Appointments"
        description="Track all your OPD consultations, view tokens & receipts, and manage appointments."
        actions={<LinkButton href="/patient/book">+ Book New Appointment</LinkButton>}
      />

      <PatientAppointmentsManager
        appointments={appts}
        timezone={settings.timezone}
        cancellationWindowHours={settings.cancellation_window_hours}
      />
    </div>
  );
}
