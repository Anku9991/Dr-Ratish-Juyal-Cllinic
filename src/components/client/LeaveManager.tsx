"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { ApiButton } from "./ApiButton";
import { Alert, buttonStyles, inputClass } from "../ui";

export interface LeaveRow {
  id: string;
  leave_date: string;
  reason: string | null;
}

export function LeaveManager({ url, rows }: { url: string; rows: LeaveRow[] }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!date) return;
    setBusy(true);
    setError(null);
    const res = await api(url, "POST", { date, reason: reason || undefined });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setDate("");
    setReason("");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="leave-date" className="mb-1 block text-xs font-medium text-muted">
            Date
          </label>
          <input id="leave-date" type="date" className={inputClass} value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="min-w-40 flex-1">
          <label htmlFor="leave-reason" className="mb-1 block text-xs font-medium text-muted">
            Reason (optional)
          </label>
          <input id="leave-reason" className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
        </div>
        <button type="button" className={buttonStyles.secondary} disabled={busy || !date} onClick={add}>
          Add leave day
        </button>
      </div>
      {rows.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line bg-white">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {r.leave_date}
                {r.reason ? <span className="text-muted"> - {r.reason}</span> : null}
              </span>
              <ApiButton url={url} method="DELETE" body={{ id: r.id }} variant="ghost">
                Remove
              </ApiButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No leave days added.</p>
      )}
    </div>
  );
}
