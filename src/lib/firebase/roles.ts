import { db } from "./config";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from "firebase/firestore";
import type { Role } from "../status";
import { DR_RATISH_JUYAL_ID, PHYSIOTHERAPIST_ID } from "./data";

export interface ClinicStaffMember {
  id: string; // usually normalized email or uid
  email: string;
  fullName: string;
  role: Role; // "patient" | "doctor" | "admin"
  doctorId?: string | null;
  permissions: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Built-in initial staff/doctor accounts
export const DEFAULT_CLINIC_ROLES: ClinicStaffMember[] = [
  {
    id: "doctor_ratish_juyal",
    email: "dr.ratishjuyal@gmail.com",
    fullName: "Dr. Ratish Juyal",
    role: "doctor",
    doctorId: DR_RATISH_JUYAL_ID,
    permissions: ["medical_records", "consultation"],
    isActive: true,
  },
  {
    id: "physiotherapist_sharma",
    email: "physio.sharma@gmail.com",
    fullName: "Dr. Amit K. Sharma (PT)",
    role: "doctor",
    doctorId: PHYSIOTHERAPIST_ID,
    permissions: ["medical_records", "consultation"],
    isActive: true,
  },
  {
    id: "admin_clinic",
    email: "care@drratishjuyal.com",
    fullName: "Clinic Admin",
    role: "admin",
    permissions: ["manage_staff", "medical_records"],
    isActive: true,
  },
];

/** Determine user's role based on their email in Firestore or fallback defaults */
export async function resolveUserRole(
  email: string | null
): Promise<{ role: Role; doctorId?: string | null; permissions: string[] }> {
  if (!email) {
    return { role: "patient", permissions: [] };
  }

  const cleanEmail = email.trim().toLowerCase();

  // 1. Check if email is in Firestore staff_members collection
  try {
    const docRef = doc(db, "staff_members", cleanEmail);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as Partial<ClinicStaffMember>;
      if (data.isActive !== false && data.role) {
        return {
          role: data.role,
          doctorId: data.doctorId ?? (data.role === "doctor" ? DR_RATISH_JUYAL_ID : null),
          permissions: data.permissions ?? (data.role === "admin" ? ["manage_staff", "medical_records"] : []),
        };
      }
    }
  } catch (err) {
    console.warn("Error resolving role from Firestore:", err);
  }

  // 2. Check default list
  const defaultEntry = DEFAULT_CLINIC_ROLES.find((m) => m.email.toLowerCase() === cleanEmail);
  if (defaultEntry) {
    return {
      role: defaultEntry.role,
      doctorId: defaultEntry.doctorId ?? null,
      permissions: defaultEntry.permissions,
    };
  }

  // 3. Default for all other users is strictly "patient"
  return { role: "patient", permissions: [] };
}

/** List all staff & doctor accounts from Firestore */
export async function listClinicStaff(): Promise<ClinicStaffMember[]> {
  try {
    const snap = await getDocs(collection(db, "staff_members"));
    if (!snap.empty) {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as ClinicStaffMember));
      return list;
    }
  } catch (err) {
    console.warn("Error loading staff from Firestore:", err);
  }
  return DEFAULT_CLINIC_ROLES;
}

/** Save or update staff / doctor account in Firestore */
export async function saveClinicStaff(member: {
  email: string;
  fullName: string;
  role: Role;
  permissions?: string[];
  doctorId?: string | null;
  isActive?: boolean;
}): Promise<void> {
  const cleanEmail = member.email.trim().toLowerCase();
  const docRef = doc(db, "staff_members", cleanEmail);

  const data: ClinicStaffMember = {
    id: cleanEmail,
    email: cleanEmail,
    fullName: member.fullName.trim(),
    role: member.role,
    doctorId: member.doctorId ?? (member.role === "doctor" ? DR_RATISH_JUYAL_ID : null),
    permissions: member.permissions ?? (member.role === "admin" ? ["manage_staff", "medical_records"] : []),
    isActive: member.isActive ?? true,
    updatedAt: new Date().toISOString(),
  };

  await setDoc(docRef, data, { merge: true });
}

/** Delete or deactivate staff member */
export async function removeClinicStaff(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  try {
    await deleteDoc(doc(db, "staff_members", cleanEmail));
  } catch (err) {
    console.error("Error deleting staff member:", err);
  }
}
