import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { getClinicSettings, isClinicConfigured } from "./clinic";
import { generatePrescriptionPdf, type PdfImageInput, type PrescriptionPdfData } from "./pdf/prescription";
import { BUCKET_ASSETS, BUCKET_PRESCRIPTIONS, downloadBytes, imageKind, uploadBytes } from "./storage";
import { HttpError } from "./errors";
import { ageFromDob, formatDateLong, formatInstant } from "./time";
import type { ConsultationRow, MedicineRow, PrescriptionRow } from "@/types/db";

async function loadImage(bucket: string, path: string | null): Promise<PdfImageInput | null> {
  if (!path) return null;
  const bytes = await downloadBytes(bucket, path);
  if (!bytes) return null;
  const kind = imageKind(bytes);
  return kind ? { bytes, kind } : null;
}

export async function loadPrescriptionBundle(prescriptionId: string) {
  const admin = supabaseAdmin();
  const { data: rx } = await admin.from("prescriptions").select("*").eq("id", prescriptionId).maybeSingle();
  if (!rx) return null;
  const prescription = rx as PrescriptionRow;
  const [{ data: consultation }, { data: medicines }, { data: doctor }, { data: patient }, settings] = await Promise.all([
    admin.from("consultations").select("*").eq("id", prescription.consultation_id).single(),
    admin.from("prescription_medicines").select("*").eq("prescription_id", prescription.id).order("sort_order"),
    admin.from("doctors").select("*, profiles!inner(full_name)").eq("id", prescription.doctor_id).single(),
    admin.from("patients").select("*, profiles!inner(full_name)").eq("id", prescription.patient_id).single(),
    getClinicSettings(),
  ]);
  const c = consultation as ConsultationRow | null;
  if (!c) return null;
  const { data: appt } = await admin.from("appointments").select("appointment_number").eq("id", c.appointment_id).maybeSingle();
  return {
    prescription,
    consultation: c,
    medicines: (medicines ?? []) as MedicineRow[],
    doctor: doctor as Record<string, unknown> & { profiles: { full_name: string } | { full_name: string }[] },
    patient: patient as Record<string, unknown> & { profiles: { full_name: string } | { full_name: string }[] },
    appointmentNumber: (appt?.appointment_number as string | undefined) ?? "",
    settings,
  };
}

function parseDataUrlImage(dataUrl: string | null | undefined): PdfImageInput | null {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return null;
  try {
    const parts = dataUrl.split(",");
    if (parts.length < 2) return null;
    const meta = parts[0];
    const base64 = parts[1];
    if (!meta || !base64) return null;
    const kind: "png" | "jpg" = meta.includes("jpeg") || meta.includes("jpg") ? "jpg" : "png";
    const buffer = Buffer.from(base64, "base64");
    return { bytes: new Uint8Array(buffer), kind };
  } catch {
    return null;
  }
}

function nameOf(p: { full_name: string } | { full_name: string }[]): string {
  return (Array.isArray(p) ? p[0]?.full_name : p.full_name) ?? "";
}

