import "server-only";
import type { ClinicSettings, PublicDoctor } from "@/types/db";
import {
  getFirebaseClinicSettings,
  listFirebaseDoctors,
  getFirebaseDoctor as getFbDoc,
} from "./firebase/data";

/** Public-safe clinic info */
export async function getPublicClinic(): Promise<ClinicSettings> {
  return getFirebaseClinicSettings();
}

/** Full settings row (server side only). */
export async function getClinicSettings(): Promise<ClinicSettings> {
  return getFirebaseClinicSettings();
}

export function isClinicConfigured(s: ClinicSettings): boolean {
  return Boolean(s.clinic_name?.trim() && s.address?.trim() && s.phone?.trim());
}

export function clinicDisplayName(s: ClinicSettings): string {
  return s.clinic_name?.trim() || "Dr. Ratish Juyal Clinic";
}

export async function listPublicDoctors(): Promise<PublicDoctor[]> {
  return listFirebaseDoctors();
}

export async function getPublicDoctor(id: string): Promise<PublicDoctor | null> {
  return getFbDoc(id);
}
