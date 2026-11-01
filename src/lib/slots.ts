import { addDays, dateInTz, fromMinutes, hhmm, isValidDate, localToUtc, toMinutes, weekdayOf } from "./time";

export interface ScheduleRule {
  weekday: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  isActive?: boolean;
}

export interface Slot {
  startTime: string; // HH:MM, clinic-local
  endTime: string;
  startsAt: string; // ISO UTC
}

export interface SlotInput {
  date: string;
  tz: string;
  now: Date;
  rules: ScheduleRule[];
  /** Doctor leave dates (yyyy-mm-dd) */
  leaveDates?: readonly string[];
  /** Clinic holiday dates (yyyy-mm-dd) */
  holidayDates?: readonly string[];
  /** HH:MM start times already booked or held for this doctor on this date */
  unavailableStarts?: ReadonlySet<string>;
  horizonDays: number;
}

export type SlotUnavailableReason = "invalid_date" | "past_date" | "beyond_horizon" | "leave" | "holiday";

export interface SlotResult {
  slots: Slot[];
  reason?: SlotUnavailableReason;
}

/**
 * Pure slot generation. The database re-validates everything atomically in create_hold(); this only decides
 * what to show. Past slots, leave days, clinic holidays and taken slots never appear.
 */
export function generateSlots(input: SlotInput): SlotResult {
  const { date, tz, now, rules, horizonDays } = input;
  if (!isValidDate(date)) return { slots: [], reason: "invalid_date" };

  const today = dateInTz(now, tz);
  if (date < today) return { slots: [], reason: "past_date" };
  if (date > addDays(today, horizonDays)) return { slots: [], reason: "beyond_horizon" };
  if (input.holidayDates?.includes(date)) return { slots: [], reason: "holiday" };
  if (input.leaveDates?.includes(date)) return { slots: [], reason: "leave" };

  const weekday = weekdayOf(date);
  const taken = input.unavailableStarts ?? new Set<string>();
  const seen = new Set<string>();
  const slots: Slot[] = [];

  for (const rule of rules) {
    if (rule.isActive === false || rule.weekday !== weekday) continue;
    if (rule.slotMinutes <= 0) continue;
    const start = toMinutes(rule.startTime);
    const end = toMinutes(rule.endTime);
    for (let t = start; t + rule.slotMinutes <= end; t += rule.slotMinutes) {
      const startTime = fromMinutes(t);
      if (seen.has(startTime) || taken.has(startTime)) continue;
      const startsAt = localToUtc(date, startTime, tz);
      if (startsAt.getTime() <= now.getTime()) continue;
      seen.add(startTime);
      slots.push({ startTime, endTime: fromMinutes(t + rule.slotMinutes), startsAt: startsAt.toISOString() });
    }
  }
  slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return { slots };
}

export function normalizeRule(r: { weekday: number; start_time: string; end_time: string; slot_duration_minutes: number; is_active?: boolean }): ScheduleRule {
  return {
    weekday: r.weekday,
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    slotMinutes: r.slot_duration_minutes,
    isActive: r.is_active,
  };
}

/** Rules for one doctor must not overlap on the same weekday. Returns a message for the first overlap found. */
export function findScheduleOverlap(rules: ScheduleRule[]): string | null {
  const active = rules.filter((r) => r.isActive !== false);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (!a || !b || a.weekday !== b.weekday) continue;
      if (toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime)) {
        return `Overlapping sessions on weekday ${a.weekday}: ${a.startTime}-${a.endTime} and ${b.startTime}-${b.endTime}`;
      }
    }
  }
  return null;
}
