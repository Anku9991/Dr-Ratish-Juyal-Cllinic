"use client";

import { useState } from "react";
import Link from "next/link";
import { formatInstant } from "@/lib/time";
import { formatINR } from "@/lib/money";
import { AppointmentBadge, EmptyState, LinkButton, Card } from "@/components/ui";
import { CancelAppointment } from "@/components/client/CancelAppointment";
import type { ApptWithDoctor } from "@/lib/queries";
import { Clock, MapPin, Receipt, ArrowRight, Stethoscope } from "lucide-react";

interface Props {
  appointments: ApptWithDoctor[];
  timezone: string;
  cancellationWindowHours: number;
}

export function PatientAppointmentsManager({ appointments, timezone, cancellationWindowHours }: Props) {
  const [filter, setFilter] = useState<"all" | "upcoming" | "completed" | "cancelled">("all");

  const now = Date.now();

  const upcomingAppts = appointments.filter((a) => {
    const isFuture = new Date(a.ends_at || a.starts_at).getTime() >= now;
    return ["confirmed", "checked_in", "in_consultation", "pending_payment"].includes(a.status) && isFuture;
  });

  const completedAppts = appointments.filter((a) => a.status === "completed" || (new Date(a.ends_at).getTime() < now && ["confirmed", "checked_in"].includes(a.status)));

  const cancelledAppts = appointments.filter((a) => ["cancelled", "expired", "no_show"].includes(a.status));

  const filteredList =
    filter === "upcoming"
      ? upcomingAppts
      : filter === "completed"
      ? completedAppts
      : filter === "cancelled"
      ? cancelledAppts
      : appointments;

  return (
    <div className="space-y-6">
      {/* Tab Filter Buttons */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
            filter === "all" ? "bg-brand-600 text-white shadow-xs" : "bg-white border border-line text-slate-700 hover:bg-slate-50"
          }`}
        >
          All Appointments ({appointments.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("upcoming")}
          className={`rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
            filter === "upcoming" ? "bg-brand-600 text-white shadow-xs" : "bg-white border border-line text-slate-700 hover:bg-slate-50"
          }`}
        >
          Upcoming & Active ({upcomingAppts.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("completed")}
          className={`rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
            filter === "completed" ? "bg-brand-600 text-white shadow-xs" : "bg-white border border-line text-slate-700 hover:bg-slate-50"
          }`}
        >
          Completed ({completedAppts.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("cancelled")}
          className={`rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
            filter === "cancelled" ? "bg-brand-600 text-white shadow-xs" : "bg-white border border-line text-slate-700 hover:bg-slate-50"
          }`}
        >
          Cancelled / Expired ({cancelledAppts.length})
        </button>
      </div>

      {filteredList.length === 0 ? (
        <EmptyState
          title={`No ${filter === "all" ? "" : filter} appointments found`}
          description={
            filter === "upcoming"
              ? "You don't have any upcoming bookings scheduled."
              : "No appointments match this filter."
          }
          action={<LinkButton href="/patient/book">Book an Appointment</LinkButton>}
        />
      ) : (
        <div className="space-y-4">
          {filteredList.map((a) => {
            const docName =
              (Array.isArray(a.doctors.profiles)
                ? a.doctors.profiles[0]?.full_name
                : a.doctors.profiles.full_name) || "Doctor";
            const paid = a.payments.find(
              (p) => ["captured", "refunded", "partially_refunded"].includes(p.status) || Boolean(p.receipt_number)
            );
            const isCash = a.payments.some((p) => p.method === "cash");
            const hoursLeft = (new Date(a.starts_at).getTime() - Date.now()) / 3_600_000;
            const canCancel = ["pending_payment", "confirmed"].includes(a.status) && hoursLeft > 0;
            const refundEligible = hoursLeft >= cancellationWindowHours;

            const isNeuro = docName.toLowerCase().includes("ratish");
            const cabin = isNeuro ? "Cabin 1 (Neurology OPD)" : "Cabin 2 (Physiotherapy Rehab)";

            return (
              <Card key={a.id} className="p-5 transition hover:shadow-xs border-line">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/patient/appointments/${a.id}`}
                        className="text-base font-bold text-brand-700 hover:underline"
                      >
                        {a.appointment_number}
                      </Link>
                      <AppointmentBadge status={a.status} />
                      {isCash ? (
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                          Cash at Counter
                        </span>
                      ) : paid ? (
                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                          Paid Online
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <Stethoscope className="h-4 w-4 text-brand-600 shrink-0" />
                      <span>{docName}</span>
                      <span className="text-xs text-muted font-normal">• {a.doctors.speciality}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>{formatInstant(a.starts_at, timezone)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span>{cabin}</span>
                      </div>
                      {paid ? (
                        <div className="flex items-center gap-1.5 font-medium text-slate-700">
                          <span>Amount: {formatINR(paid.amount)}</span>
                        </div>
                      ) : null}
                    </div>

                    {a.reason ? (
                      <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2 border border-slate-100">
                        <strong className="text-slate-700">Reason:</strong> {a.reason}
                      </p>
                    ) : null}

                    {a.cancel_reason ? (
                      <p className="text-xs text-rose-700 bg-rose-50 rounded-lg p-2 border border-rose-100">
                        <strong>Cancellation Note:</strong> {a.cancel_reason}
                      </p>
                    ) : null}
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
                    <Link
                      href={`/patient/appointments/${a.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    >
                      View Details
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                    </Link>

                    {paid || isCash ? (
                      <Link
                        href={`/patient/appointments/${a.id}/receipt`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        Token Receipt
                      </Link>
                    ) : null}

                    {canCancel ? (
                      <CancelAppointment
                        appointmentId={a.id}
                        paid={Boolean(paid) && !isCash}
                        refundEligible={refundEligible}
                      />
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
