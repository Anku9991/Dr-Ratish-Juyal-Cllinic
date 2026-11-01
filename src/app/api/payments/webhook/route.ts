import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { createSupabaseBookingDb } from "@/lib/db-supabase";
import { handleWebhook } from "@/lib/payments";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

// Authenticated by HMAC signature over the RAW body, not by cookies.
export const POST = route({ skipOriginCheck: true, limit: { name: "webhook", max: 300, windowMs: 60_000 } }, async ({ req }) => {
  const rawBody = await req.text();
  const outcome = await handleWebhook(
    { db: createSupabaseBookingDb(), webhookSecret: serverEnv().RAZORPAY_WEBHOOK_SECRET },
    { rawBody, signature: req.headers.get("x-razorpay-signature"), eventId: req.headers.get("x-razorpay-event-id") },
  );
  return NextResponse.json({ received: true, duplicate: outcome.duplicate });
});
