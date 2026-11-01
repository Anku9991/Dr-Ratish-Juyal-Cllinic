import { route } from "@/lib/api";
import { checkoutSchema } from "@/lib/validation";
import { bookingDeps } from "@/lib/deps";
import { ensureOrder } from "@/lib/payments";
import { checkoutPayload } from "@/lib/checkout-payload";

export const POST = route(
  { roles: ["patient"], schema: checkoutSchema, limit: { name: "checkout", max: 15, windowMs: 60_000, by: "user" } },
  async (ctx) => {
    const patientId = await ctx.patientId();
    const deps = bookingDeps();
    const appt = await deps.db.rpc<{ id: string }>("create_pending_appointment", {
      p_hold_token: ctx.body.holdToken,
      p_patient: patientId,
      p_reason: ctx.body.reason,
    });
    const order = await ensureOrder(deps, { appointmentId: appt.id, patientId });
    return checkoutPayload(order, ctx.user);
  },
);
