import { NextResponse } from "next/server";
import { route, uuidParam } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPrescriptionPdf } from "@/lib/prescriptions";
import { HttpError } from "@/lib/errors";
import { getDoctorId, getPatientId } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

/**
 * Secure prescription viewer. Access rules (checked here AND mirrored by RLS):
 *  - patient: own prescription, only while it is the current issued one
 *  - doctor: prescriptions they wrote
 *  - admin: only with the explicit 'medical_records' permission
 * Anything else is a 404 so ids cannot be probed.
 */
export const GET = route({ roles: ["patient", "doctor", "admin"], limit: { name: "rxpdf", max: 60, windowMs: 60_000, by: "user" } }, async ({ user, params, req }) => {
  const id = uuidParam(params, "id");
  const { data: rx } = await supabaseAdmin().from("prescriptions").select("id, doctor_id, patient_id, status").eq("id", id).maybeSingle();
  if (!rx || !user) throw new HttpError(404, "not_found", "Prescription not found.");

  let allowed = false;
  if (user.role === "patient") allowed = (await getPatientId(user.id)) === rx.patient_id && rx.status === "issued";
  else if (user.role === "doctor") allowed = (await getDoctorId(user.id)) === rx.doctor_id && rx.status !== "draft";
  else allowed = hasPermission(user.role, user.permissions, "medical_records") && rx.status !== "draft";
  if (!allowed) throw new HttpError(404, "not_found", "Prescription not found.");

  const bytes = await getPrescriptionPdf(id);
  await audit(user.id, "prescription.viewed", "prescription", id, { role: user.role });
  const download = req.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="prescription-${id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
