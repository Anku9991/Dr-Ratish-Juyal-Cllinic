import { route, uuidParam } from "@/lib/api";
import { staffAppointmentStatusSchema } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { HttpError, mapDbError } from "@/lib/errors";
import { canTransitionAppointment, type AppointmentStatus } from "@/lib/status";
import { bookingDeps } from "@/lib/deps";
import { cancelAppointment } from "@/lib/payments";
import { getClinicSettings } from "@/lib/clinic";
import { audit } from "@/lib/audit";

export const POST = route({ roles: ["admin"], schema: staffAppointmentStatusSchema, limit: { name: "adminstatus", max: 60, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const id = uuidParam(ctx.params, "id");
  const admin = supabaseAdmin();
  const { data: appt } = await admin.from("appointments").select("id, status, starts_at").eq("id", id).maybeSingle();
  if (!appt) throw new HttpError(404, "not_found", "Appointment not found.");
  const from = appt.status as AppointmentStatus;
  const to = ctx.body.status as AppointmentStatus;

  if (to === "cancelled") {
    if (!["pending_payment", "confirmed"].includes(from) && !canTransitionAppointment(from, to, "admin")) {
      throw new HttpError(409, "invalid_transition", "This appointment can no longer be cancelled.");
    }
    const settings = await getClinicSettings();
    const outcome = await cancelAppointment(bookingDeps(), {
      appointmentId: id,
      actorUserId: ctx.user?.id ?? "",
      reason: ctx.body.reason ?? "Cancelled by clinic",
      windowHours: settings.cancellation_window_hours,
      clinicInitiated: true,
    });
    return { ok: true, status: to, ...outcome };
  }

  if (!canTransitionAppointment(from, to, "admin")) throw new HttpError(409, "invalid_transition", `An appointment that is ${from.replace("_", " ")} cannot be marked ${to.replace("_", " ")}.`);
  if (to === "completed") throw new HttpError(409, "use_finalize", "A consultation is completed when the doctor finalizes the prescription.");
  if (to === "no_show" && new Date(appt.starts_at as string).getTime() > Date.now()) throw new HttpError(409, "too_early", "You can mark no-show only after the appointment time.");
  const { data, error } = await admin.from("appointments").update({ status: to }).eq("id", id).eq("status", from).select("id").maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new HttpError(409, "stale_status", "This appointment was just updated. Refresh and try again.");
  await audit(ctx.user?.id ?? null, "appointment.status_changed", "appointment", id, { from, to });
  return { ok: true, status: to };
});
