import { route } from "@/lib/api";
import { patientProfileSchema } from "@/lib/validation";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export const PUT = route({ roles: ["patient"], schema: patientProfileSchema, limit: { name: "profile", max: 20, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const patientId = await ctx.patientId();
  const userId = ctx.user?.id ?? "";
  const b = ctx.body;

  if (isSupabaseConfigured()) {
    try {
      const admin = supabaseAdmin();
      await admin.from("profiles").update({ full_name: b.fullName, mobile: b.mobile }).eq("id", userId);

      await admin
        .from("patients")
        .upsert(
          {
            id: patientId,
            profile_id: userId,
            date_of_birth: b.dateOfBirth ?? null,
            gender: b.gender ?? null,
            address: b.address,
            emergency_contact: b.emergencyContact,
          },
          { onConflict: "id" }
        );

      await admin
        .from("patient_medical")
        .upsert(
          {
            patient_id: patientId,
            allergies: b.allergies,
            medical_history: b.medicalHistory,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "patient_id" }
        );
    } catch (err) {
      console.warn("Supabase profile save fallback:", err);
    }
  }

  return { ok: true };
});
