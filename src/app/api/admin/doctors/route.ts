import { route } from "@/lib/api";
import { createDoctorSchema } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createStaffUser, deleteAuthUser } from "@/lib/admin-users";
import { mapDbError } from "@/lib/errors";
import { audit } from "@/lib/audit";

export const POST = route({ roles: ["admin"], schema: createDoctorSchema, limit: { name: "admindoctor", max: 20, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const b = ctx.body;
  const userId = await createStaffUser({ email: b.email, password: b.temporaryPassword, fullName: b.fullName, mobile: b.mobile, role: "doctor" });
  const { data, error } = await supabaseAdmin()
    .from("doctors")
    .insert({
      profile_id: userId,
      speciality: b.speciality,
      qualification: b.qualification,
      registration_number: b.registrationNumber,
      consultation_fee: b.consultationFee,
      bio: b.bio,
    })
    .select("id")
    .single();
  if (error) {
    await deleteAuthUser(userId);
    throw mapDbError(error);
  }
  await audit(ctx.user?.id ?? null, "doctor.created", "doctor", data.id as string);
  return { id: data.id as string };
});
