import "server-only";
import { getClinicSettings, getPublicDoctor } from "./clinic";
import { generateSlots, type Slot, type SlotUnavailableReason } from "./slots";
import { hhmm } from "./time";
import { HttpError } from "./errors";
import { CLINIC_SCHEDULES, PHYSIOTHERAPIST_ID } from "./firebase/data";
import { db } from "./firebase/config";
import { collection, query, where, getDocs, type DocumentSnapshot } from "firebase/firestore";
import { clinicStore } from "./appointments-store";

export interface SlotsResponse {
  date: string;
  timezone: string;
  slots: Slot[];
  reason?: SlotUnavailableReason;
}

/** What to SHOW. Booking re-validates atomically. */
export async function getSlotsForDoctor(doctorId: string, date: string, now: Date = new Date()): Promise<SlotsResponse> {
  const doctor = await getPublicDoctor(doctorId);
  if (!doctor) throw new HttpError(404, "doctor_unavailable", "This doctor is not available for booking.");

  const settings = await getClinicSettings();

  // Find schedule rules for doctor (12pm to 5pm)
  let rules = CLINIC_SCHEDULES.filter((s) => s.doctorId === doctorId && s.isActive).map((s) => ({
    weekday: s.weekday,
    startTime: s.startTime,
    endTime: s.endTime,
    slotMinutes: s.slotDurationMinutes,
    isActive: s.isActive,
  }));

  // If no custom rules found, default to 12:00 to 17:00 (12pm to 5pm)
  if (rules.length === 0) {
    rules = [1, 2, 3, 4, 5, 6].map((w) => ({
      weekday: w,
      startTime: "12:00",
      endTime: "17:00",
      slotMinutes: doctorId === PHYSIOTHERAPIST_ID ? 30 : 20,
      isActive: true,
    }));
  }

  // Fetch unavailable slots from clinicStore and Firebase appointments
  const unavailable = new Set<string>();
  for (const appt of clinicStore.listForDoctor(doctorId, date)) {
    if (!["cancelled", "expired"].includes(appt.status)) {
      unavailable.add(hhmm(appt.start_time));
    }
  }
  try {
    const q = query(
      collection(db, "appointments"),
      where("doctor_id", "==", doctorId),
      where("appointment_date", "==", date)
    );
    const snap = await getDocs(q);
    snap.forEach((docSnap: DocumentSnapshot) => {
      const data = docSnap.data() as { start_time?: string; status?: string } | undefined;
      if (data?.start_time && !["cancelled", "refunded"].includes(data?.status || "")) {
        unavailable.add(hhmm(data.start_time));
      }
    });
  } catch {
    // Graceful fallback if offline
  }

  const result = generateSlots({
    date,
    tz: settings.timezone,
    now,
    rules,
    leaveDates: [],
    holidayDates: [],
    unavailableStarts: unavailable,
    horizonDays: settings.booking_horizon_days,
  });

  return { date, timezone: settings.timezone, ...result };
}
