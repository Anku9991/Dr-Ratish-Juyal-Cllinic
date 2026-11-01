import { route, uuidParam } from "@/lib/api";
import { staffAppointmentStatusSchema } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { HttpError, mapDbError } from "@/lib/errors";
import { canTransitionAppointment, type AppointmentStatus } from "@/lib/status";
import { audit } from "@/lib/audit";

export const POST = route({ roles: ["doctor"], schema: staffAppointmentStatusSchema, limit: { name: "docstatus", max: 60, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const doctorId = await ctx.doctorId();
  const id = uuidParam(ctx.params, "id");
  const admin = supabaseAdmin();

  // Scoped to the caller's own appointments: another doctor's id simply 404s.
  const { data: appt } = await admin.from("appointments").select("id, status, starts_at").eq("id", id).eq("doctor_id", doctorId).maybeSingle();
  if (!appt) throw new HttpError(404, "not_found", "Appointment not found.");

  const from = appt.status as AppointmentStatus;
  const to = ctx.body.status as AppointmentStatus;
  if (!canTransitionAppointment(from, to, "doctor")) throw new HttpError(409, "invalid_transition", `An appointment that is ${from.replace("_", " ")} cannot be marked ${to.replace("_", " ")}.`);
  if (to === "no_show" && new Date(appt.starts_at as string).getTime() > Date.now()) throw new HttpError(409, "too_early", "You can mark no-show only after the appointment time.");
  if (to === "completed") throw new HttpError(409, "use_finalize", "Finalize the prescription to complete a consultation.");

  const { data, error } = await admin.from("appointments").update({ status: to }).eq("id", id).eq("status", from).select("id").maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new HttpError(409, "stale_status", "This appointment was just updated. Refresh and try again.");
  await audit(ctx.user?.id ?? null, "appointment.status_changed", "appointment", id, { from, to });
  return { ok: true, status: to };
});
