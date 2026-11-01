import { z } from "zod";
import { route } from "@/lib/api";
import { holidaySchema, uuid } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mapDbError } from "@/lib/errors";
import { audit } from "@/lib/audit";

export const POST = route({ roles: ["admin"], schema: holidaySchema, limit: { name: "holiday", max: 30, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const { error } = await supabaseAdmin().from("clinic_holidays").insert({ holiday_date: ctx.body.date, name: ctx.body.name });
  if (error) throw mapDbError(error);
  await audit(ctx.user?.id ?? null, "clinic.holiday_added", "clinic", null, { date: ctx.body.date });
  return { ok: true };
});

export const DELETE = route({ roles: ["admin"], schema: z.object({ id: uuid }), limit: { name: "holiday", max: 30, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const { error } = await supabaseAdmin().from("clinic_holidays").delete().eq("id", ctx.body.id);
  if (error) throw mapDbError(error);
  return { ok: true };
});
