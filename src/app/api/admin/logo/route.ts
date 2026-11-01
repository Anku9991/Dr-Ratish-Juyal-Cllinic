import { route } from "@/lib/api";
import { readImageUpload } from "@/lib/upload";
import { BUCKET_ASSETS, uploadBytes } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mapDbError } from "@/lib/errors";
import { audit } from "@/lib/audit";

export const POST = route({ roles: ["admin"], limit: { name: "logo", max: 10, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const { bytes, kind } = await readImageUpload(ctx.req);
  const path = `logo/clinic-logo.${kind}`;
  await uploadBytes(BUCKET_ASSETS, path, bytes, kind === "png" ? "image/png" : "image/jpeg");
  const { error } = await supabaseAdmin().from("clinic_settings").update({ logo_storage_path: path }).eq("id", 1);
  if (error) throw mapDbError(error);
  await audit(ctx.user?.id ?? null, "clinic.logo_updated", "clinic", "1");
  return { ok: true };
});
