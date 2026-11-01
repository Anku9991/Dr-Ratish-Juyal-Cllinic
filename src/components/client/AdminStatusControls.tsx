"use client";

import { ApiButton } from "./ApiButton";
import type { AppointmentStatus } from "@/lib/status";

const NEXT: Partial<Record<AppointmentStatus, Array<{ to: AppointmentStatus; label: string; danger?: boolean }>>> = {
  confirmed: [{ to: "checked_in", label: "Check in" }, { to: "cancelled", label: "Cancel", danger: true }],
  checked_in: [{ to: "in_consultation", label: "Start consultation" }, { to: "cancelled", label: "Cancel", danger: true }],
  pending_payment: [{ to: "cancelled", label: "Cancel", danger: true }],
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
          confirm={o.danger ? "Are you sure you want to cancel this appointment?" : undefined}
        >
          {o.label}
        </ApiButton>
      ))}
    </div>
  );
}
