import { route, uuidParam } from "@/lib/api";
import { reasonSchema } from "@/lib/validation";
import { bookingDeps } from "@/lib/deps";

export const POST = route({ roles: ["doctor"], schema: reasonSchema, limit: { name: "rxcancel", max: 10, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const doctorId = await ctx.doctorId();
  await bookingDeps().db.rpc("cancel_prescription", { p_prescription: uuidParam(ctx.params, "id"), p_doctor: doctorId, p_reason: ctx.body.reason });
  return { ok: true };
});
