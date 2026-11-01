import { route, uuidParam } from "@/lib/api";
import { bookingDeps } from "@/lib/deps";
import { ensureOrder } from "@/lib/payments";
import { checkoutPayload } from "@/lib/checkout-payload";

/** Retry payment for a pending appointment (reuses the open order if there is one). */
export const POST = route({ roles: ["patient"], limit: { name: "pay", max: 15, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const patientId = await ctx.patientId();
  const order = await ensureOrder(bookingDeps(), { appointmentId: uuidParam(ctx.params, "id"), patientId });
  return checkoutPayload(order, ctx.user);
});
