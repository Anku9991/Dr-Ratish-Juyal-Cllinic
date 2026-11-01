import "server-only";
import type { OrderInfo } from "./payments";
import type { SessionUser } from "./auth";

/** What the browser needs to open Razorpay Checkout. Key ID is public; the secret never leaves the server. */
export function checkoutPayload(order: OrderInfo, user: SessionUser | null) {
  return {
    ...order,
    keyId: process.env.RAZORPAY_KEY_ID ?? "",
    prefill: { name: user?.fullName ?? "", email: user?.email ?? "", contact: user?.mobile ?? "" },
  };
}
