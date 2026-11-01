import { route, uuidParam } from "@/lib/api";
import { activeSchema } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { HttpError, mapDbError } from "@/lib/errors";
import { audit } from "@/lib/audit";

export const PATCH = route({ roles: ["admin"], schema: activeSchema, limit: { name: "adminpatient", max: 30, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const id = uuidParam(ctx.params, "id");
  const admin = supabaseAdmin();
  const { data: p } = await admin.from("patients").select("profile_id").eq("id", id).maybeSingle();
  if (!p) throw new HttpError(404, "not_found", "Patient not found.");
  const { error } = await admin.from("profiles").update({ is_active: ctx.body.isActive }).eq("id", p.profile_id as string);
  if (error) throw mapDbError(error);
  await audit(ctx.user?.id ?? null, ctx.body.isActive ? "patient.activated" : "patient.deactivated", "patient", id);
  return { ok: true };
});
