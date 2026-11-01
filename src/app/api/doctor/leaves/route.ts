import { z } from "zod";
import { route } from "@/lib/api";
import { leaveSchema, uuid } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mapDbError } from "@/lib/errors";

export const POST = route({ roles: ["doctor"], schema: leaveSchema, limit: { name: "leave", max: 30, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const doctorId = await ctx.doctorId();
  const { error } = await supabaseAdmin().from("doctor_leaves").insert({ doctor_id: doctorId, leave_date: ctx.body.date, reason: ctx.body.reason });
  if (error) throw mapDbError(error);
  return { ok: true };
});

export const DELETE = route({ roles: ["doctor"], schema: z.object({ id: uuid }), limit: { name: "leave", max: 30, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const doctorId = await ctx.doctorId();
  const { error } = await supabaseAdmin().from("doctor_leaves").delete().eq("id", ctx.body.id).eq("doctor_id", doctorId);
  if (error) throw mapDbError(error);
  return { ok: true };
});
