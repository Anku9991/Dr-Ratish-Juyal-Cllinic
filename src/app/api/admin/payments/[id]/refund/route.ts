import { route, uuidParam } from "@/lib/api";
import { refundSchema } from "@/lib/validation";
import { bookingDeps } from "@/lib/deps";
import { refundPayment } from "@/lib/payments";
import { rupeesToPaise } from "@/lib/money";

export const POST = route({ roles: ["admin"], schema: refundSchema, limit: { name: "refund", max: 10, windowMs: 60_000, by: "user" } }, async (ctx) => {
  await refundPayment(bookingDeps(), {
    paymentId: uuidParam(ctx.params, "id"),
    amountPaise: rupeesToPaise(ctx.body.amountRupees),
    reason: ctx.body.reason,
    actorId: ctx.user?.id ?? null,
  });
  return { ok: true };
});