export async function buildPdfData(prescriptionId: string): Promise<PrescriptionPdfData> {
  const b = await loadPrescriptionBundle(prescriptionId);
  if (!b) throw new HttpError(404, "not_found", "Prescription not found.");
  if (b.prescription.status === "draft" || !b.prescription.prescription_number || !b.prescription.issued_at) {
    throw new HttpError(409, "not_issued", "This prescription has not been issued.");
  }
  if (!isClinicConfigured(b.settings)) {
    throw new HttpError(409, "clinic_not_configured", "Clinic details have not been configured by the admin yet.");
  }
  const [logo, signature] = await Promise.all([
    loadImage(BUCKET_ASSETS, b.settings.logo_storage_path),
    loadImage(BUCKET_ASSETS, (b.doctor.signature_storage_path as string | null) ?? null),
  ]);
  const tz = b.settings.timezone;
  const c = b.consultation;

  let handwrittenPad: PdfImageInput | null = null;
  try {
    const { db: firestore } = await import("./firebase/config");
    const { doc, getDoc } = await import("firebase/firestore");
    const rxSnap = await getDoc(doc(firestore, "prescriptions", prescriptionId));
    const padDrawing = rxSnap.exists() ? (rxSnap.data()?.padDrawing as string | null) : null;
    if (padDrawing) {
      handwrittenPad = parseDataUrlImage(padDrawing);
    } else if (c?.appointment_id) {
      const padSnap = await getDoc(doc(firestore, "prescription_pads", c.appointment_id));
      const imageData = padSnap.exists() ? (padSnap.data()?.imageData as string | null) : null;
      if (imageData) {
        handwrittenPad = parseDataUrlImage(imageData);
      }
    }
  } catch (err) {
    console.warn("Failed to load handwritten pad for PDF:", err);
  }

  return {
    clinic: {
      name: b.settings.clinic_name ?? "",
      address: b.settings.address ?? "",
      phone: b.settings.phone ?? "",
      email: b.settings.email,
      footer: b.settings.prescription_footer,
      logo,
    },
    doctor: {
      name: nameOf(b.doctor.profiles),
      qualification: b.doctor.qualification as string | null,
      speciality: b.doctor.speciality as string | null,
      registrationNumber: b.doctor.registration_number as string | null,
      signature,
    },
    patient: {
      name: nameOf(b.patient.profiles),
      uhid: b.patient.patient_code as string,
      age: ageFromDob(b.patient.date_of_birth as string | null),
      gender: b.patient.gender as string | null,
    },
    appointmentNumber: b.appointmentNumber,
    prescriptionNumber: b.prescription.prescription_number,
    issuedOn: formatInstant(b.prescription.issued_at, tz),
    status: b.prescription.status === "issued" ? "issued" : b.prescription.status === "amended" ? "amended" : "cancelled",
    statusNote: b.prescription.status_reason,
    chiefComplaints: c.chief_complaints,
    clinicalExamination: c.examination_notes,
    diagnosis: c.diagnosis,
    investigationAdvised: c.investigation_advised,
    vitals: {
      bloodPressure: c.blood_pressure,
      pulse: c.pulse,
      temperature: c.temperature,
      spo2: c.spo2,
      respiratoryRate: c.respiratory_rate,
      height: c.height,
      weight: c.weight,
      bmi: c.bmi,
      bloodSugar: c.blood_sugar,
    },
    medicines: b.medicines.map((m) => ({
      medicineName: m.medicine_name,
      strength: m.strength,
      dosage: m.dosage,
      frequency: m.frequency,
      duration: m.duration,
      instructions: m.instructions,
    })),
    advice: c.advice,
    handwrittenPad,
    followUpDate: c.follow_up_date ? formatDateLong(c.follow_up_date) : null,
  };
}

/**
 * Returns the PDF bytes for a prescription. Issued prescriptions are rendered once and stored in the private
 * bucket; amended/cancelled copies are rendered on demand with a status banner and are never cached.
 */
export async function getPrescriptionPdf(prescriptionId: string): Promise<Uint8Array> {
  const admin = supabaseAdmin();
  const { data: rx } = await admin.from("prescriptions").select("id, status, pdf_storage_path, patient_id").eq("id", prescriptionId).maybeSingle();
  if (!rx) throw new HttpError(404, "not_found", "Prescription not found.");

  if (rx.status === "issued" && rx.pdf_storage_path) {
    const cached = await downloadBytes(BUCKET_PRESCRIPTIONS, rx.pdf_storage_path as string);
    if (cached) return cached;
  }
  const bytes = await generatePrescriptionPdf(await buildPdfData(prescriptionId));
  if (rx.status === "issued") {
    const path = `${rx.patient_id as string}/${prescriptionId}.pdf`;
    await uploadBytes(BUCKET_PRESCRIPTIONS, path, bytes, "application/pdf");
    if (!rx.pdf_storage_path) {
      // Allowed exactly once by the immutability trigger.
      await admin.from("prescriptions").update({ pdf_storage_path: path }).eq("id", prescriptionId).is("pdf_storage_path", null);
    }
  }
  return bytes;
}
