import { route, uuidParam } from "@/lib/api";
import { scheduleSchema } from "@/lib/validation";
import { bookingDeps } from "@/lib/deps";
import { findScheduleOverlap } from "@/lib/slots";
import { HttpError } from "@/lib/errors";
import { audit } from "@/lib/audit";

export const PUT = route({ roles: ["admin", "doctor"], schema: scheduleSchema, limit: { name: "adminsched", max: 30, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const id = uuidParam(ctx.params, "id");
  if (ctx.user?.role === "doctor") {
    const callerDoctorId = await ctx.doctorId();
    if (callerDoctorId !== id) throw new HttpError(403, "forbidden", "You can only update your own schedule.");
  }
  const overlap = findScheduleOverlap(ctx.body.rules);
  if (overlap) throw new HttpError(422, "schedule_overlap", overlap);
  await bookingDeps().db.rpc("replace_doctor_schedule", { p_doctor: id, p_rules: ctx.body.rules });
  await audit(ctx.user?.id ?? null, "doctor.schedule_replaced", "doctor", id, { sessions: ctx.body.rules.length });
  return { ok: true };
});
