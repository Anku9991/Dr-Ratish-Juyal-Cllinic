import { route, uuidParam } from "@/lib/api";
import { consultationSchema } from "@/lib/validation";
import { createSupabaseBookingDb } from "@/lib/db-supabase";
import { getClinicSettings, isClinicConfigured } from "@/lib/clinic";
import { getPrescriptionPdf } from "@/lib/prescriptions";
import { HttpError } from "@/lib/errors";

/** Saves the latest form contents and issues the prescription in one request. Only the doctor can do this. */
export const POST = route({ roles: ["doctor"], schema: consultationSchema, limit: { name: "finalize", max: 20, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const doctorId = await ctx.doctorId();
  const appointmentId = uuidParam(ctx.params, "appointmentId");
  if (!isClinicConfigured(await getClinicSettings())) {
    throw new HttpError(409, "clinic_not_configured", "The clinic details are not set up yet. Ask the admin to complete Clinic settings before issuing prescriptions.");
  }
  const db = createSupabaseBookingDb();
  const saved = await db.rpc<{ consultation_id: string }>("save_consultation_draft", { p_appointment: appointmentId, p_doctor: doctorId, p_data: ctx.body });
  const rx = await db.rpc<{ id: string; prescription_number: string }>("finalize_prescription", { p_consultation: saved.consultation_id, p_doctor: doctorId });

  // Sync to Firebase
  try {
    const { db: firestore } = await import("@/lib/firebase/config");
    const { doc, setDoc } = await import("firebase/firestore");
    await setDoc(doc(firestore, "prescriptions", rx.id), {
      prescriptionId: rx.id,
      prescriptionNumber: rx.prescription_number,
      appointmentId,
      doctorId,
      consultationId: saved.consultation_id,
      padDrawing: ctx.body.padDrawing || null,
      status: "issued",
      finalizedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (fbErr) {
    console.warn("Firestore prescription sync:", fbErr);
  }

  let pdfReady = true;
  try {
    await getPrescriptionPdf(rx.id);
  } catch (err) {
    // The prescription IS issued; the PDF is regenerated on first view if storage hiccuped.
    pdfReady = false;
    console.error("PDF generation deferred:", err instanceof Error ? err.message : "unknown");
  }
  return { prescriptionId: rx.id, prescriptionNumber: rx.prescription_number, pdfReady };
});
