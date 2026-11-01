import { z } from "zod";
import { route, uuidParam } from "@/lib/api";
import { leaveSchema, uuid } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mapDbError } from "@/lib/errors";
import { audit } from "@/lib/audit";

export const POST = route({ roles: ["admin"], schema: leaveSchema, limit: { name: "adminleave", max: 30, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const id = uuidParam(ctx.params, "id");
  const { error } = await supabaseAdmin().from("doctor_leaves").insert({ doctor_id: id, leave_date: ctx.body.date, reason: ctx.body.reason });
  if (error) throw mapDbError(error);
  await audit(ctx.user?.id ?? null, "doctor.leave_added", "doctor", id, { date: ctx.body.date });
  return { ok: true };
});

export const DELETE = route({ roles: ["admin"], schema: z.object({ id: uuid }), limit: { name: "adminleave", max: 30, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const id = uuidParam(ctx.params, "id");
  const { error } = await supabaseAdmin().from("doctor_leaves").delete().eq("id", ctx.body.id).eq("doctor_id", id);
  if (error) throw mapDbError(error);
  return { ok: true };
});
