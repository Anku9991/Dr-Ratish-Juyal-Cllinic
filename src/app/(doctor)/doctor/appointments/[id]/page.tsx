import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { requirePageRole, requireDoctorId } from "@/lib/auth";
import { getDoctorAppointment, getPatientHistoryForDoctor, patientNameOf } from "@/lib/doctor-queries";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ageFromDob, hhmm } from "@/lib/time";
import { ConsultationForm } from "@/components/client/ConsultationForm";
import { PageHeader } from "@/components/ui";
import { LinkButton, Alert } from "@/components/ui";
import type { ConsultationRow, MedicineRow } from "@/types/db";

export const metadata: Metadata = { title: "Consultation" };

export default async function ConsultationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const user = await requirePageRole("doctor");
  const doctorId = await requireDoctorId(user);
  const appt = await getDoctorAppointment(doctorId, id);
  if (!appt) notFound();
  if (!["confirmed", "checked_in", "in_consultation", "completed"].includes(appt.status)) {
    return (
      <div className="max-w-lg">
        <Alert tone="warning" title="This appointment is not ready for consultation">
          Status: {appt.status.replace("_", " ")}
        </Alert>
        <LinkButton href="/doctor" className="mt-4 inline-flex">
          Back to today
        </LinkButton>
      </div>
    );
  }

  const admin = supabaseAdmin();
  const [{ data: consultation }, { data: prescription }] = await Promise.all([
    admin.from("consultations").select("*").eq("appointment_id", id).maybeSingle(),
    admin.from("consultations").select("id").eq("appointment_id", id).maybeSingle().then(async (r) => {
      if (!r.data) return { data: null };
      return admin.from("prescriptions").select("id, status").eq("consultation_id", r.data.id as string).order("created_at", { ascending: false }).maybeSingle();
    }),
  ]);
  const c = consultation as ConsultationRow | null;
  let medicines: MedicineRow[] = [];
  if (prescription?.id) {
    const { data } = await admin.from("prescription_medicines").select("*").eq("prescription_id", prescription.id as string).order("sort_order");
    medicines = (data ?? []) as MedicineRow[];
  }

  if (c?.status === "finalized" && prescription?.id) {
    return (
      <div className="max-w-lg">
        <Alert tone="success" title="This consultation is already finalized">
          The prescription has been issued.
        </Alert>
        <LinkButton href={`/doctor/prescriptions/${prescription.id}`} className="mt-4 inline-flex">
          View prescription
        </LinkButton>
      </div>
    );
  }

  const history = await getPatientHistoryForDoctor(doctorId, appt.patients.id, c?.id);

  return (
    <div>
      <PageHeader title="Consultation" />
      <ConsultationForm
        appointmentId={id}
        appointmentStatus={appt.status}
        locked={false}
        header={{
          name: patientNameOf(appt),
          uhid: appt.patients.patient_code,
          age: ageFromDob(appt.patients.date_of_birth),
          gender: appt.patients.gender,
          appointmentNumber: appt.appointment_number,
          doctorName: user.fullName,
          date: appt.appointment_date,
          time: hhmm(appt.start_time),
        }}
        initial={{
          symptoms: c?.symptoms ?? "",
          examinationNotes: c?.examination_notes ?? "",
          diagnosis: c?.diagnosis ?? "",
          bloodPressure: c?.blood_pressure ?? "",
          pulse: c?.pulse ?? undefined,
          temperature: c?.temperature ?? undefined,
          spo2: c?.spo2 ?? undefined,
          weight: c?.weight ?? undefined,
          advice: c?.advice ?? "",
          followUpDate: c?.follow_up_date ?? "",
          medicines: medicines.length
            ? medicines.map((m) => ({ medicineName: m.medicine_name, strength: m.strength ?? "", dosage: m.dosage, frequency: m.frequency, duration: m.duration, instructions: m.instructions ?? "" }))
            : [],
        }}
        history={history.map((h) => ({ id: h.id, diagnosis: h.diagnosis, date: h.appointments.starts_at }))}
      />
    </div>
  );
}
