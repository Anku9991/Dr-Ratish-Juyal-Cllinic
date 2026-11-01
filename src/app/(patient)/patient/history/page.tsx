import type { Metadata } from "next";
import { requirePageRole, requirePatientId } from "@/lib/auth";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { reportsStore } from "@/lib/reports-store";
import { PageHeader } from "@/components/ui";
import { PatientMedicalHistoryTimeline, type ConsultationHistoryItem } from "@/components/client/PatientMedicalHistoryTimeline";

export const metadata: Metadata = {
  title: "Patient Medical History & Timeline",
  description: "Comprehensive medical timeline with past consultations, prescriptions, clinical vitals, and lab records.",
};

const DEMO_CONSULTATIONS: ConsultationHistoryItem[] = [
  {
    id: "consult-migraine-101",
    doctorName: "Dr. Ratish Juyal",
    speciality: "Senior Consultant Neurologist (KGMU DM Neurology)",
    appointmentNumber: "RJ-202610-101",
    date: "2026-10-15T12:30:00+05:30",
    diagnosis: "Chronic Migraine with Aura & Tension Type Headache",
    symptoms: "Severe throbbing right hemicranial headache for 6 months, associated with nausea, photophobia, and sleep disturbance.",
    examinationNotes: "Cranial nerves II-XII intact. Fundoscopy normal. No focal motor or sensory neurological deficit. Meningeal signs negative.",
    advice: "Maintain regular sleep cycle (7-8 hours). Avoid skipped meals, excess tea/coffee, and chocolate. Maintain daily headache diary.",
    followUpDate: "2026-11-15",
    vitals: {
      bp: "124/82",
      pulse: 74,
      temp: "98.4",
      spo2: 99,
      height: 172,
      weight: 70,
      bmi: 23.7,
      bloodSugar: 98,
    },
    prescription: {
      id: "rx-101",
      prescriptionNumber: "RJ-RX-202610-101",
      medicinesCount: 3,
      medicinesSummary: "1. Tab. Naproxen 500mg (SOS during headache attack)\n2. Tab. Propranolol 40mg (1 tablet once daily morning)\n3. Cap. Pantoprazole 40mg (1 capsule before breakfast)",
    },
  },
  {
    id: "consult-spine-102",
    doctorName: "Dr. Amit K. Sharma (PT)",
    speciality: "Consultant Neuro-Physiotherapist (MPT Neuro)",
    appointmentNumber: "RJ-202610-102",
    date: "2026-10-22T12:45:00+05:30",
    diagnosis: "Cervical Spondylosis with C5-C6 Radiculopathy & Trapezius Spasm",
    symptoms: "Radiating neck pain to right shoulder and scapular border, numbness in right thumb, reduced neck lateral flexion.",
    examinationNotes: "Spurling test positive on right side. Right biceps reflex 1+. Grade 4/5 power right deltoid and biceps. Severe myofascial trigger points in right upper trapezius.",
    advice: "Cervical isometric strengthening exercises (3 sets of 10 reps daily). Ergonomic pillow while sleeping. Avoid forward neck stooping.",
    followUpDate: "2026-11-22",
    vitals: {
      bp: "120/80",
      pulse: 72,
      temp: "98.2",
      spo2: 99,
      height: 172,
      weight: 70,
      bmi: 23.7,
    },
    prescription: {
      id: "rx-102",
      prescriptionNumber: "RJ-RX-202610-102",
      medicinesCount: 2,
      medicinesSummary: "1. Tab. Pregabalin 75mg + Methylcobalamin 1500mcg (1 tablet bedtime for 30 days)\n2. Muscle Relaxant Gel (apply gently twice daily)",
    },
  },
];

export default async function HistoryPage() {
  const user = await requirePageRole("patient");
  const patientId = await requirePatientId(user);

  // Load uploaded medical reports from reportsStore
  const patientReports = reportsStore.listByPatient(patientId);

  // Load consultations from Supabase if configured
  let dbConsultations: ConsultationHistoryItem[] = [];
  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabaseAdmin()
        .from("consultations")
        .select(
          "id, diagnosis, symptoms, examination_notes, advice, follow_up_date, finalized_at, blood_pressure, pulse, temperature, spo2, weight, appointments!inner(appointment_number, starts_at, doctors!inner(profiles!inner(full_name), speciality))"
        )
        .eq("patient_id", patientId)
        .eq("status", "finalized")
        .order("finalized_at", { ascending: false });

      if (data && data.length > 0) {
        dbConsultations = (data as unknown as Array<{
          id: string;
          diagnosis: string | null;
          symptoms: string | null;
          examination_notes: string | null;
          advice: string | null;
          follow_up_date: string | null;
          finalized_at: string;
          blood_pressure: string | null;
          pulse: number | null;
          temperature: number | string | null;
          spo2: number | null;
          weight: number | string | null;
          appointments: {
            appointment_number: string;
            starts_at: string;
            doctors: { speciality: string; profiles: { full_name: string } };
          };
        }>).map((r) => ({
          id: r.id,
          doctorName: r.appointments.doctors.profiles.full_name,
          speciality: r.appointments.doctors.speciality,
          appointmentNumber: r.appointments.appointment_number,
          date: r.finalized_at || r.appointments.starts_at,
          diagnosis: r.diagnosis,
          symptoms: r.symptoms,
          examinationNotes: r.examination_notes,
          advice: r.advice,
          followUpDate: r.follow_up_date,
          vitals: {
            bp: r.blood_pressure,
            pulse: r.pulse,
            temp: r.temperature,
            spo2: r.spo2,
            weight: r.weight,
          },
        }));
      }
    } catch (err) {
      console.warn("Supabase consultations error:", err);
    }
  }

  // Combine DB consultations with demo records if none exist
  const combinedConsultations = dbConsultations.length > 0 ? dbConsultations : DEMO_CONSULTATIONS;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patient Medical History"
        description="Chronological record of your OPD consultations, issued prescriptions, clinical vitals, and diagnostic reports."
      />

      <PatientMedicalHistoryTimeline
        consultations={combinedConsultations}
        reports={patientReports}
        patientName={user.fullName}
        uhid={patientId.startsWith("patient-") ? "UHID-2026-1001" : `UHID-${patientId.slice(0, 8).toUpperCase()}`}
      />
    </div>
  );
}
