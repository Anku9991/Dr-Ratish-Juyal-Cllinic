"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { ApiButton } from "./ApiButton";
import { Alert, buttonStyles, inputClass } from "../ui";

export interface HolidayRow {
  id: string;
  holiday_date: string;
  name: string;
}

export function HolidayManager({ rows }: { rows: HolidayRow[] }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!date || !name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await api("/api/admin/holidays", "POST", { date, name });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setDate("");
    setName("");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="holiday-date" className="mb-1 block text-xs font-medium text-muted">
            Date
          </label>
          <input id="holiday-date" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="min-w-40 flex-1">
          <label htmlFor="holiday-name" className="mb-1 block text-xs font-medium text-muted">
            Name
          </label>
          <input id="holiday-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Diwali" />
        </div>
        <button type="button" className={buttonStyles.secondary} disabled={busy || !date || !name.trim()} onClick={add}>
          Add holiday
        </button>
      </div>
      {rows.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line bg-white">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {r.holiday_date} - {r.name}
              </span>
              <ApiButton url="/api/admin/holidays" method="DELETE" body={{ id: r.id }} variant="ghost">
                Remove
              </ApiButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No upcoming holidays added.</p>
      )}
    </div>
  );
}
