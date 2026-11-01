"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { Alert, buttonStyles, inputClass } from "../ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface Rule {
  weekday: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  isActive: boolean;
}

/** One row per weekday: a single session per day keeps this usable on a phone; add more sessions via a second call if ever needed. */
export function ScheduleEditor({ doctorId, initial }: { doctorId: string; initial: Rule[] }) {
  const router = useRouter();
  const initialByDay = new Map(initial.map((r) => [r.weekday, r]));
  const [rows, setRows] = useState(
    DAYS.map((_, weekday) => initialByDay.get(weekday) ?? { weekday, startTime: "09:00", endTime: "13:00", slotMinutes: 15, isActive: false }),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update(weekday: number, patch: Partial<Rule>) {
    setRows((rs) => rs.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const rules = rows.filter((r) => r.isActive);
    const res = await api(`/api/admin/doctors/${doctorId}/schedules`, "PUT", { rules });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {saved ? <Alert tone="success">Schedule saved.</Alert> : null}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.weekday} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-3 text-sm">
            <label className="flex w-24 items-center gap-2 font-medium">
              <input type="checkbox" checked={r.isActive} onChange={(e) => update(r.weekday, { isActive: e.target.checked })} />
              {DAYS[r.weekday]}
            </label>
            <input type="time" className={`${inputClass} w-auto`} value={r.startTime} disabled={!r.isActive} onChange={(e) => update(r.weekday, { startTime: e.target.value })} />
            <span className="text-muted">to</span>
            <input type="time" className={`${inputClass} w-auto`} value={r.endTime} disabled={!r.isActive} onChange={(e) => update(r.weekday, { endTime: e.target.value })} />
            <select className={`${inputClass} w-auto`} value={r.slotMinutes} disabled={!r.isActive} onChange={(e) => update(r.weekday, { slotMinutes: Number(e.target.value) })}>
              {[10, 15, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m} min slots
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <button type="button" className={buttonStyles.primary} disabled={busy} onClick={save}>
        {busy ? "Saving..." : "Save schedule"}
      </button>
    </div>
  );
}
