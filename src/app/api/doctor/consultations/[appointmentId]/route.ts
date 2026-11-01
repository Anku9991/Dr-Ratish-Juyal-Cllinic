import { route, uuidParam } from "@/lib/api";
import { consultationSchema } from "@/lib/validation";
import { bookingDeps } from "@/lib/deps";

import { db } from "@/lib/firebase/config";
import { doc, setDoc } from "firebase/firestore";

export const PUT = route({ roles: ["doctor"], schema: consultationSchema, limit: { name: "consult", max: 60, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const doctorId = await ctx.doctorId();
  const appointmentId = uuidParam(ctx.params, "appointmentId");

  // Auto-save pad drawing to Firebase Firestore if present
  if (ctx.body.padDrawing) {
    try {
      await setDoc(doc(db, "prescription_pads", appointmentId), {
        appointmentId,
        doctorId,
        imageData: ctx.body.padDrawing,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      console.warn("Firestore pad save in draft:", err);
    }
  }

  const result = await bookingDeps().db.rpc<{ consultation_id: string; prescription_id: string }>("save_consultation_draft", {
    p_appointment: appointmentId,
    p_doctor: doctorId,
    p_data: ctx.body,
  });
  return { consultationId: result.consultation_id, prescriptionId: result.prescription_id, savedAt: new Date().toISOString() };
});
