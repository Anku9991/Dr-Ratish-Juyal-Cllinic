import { route } from "@/lib/api";
import { clinicSettingsSchema } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mapDbError } from "@/lib/errors";
import { audit } from "@/lib/audit";

export const PUT = route({ roles: ["admin"], schema: clinicSettingsSchema, limit: { name: "settings", max: 20, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const b = ctx.body;
  const { error } = await supabaseAdmin()
    .from("clinic_settings")
    .update({
      clinic_name: b.clinicName,
      address: b.address,
      phone: b.phone,
      email: b.email,
      prescription_footer: b.prescriptionFooter,
      timezone: b.timezone,
      cancellation_window_hours: b.cancellationWindowHours,
      slot_hold_minutes: b.slotHoldMinutes,
      booking_horizon_days: b.bookingHorizonDays,
      record_retention_years: b.recordRetentionYears,
    })
    .eq("id", 1);
  if (error) throw mapDbError(error);
  await audit(ctx.user?.id ?? null, "clinic.settings_updated", "clinic", "1");
  return { ok: true };
});
