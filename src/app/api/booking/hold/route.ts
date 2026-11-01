import { route } from "@/lib/api";
import { holdSchema } from "@/lib/validation";
import { bookingDeps } from "@/lib/deps";

export const POST = route(
  { roles: ["patient"], schema: holdSchema, limit: { name: "hold", max: 20, windowMs: 60_000, by: "user" } },
  async (ctx) => {
    const patientId = await ctx.patientId();
    const hold = await bookingDeps().db.rpc<{ hold_token: string; expires_at: string; starts_at: string }>("create_hold", {
      p_doctor: ctx.body.doctorId,
      p_patient: patientId,
      p_date: ctx.body.date,
      p_start: ctx.body.startTime,
    });
    return { holdToken: hold.hold_token, expiresAt: hold.expires_at, startsAt: hold.starts_at };
  },
);
