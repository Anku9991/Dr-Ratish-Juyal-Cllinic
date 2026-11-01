import { route, uuidParam } from "@/lib/api";
import { updateDoctorSchema } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { HttpError, mapDbError } from "@/lib/errors";
import { audit } from "@/lib/audit";

export const PATCH = route({ roles: ["admin"], schema: updateDoctorSchema, limit: { name: "admindoctor", max: 60, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const id = uuidParam(ctx.params, "id");
  const b = ctx.body;
  const admin = supabaseAdmin();
  const { data: doc } = await admin.from("doctors").select("id, profile_id").eq("id", id).maybeSingle();
  if (!doc) throw new HttpError(404, "not_found", "Doctor not found.");

  const patch: Record<string, unknown> = {};
  if (b.speciality !== undefined) patch.speciality = b.speciality;
  if (b.qualification !== undefined) patch.qualification = b.qualification;
  if (b.registrationNumber !== undefined) patch.registration_number = b.registrationNumber;
  if (b.consultationFee !== undefined) patch.consultation_fee = b.consultationFee;
  if (b.bio !== undefined) patch.bio = b.bio;
  if (b.isActive !== undefined) patch.is_active = b.isActive;
  if (Object.keys(patch).length) {
    const { error } = await admin.from("doctors").update(patch).eq("id", id);
    if (error) throw mapDbError(error);
  }
  if (b.fullName !== undefined) {
    const { error } = await admin.from("profiles").update({ full_name: b.fullName }).eq("id", doc.profile_id as string);
    if (error) throw mapDbError(error);
  }
  await audit(ctx.user?.id ?? null, "doctor.updated", "doctor", id, { fields: Object.keys(b) });
  return { ok: true };
});
