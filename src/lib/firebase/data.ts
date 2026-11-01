import type { ClinicSettings, PublicDoctor } from "@/types/db";
import { DEFAULT_TZ } from "../time";
import { db } from "./config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  type DocumentSnapshot,
} from "firebase/firestore";

export const CLINIC_SETTINGS_ID = "main_clinic";

export const DR_RATISH_JUYAL_ID = "7b9a5f2e-4c3d-4e1a-8f9b-0c2d3e4f5a6b";
export const PHYSIOTHERAPIST_ID = "8c0b6a3f-5d4e-4f2b-9a0c-1d3e4f5a6b7c";

export const DEFAULT_CLINIC_SETTINGS: ClinicSettings = {
  clinic_name: "Dr. Ratish Juyal Neuro & Spine Clinic",
  address: "M3/460, Sector H, LDA Colony (Near Power House Crossing) & Aashiyana / Medanta Super Speciality Hospital OPD, Lucknow, Uttar Pradesh 226012",
  phone: "+91 94500 56789",
  email: "care@drratishjuyal.com",
  logo_storage_path: null,
  prescription_footer: "Dr. Ratish Juyal | DM (Neurology, KGMU), MD (Medicine) | Senior Consultant Neurologist, Lucknow | Tel: +91 94500 56789",
  timezone: DEFAULT_TZ,
  cancellation_window_hours: 24,
  slot_hold_minutes: 10,
  booking_horizon_days: 30,
  record_retention_years: 5,
};

export const CLINIC_DOCTORS: PublicDoctor[] = [
  {
    id: DR_RATISH_JUYAL_ID,
    doctor_code: "DOC-JUYAL",
    full_name: "Dr. Ratish Juyal",
    speciality: "Neurologist (Brain, Spine & Nerve Specialist)",
    qualification: "MBBS, MD (Medicine), DM (Neurology - KGMU, Lucknow)",
    registration_number: "UPMC/54821",
    consultation_fee: 1000,
    bio: "Dr. Ratish Juyal is a renowned Senior Consultant Neurologist based in Lucknow with DM superspeciality training from the prestigious King George's Medical University (KGMU). Affiliated with Medanta Super Speciality Hospital, Lucknow, he has deep expertise in managing Stroke, Epilepsy, Migraine & Headache disorders, Parkinson's disease, Neuropathy, Sciatica, Dementia, and Neuro-critical conditions.",
  },
  {
    id: PHYSIOTHERAPIST_ID,
    doctor_code: "DOC-PHYSIO",
    full_name: "Dr. Amit K. Sharma (PT)",
    speciality: "Neuro Physiotherapist & Rehabilitation Specialist",
    qualification: "BPT, MPT (Neuro-Physiotherapy & Neuro-Rehabilitation)",
    registration_number: "UPPTC-88312",
    consultation_fee: 500,
    bio: "Dr. Amit K. Sharma is a dedicated Neuro-Physiotherapist specializing in post-stroke motor recovery, Parkinson's gait and balance therapy, spine & disc rehabilitation (Sciatica, Cervical spondylosis), Bell's Palsy facial therapy, and post-neurosurgical functional restoration.",
  },
];

export interface DoctorScheduleRule {
  doctorId: string;
  weekday: number; // 1 = Monday, 6 = Saturday
  startTime: string; // "12:00"
  endTime: string; // "17:00"
  slotDurationMinutes: number;
  isActive: boolean;
}

export const CLINIC_SCHEDULES: DoctorScheduleRule[] = [
  // Dr. Ratish Juyal (12 PM to 5 PM, Mon-Sat, 20 min slots)
  ...[1, 2, 3, 4, 5, 6].map((weekday) => ({
    doctorId: DR_RATISH_JUYAL_ID,
    weekday,
    startTime: "12:00",
    endTime: "17:00",
    slotDurationMinutes: 20,
    isActive: true,
  })),
  // Physiotherapist (12 PM to 5 PM, Mon-Sat, 30 min slots)
  ...[1, 2, 3, 4, 5, 6].map((weekday) => ({
    doctorId: PHYSIOTHERAPIST_ID,
    weekday,
    startTime: "12:00",
    endTime: "17:00",
    slotDurationMinutes: 30,
    isActive: true,
  })),
];

