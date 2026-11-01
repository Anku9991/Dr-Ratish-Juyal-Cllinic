"use client";

import { ApiButton } from "./ApiButton";
import type { AppointmentStatus } from "@/lib/status";

const NEXT: Partial<Record<AppointmentStatus, Array<{ to: AppointmentStatus; label: string; danger?: boolean; confirm?: string }>>> = {
  confirmed: [
    { to: "checked_in", label: "Check in" },
    { to: "no_show", label: "No show", danger: true, confirm: "Mark this patient as No Show?" },
    { to: "cancelled", label: "Cancel", danger: true, confirm: "Are you sure you want to cancel this appointment?" },
  ],
  checked_in: [
    { to: "in_consultation", label: "Start consultation" },
    { to: "no_show", label: "No show", danger: true, confirm: "Mark this patient as No Show?" },
    { to: "cancelled", label: "Cancel", danger: true, confirm: "Are you sure you want to cancel this appointment?" },
  ],
  pending_payment: [
    { to: "cancelled", label: "Cancel", danger: true, confirm: "Are you sure you want to cancel this appointment?" },
  ],
};

export function AdminStatusControls({ appointmentId, status }: { appointmentId: string; status: AppointmentStatus }) {
  const options = NEXT[status];
  if (!options?.length) return <span className="text-sm text-muted">-</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <ApiButton
          key={o.to}
          url={`/api/admin/appointments/${appointmentId}/status`}
          body={{ status: o.to }}
          variant={o.danger ? "danger" : "secondary"}
          confirm={o.confirm}
        >
          {o.label}
        </ApiButton>
      ))}
    </div>
  );
}
