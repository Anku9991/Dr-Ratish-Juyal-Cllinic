import { route } from "@/lib/api";
import { patientProfileSchema } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mapDbError } from "@/lib/errors";

export const PUT = route({ roles: ["patient"], schema: patientProfileSchema, limit: { name: "profile", max: 20, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const patientId = await ctx.patientId();
  const userId = ctx.user?.id ?? "";
  const b = ctx.body;
  const admin = supabaseAdmin();

  const r1 = await admin.from("profiles").update({ full_name: b.fullName, mobile: b.mobile }).eq("id", userId);
  if (r1.error) throw mapDbError(r1.error);
  const r2 = await admin
    .from("patients")
    .update({ date_of_birth: b.dateOfBirth ?? null, gender: b.gender ?? null, address: b.address, emergency_contact: b.emergencyContact })
    .eq("id", patientId);
  if (r2.error) throw mapDbError(r2.error);
  const r3 = await admin
    .from("patient_medical")
    .upsert({ patient_id: patientId, allergies: b.allergies, medical_history: b.medicalHistory, updated_at: new Date().toISOString() });
  if (r3.error) throw mapDbError(r3.error);
  return { ok: true };
});