// High-performance in-memory cache
let cachedSettings: ClinicSettings | null = null;
let lastSettingsFetch = 0;
let cachedDoctors: PublicDoctor[] | null = null;
let lastDoctorsFetch = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

function withFastTimeout<T>(promise: Promise<T>, ms = 250, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(fallback);
      }
    }, ms);

    promise
      .then((val) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(val);
        }
      })
      .catch(() => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      });
  });
}

/** Fetch clinic settings with instant in-memory cache and non-blocking Firebase fallback */
export async function getFirebaseClinicSettings(): Promise<ClinicSettings> {
  const now = Date.now();
  if (cachedSettings && now - lastSettingsFetch < CACHE_TTL_MS) {
    return cachedSettings;
  }

  const fetchPromise = async (): Promise<ClinicSettings> => {
    try {
      const docRef = doc(db, "clinic_settings", CLINIC_SETTINGS_ID);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = { ...DEFAULT_CLINIC_SETTINGS, ...snap.data() } as ClinicSettings;
        cachedSettings = data;
        lastSettingsFetch = Date.now();
        return data;
      }
    } catch {
      // Offline fallback
    }
    return DEFAULT_CLINIC_SETTINGS;
  };

  const result = await withFastTimeout(fetchPromise(), 250, cachedSettings || DEFAULT_CLINIC_SETTINGS);
  cachedSettings = result;
  lastSettingsFetch = now;
  return result;
}

/** Fetch public doctors from instant in-memory cache or fast Firebase */
export async function listFirebaseDoctors(): Promise<PublicDoctor[]> {
  const now = Date.now();
  if (cachedDoctors && now - lastDoctorsFetch < CACHE_TTL_MS) {
    return cachedDoctors;
  }

  const fetchPromise = async (): Promise<PublicDoctor[]> => {
    try {
      const snap = await getDocs(collection(db, "doctors"));
      if (!snap.empty) {
        const docs = snap.docs.map((d: DocumentSnapshot) => ({ id: d.id, ...(d.data() || {}) } as PublicDoctor));
        const active = docs.filter((d) => (d as { is_active?: boolean }).is_active !== false);
        if (active.length > 0) {
          cachedDoctors = active;
          lastDoctorsFetch = Date.now();
          return active;
        }
      }
    } catch {
      // Offline fallback
    }
    return CLINIC_DOCTORS;
  };

  const result = await withFastTimeout(fetchPromise(), 250, cachedDoctors || CLINIC_DOCTORS);
  cachedDoctors = result;
  lastDoctorsFetch = now;
  return result;
}

/** Fetch single doctor by ID instantly */
export async function getFirebaseDoctor(id: string): Promise<PublicDoctor | null> {
  const doc0 = CLINIC_DOCTORS[0];
  const doc1 = CLINIC_DOCTORS[1];
  if (id === DR_RATISH_JUYAL_ID && doc0) return doc0;
  if (id === PHYSIOTHERAPIST_ID && doc1) return doc1;

  // Check in cached doctors
  if (cachedDoctors) {
    const found = cachedDoctors.find((d) => d.id === id);
    if (found) return found;
  }

  return CLINIC_DOCTORS.find((d) => d.id === id) ?? null;
}

/** Sync & seed real data to Firebase Firestore */
export async function syncClinicToFirebase(): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Set clinic settings
    await setDoc(doc(db, "clinic_settings", CLINIC_SETTINGS_ID), DEFAULT_CLINIC_SETTINGS, { merge: true });

    // 2. Set Dr. Ratish Juyal
    const doc0 = CLINIC_DOCTORS[0];
    if (doc0) {
      await setDoc(doc(db, "doctors", DR_RATISH_JUYAL_ID), {
        ...doc0,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { merge: true });
    }

    // 3. Set Physiotherapist
    const doc1 = CLINIC_DOCTORS[1];
    if (doc1) {
      await setDoc(doc(db, "doctors", PHYSIOTHERAPIST_ID), {
        ...doc1,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { merge: true });
    }

    // 4. Set Schedules
    for (const s of CLINIC_SCHEDULES) {
      const scheduleId = `${s.doctorId}_w${s.weekday}`;
      await setDoc(doc(db, "doctor_schedules", scheduleId), s, { merge: true });
    }

    return { success: true, message: "Clinic data synchronized to Firebase console successfully!" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to sync to Firebase";
    console.error("Firebase sync error:", err);
    return { success: false, message: msg };
  }
}
