import "server-only";
import { supabaseAdmin, isSupabaseConfigured } from "./supabase/admin";
import type { AppointmentRow, PaymentRow } from "@/types/db";

export type ApptWithDoctor = AppointmentRow & {
  doctors: { speciality: string; consultation_fee: number | string; profiles: { full_name: string } | { full_name: string }[] };
  payments: PaymentRow[];
};

export function doctorNameOf(a: { doctors: ApptWithDoctor["doctors"] }): string {
  const p = a.doctors.profiles;
  return (Array.isArray(p) ? p[0]?.full_name : p.full_name) ?? "Doctor";
}

const APPT_SELECT = "*, doctors!inner(speciality, consultation_fee, profiles!inner(full_name)), payments(*)";

export async function listPatientAppointments(patientId: string): Promise<ApptWithDoctor[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data } = await supabaseAdmin().from("appointments").select(APPT_SELECT).eq("patient_id", patientId).order("starts_at", { ascending: false }).limit(200);
    return (data ?? []) as unknown as ApptWithDoctor[];
  } catch {
    return [];
  }
}

/** Scoped to the patient: someone else's appointment id returns null (rendered as 404). */
export async function getPatientAppointment(id: string, patientId: string): Promise<ApptWithDoctor | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = await supabaseAdmin().from("appointments").select(APPT_SELECT).eq("id", id).eq("patient_id", patientId).maybeSingle();
    return (data ?? null) as unknown as ApptWithDoctor | null;
  } catch {
    return null;
  }
}

export function latestPayment(a: { payments: PaymentRow[] }): PaymentRow | undefined {
  return [...a.payments].sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
}

export function paidPayment(a: { payments: PaymentRow[] }): PaymentRow | undefined {
  return a.payments.find((p) => ["captured", "refunded", "partially_refunded"].includes(p.status));
}
