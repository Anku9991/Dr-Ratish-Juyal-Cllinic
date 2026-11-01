import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { timingSafeEqual } from "node:crypto";

/** Releases expired slot holds and expires unpaid appointments. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export const GET = route({ skipOriginCheck: true }, async ({ req }) => {
  const secret = serverEnv().CRON_SECRET;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const ok = Boolean(secret) && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  const { error } = await supabaseAdmin().rpc("expire_stale_holds");
  if (error) return NextResponse.json({ error: { code: "database_error", message: "Failed" } }, { status: 500 });
  return { ok: true };
});
