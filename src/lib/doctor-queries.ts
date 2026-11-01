import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import type { AppointmentStatus } from "./status";

export interface DoctorAppointmentRow {
  id: string;
  appointment_number: string;
  appointment_date: string;
  start_time: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  reason: string | null;
  patients: { id: string; patient_code: string; date_of_birth: string | null; gender: string | null; profiles: { full_name: string } | { full_name: string }[] };
}

const SELECT = "id, appointment_number, appointment_date, start_time, starts_at, ends_at, status, reason, patients!inner(id, patient_code, date_of_birth, gender, profiles!inner(full_name))";

export function patientNameOf(a: { patients: DoctorAppointmentRow["patients"] }): string {
  const p = a.patients.profiles;
  return (Array.isArray(p) ? p[0]?.full_name : p.full_name) ?? "Patient";
}

const LIVE: AppointmentStatus[] = ["confirmed", "checked_in", "in_consultation", "completed", "no_show"];

export async function listTodayAppointments(doctorId: string, date: string): Promise<DoctorAppointmentRow[]> {
  try {
    const { data } = await supabaseAdmin().from("appointments").select(SELECT).eq("doctor_id", doctorId).eq("appointment_date", date).in("status", LIVE).order("start_time");
    return (data ?? []) as unknown as DoctorAppointmentRow[];
  } catch {
    return [];
  }
}

export async function listUpcomingAppointments(doctorId: string, fromDate: string): Promise<DoctorAppointmentRow[]> {
  try {
    const { data } = await supabaseAdmin()
      .from("appointments")
      .select(SELECT)
      .eq("doctor_id", doctorId)
      .in("status", ["confirmed", "checked_in", "in_consultation"])
      .gte("appointment_date", fromDate)
      .order("starts_at")
      .limit(100);
    return (data ?? []) as unknown as DoctorAppointmentRow[];
  } catch {
    return [];
  }
}

export async function getDoctorAppointment(doctorId: string, appointmentId: string): Promise<DoctorAppointmentRow | null> {
  try {
    const { data } = await supabaseAdmin().from("appointments").select(SELECT).eq("id", appointmentId).eq("doctor_id", doctorId).maybeSingle();
    return (data ?? null) as unknown as DoctorAppointmentRow | null;
  } catch {
    return null;
  }
}

export interface PatientHistoryRow {
  id: string;
  diagnosis: string | null;
  finalized_at: string | null;
  appointments: { starts_at: string };
}

/** A doctor may see a patient's finalized-consultation history only for patients they have themselves seen. */
export async function getPatientHistoryForDoctor(doctorId: string, patientId: string, excludeConsultationId?: string): Promise<PatientHistoryRow[]> {
  try {
    const { data: hasSeen } = await supabaseAdmin().from("appointments").select("id").eq("doctor_id", doctorId).eq("patient_id", patientId).neq("status", "pending_payment").limit(1);
    if (!hasSeen?.length) return [];
    let q = supabaseAdmin().from("consultations").select("id, diagnosis, finalized_at, appointments!inner(starts_at)").eq("patient_id", patientId).eq("status", "finalized").order("finalized_at", { ascending: false }).limit(10);
    if (excludeConsultationId) q = q.neq("id", excludeConsultationId);
    const { data } = await q;
    return (data ?? []) as unknown as PatientHistoryRow[];
  } catch {
    return [];
  }
}
