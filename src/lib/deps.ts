import "server-only";
import { createSupabaseBookingDb } from "./db-supabase";
import { getGateway } from "./razorpay";
import { serverEnv } from "./env";

export function bookingDeps() {
  return { db: createSupabaseBookingDb(), gateway: getGateway() };
}

export function keySecret(): string {
  return serverEnv().RAZORPAY_KEY_SECRET;
}
