import { route, uuidParam } from "@/lib/api";
import { cancelSchema } from "@/lib/validation";
import { bookingDeps } from "@/lib/deps";
import { cancelAppointment } from "@/lib/payments";
import { getClinicSettings } from "@/lib/clinic";
import { HttpError } from "@/lib/errors";

import { clinicStore } from "@/lib/appointments-store";

export const POST = route(
  { roles: ["patient"], schema: cancelSchema, limit: { name: "cancel", max: 10, windowMs: 60_000, by: "user" } },
  async (ctx) => {
    const patientId = await ctx.patientId();
    const apptId = uuidParam(ctx.params, "id");

    // Check clinicStore first
    const local = clinicStore.getById(apptId);
    if (local) {
      if (local.patient_id !== patientId && local.patient_id !== ctx.user?.id) {
        throw new HttpError(403, "forbidden", "You cannot cancel another patient's appointment.");
      }
      clinicStore.cancel(apptId, ctx.body.reason || "Cancelled by patient");
      return { refund: local.payment_method === "cash" ? "none" : "refunded" };
    }

    const settings = await getClinicSettings();
    const outcome = await cancelAppointment(bookingDeps(), {
      appointmentId: apptId,
      actorUserId: ctx.user?.id ?? "",
      patientId,
      reason: ctx.body.reason,
      windowHours: settings.cancellation_window_hours,
    });
    return outcome;
  },
);
