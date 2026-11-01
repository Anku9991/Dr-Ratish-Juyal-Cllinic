import { route } from "@/lib/api";
import { readImageUpload } from "@/lib/upload";
import { BUCKET_ASSETS, uploadBytes } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mapDbError } from "@/lib/errors";
import { audit } from "@/lib/audit";

export const POST = route({ roles: ["doctor"], limit: { name: "sig", max: 10, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const doctorId = await ctx.doctorId();
  const { bytes, kind } = await readImageUpload(ctx.req);
  const path = `signatures/${doctorId}.${kind}`;
  await uploadBytes(BUCKET_ASSETS, path, bytes, kind === "png" ? "image/png" : "image/jpeg");
  const { error } = await supabaseAdmin().from("doctors").update({ signature_storage_path: path }).eq("id", doctorId);
  if (error) throw mapDbError(error);
  await audit(ctx.user?.id ?? null, "doctor.signature_updated", "doctor", doctorId);
  return { ok: true };
});
