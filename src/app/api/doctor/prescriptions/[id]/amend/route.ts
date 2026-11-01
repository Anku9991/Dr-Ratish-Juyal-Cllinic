import { route, uuidParam } from "@/lib/api";
import { reasonSchema } from "@/lib/validation";
import { bookingDeps } from "@/lib/deps";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const POST = route({ roles: ["doctor"], schema: reasonSchema, limit: { name: "amend", max: 10, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const doctorId = await ctx.doctorId();
  const id = uuidParam(ctx.params, "id");
  const newDraft = await bookingDeps().db.rpc<string>("amend_prescription", { p_prescription: id, p_doctor: doctorId, p_reason: ctx.body.reason });
  const { data } = await supabaseAdmin().from("prescriptions").select("consultation_id, consultations!inner(appointment_id)").eq("id", newDraft).single();
  const c = data && (Array.isArray(data.consultations) ? data.consultations[0] : data.consultations);
  return { draftId: newDraft, appointmentId: (c?.appointment_id as string | undefined) ?? null };
});
