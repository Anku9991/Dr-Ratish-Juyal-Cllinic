import { route } from "@/lib/api";
import { paymentFailureSchema } from "@/lib/validation";
import { createSupabaseBookingDb } from "@/lib/db-supabase";
import { HttpError } from "@/lib/errors";

/** The browser reports a failed attempt (informational; the order stays retryable until the hold expires). */
export const POST = route(
  { roles: ["patient"], schema: paymentFailureSchema, limit: { name: "payfail", max: 20, windowMs: 60_000, by: "user" } },
  async (ctx) => {
    const patientId = await ctx.patientId();
    const db = createSupabaseBookingDb();
    const payment = await db.paymentByOrder(ctx.body.razorpay_order_id);
    if (!payment || payment.patient_id !== patientId) throw new HttpError(404, "payment_not_found", "Payment not found.");
    await db.rpc("fail_payment", { p_order_id: payment.razorpay_order_id, p_reason: ctx.body.reason ?? "Payment was not completed" });
    return { ok: true };
  },
);
