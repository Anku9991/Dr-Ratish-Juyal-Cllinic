import { z } from "zod";
import { route } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mapDbError } from "@/lib/errors";

const schema = z.object({
  qualification: z.string().trim().max(200).optional().nullable().transform((v) => v || null),
  bio: z.string().trim().max(2000).optional().nullable().transform((v) => v || null),
});

/** Doctors may edit their own qualification and bio. Fee, speciality and registration number are admin-managed. */
export const PUT = route({ roles: ["doctor"], schema, limit: { name: "docprofile", max: 20, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const doctorId = await ctx.doctorId();
  const { error } = await supabaseAdmin().from("doctors").update({ qualification: ctx.body.qualification, bio: ctx.body.bio }).eq("id", doctorId);
  if (error) throw mapDbError(error);
  return { ok: true };
});
