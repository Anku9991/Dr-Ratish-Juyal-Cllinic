import { route } from "@/lib/api";
import { verifyPaymentSchema } from "@/lib/validation";
import { bookingDeps, keySecret } from "@/lib/deps";
import { verifyCheckoutPayment } from "@/lib/payments";

export const POST = route(
  { roles: ["patient"], schema: verifyPaymentSchema, limit: { name: "verify", max: 20, windowMs: 60_000, by: "user" } },
  async (ctx) => {
    const patientId = await ctx.patientId();
    const { db, gateway } = bookingDeps();
    return verifyCheckoutPayment(
      { db, gateway, keySecret: keySecret() },
      { patientId, orderId: ctx.body.razorpay_order_id, paymentId: ctx.body.razorpay_payment_id, signature: ctx.body.razorpay_signature },
    );
  },
);
