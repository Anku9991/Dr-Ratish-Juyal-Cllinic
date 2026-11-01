"use client";

import { useEffect, useState } from "react";
import { addDays, formatDateLong, formatTime12, weekdayOf } from "@/lib/time";
import { cn } from "@/lib/cn";
import { api } from "./api";
import { Alert } from "../ui";

interface Slot {
  startTime: string;
  endTime: string;
  startsAt: string;
}
interface SlotsResponse {
  slots: Slot[];
  reason?: string;
}

const REASON_TEXT: Record<string, string> = {
  leave: "The doctor is on leave on this date.",
  holiday: "The clinic is closed on this date.",
  past_date: "This date has passed.",
  beyond_horizon: "Bookings are not open this far ahead.",
};

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SlotPicker({
  doctorId,
  today,
  horizonDays,
  date,
  time,
  onSelect,
}: {
  doctorId: string;
  today: string;
  horizonDays: number;
  date: string | null;
  time: string | null;
  onSelect: (date: string, time: string | null) => void;
}) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [reason, setReason] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const days = Array.from({ length: Math.min(horizonDays, 30) + 1 }, (_, i) => addDays(today, i));

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setSlots(null);
    setError(null);
    setReason(undefined);
    api<SlotsResponse>(`/api/doctors/${doctorId}/slots?date=${date}`, "GET").then((res) => {
      if (cancelled) return;
      if (!res.ok) return setError(res.message);
      setSlots(res.data.slots);
      setReason(res.data.reason);
    });
    return () => {
      cancelled = true;
    };
  }, [doctorId, date]);

  return (
    <div>
      <div role="listbox" aria-label="Choose a date" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {days.map((d) => {
          const selected = d === date;
          return (
            <button
              key={d}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(d, null)}
              className={cn(
                "flex w-16 shrink-0 flex-col items-center rounded-xl border px-2 py-2 text-sm",
                selected ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:border-brand-500",
              )}
            >
              <span className="text-xs opacity-80">{DAY[weekdayOf(d)]}</span>
              <span className="text-lg font-semibold leading-tight">{Number(d.slice(8))}</span>
              <span className="text-xs opacity-80">{new Date(`${d}T00:00:00Z`).toLocaleString("en-IN", { month: "short", timeZone: "UTC" })}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4" aria-live="polite">
        {!date ? <p className="text-sm text-muted">Pick a date to see available times.</p> : null}
        {date && slots === null && !error ? <p className="text-sm text-muted">Loading times for {formatDateLong(date)}...</p> : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {slots && slots.length === 0 ? <Alert tone="info">{(reason && REASON_TEXT[reason]) || "No times are free on this date. Try another day."}</Alert> : null}
        {slots && slots.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((s) => (
              <li key={s.startTime}>
                <button
                  type="button"
                  onClick={() => date && onSelect(date, s.startTime)}
                  aria-pressed={time === s.startTime}
                  className={cn(
                    "w-full rounded-lg border px-2 py-2 text-sm font-medium",
                    time === s.startTime ? "border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-200" : "border-line bg-white hover:border-brand-500",
                  )}
                >
                  {formatTime12(s.startTime)}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
